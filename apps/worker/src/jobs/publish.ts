import {
  AuthError,
  NotConfiguredError,
  PermanentError,
  RetryableError,
  type MediaRef,
} from '@mehwar/connectors';
import { credentialContext, forTenant, type PostStatus, type TargetStatus } from '@mehwar/db';
import type { PublishJob, TargetOptions } from '@mehwar/shared';
import type { WorkerDeps } from '../deps';
import { withLock } from '../lock';
import { refreshChannelToken } from './token-refresh';

export type PublishOutcome = 'published' | 'skipped' | 'retry' | 'failed';

export interface AttemptInfo {
  /** 1-based attempt number. */
  attempt: number;
  maxAttempts: number;
}

/**
 * Publishes one post target. Idempotent: a target that is no longer QUEUED (published, canceled,
 * rescheduled into the future) is skipped. Returns 'retry' when the job should be retried; the
 * BullMQ wrapper turns that into a thrown error.
 */
export async function publishTarget(
  deps: WorkerDeps,
  job: PublishJob,
  attempt: AttemptInfo,
): Promise<PublishOutcome> {
  const { prisma, connectors, vault, storage, notifier, redis } = deps;
  const db = forTenant(prisma, job.organizationId);

  const target = await db.postTarget.findUnique({
    where: { id: job.postTargetId },
    include: {
      channel: { include: { credential: true } },
      post: { include: { media: { include: { media: true }, orderBy: { position: 'asc' } } } },
      organization: { select: { owner: { select: { xPremium: true } } } },
    },
  });
  if (!target || !['QUEUED', 'PUBLISHING'].includes(target.status)) return 'skipped';
  if (target.scheduledAt && target.scheduledAt.getTime() > Date.now() + 60_000) return 'skipped';

  const channel = target.channel;
  const fail = async (message: string, status: TargetStatus = 'FAILED') => {
    await db.postTarget.update({
      where: { id: target.id },
      data: { status, lastError: message.slice(0, 1000) },
    });
  };

  return withLock(redis, `lock:channel:${channel.id}`, async () => {
    await db.postTarget.update({
      where: { id: target.id },
      data: { status: 'PUBLISHING', attempts: { increment: 1 } },
    });
    await db.post.update({ where: { id: target.postId }, data: { status: 'PUBLISHING' } });
    await notifier.event(job.organizationId, { type: 'post.updated', postId: target.postId });

    let outcome: PublishOutcome;
    try {
      if (channel.status !== 'ACTIVE' || !channel.credential) {
        throw new AuthError(`${channel.displayName} needs to be reconnected`);
      }
      const connector = connectors.get(channel.platform);

      // Refresh first if the token is (nearly) expired.
      let credential = channel.credential;
      if (
        credential.accessTokenExpiresAt &&
        credential.accessTokenExpiresAt.getTime() < Date.now() + 60_000 &&
        credential.refreshTokenEnc
      ) {
        credential = await refreshChannelToken(deps, job.organizationId, channel.id, {
          locked: true,
        });
      }
      const accessToken = await vault.decrypt(
        job.organizationId,
        credential.accessTokenEnc,
        credentialContext.access(channel.id),
      );

      if (target.post.media.length > 0 && !storage)
        throw new PermanentError('Media storage is not configured');
      const media: MediaRef[] = target.post.media.map(({ media: m }) => {
        if (m.status !== 'READY') throw new PermanentError(`Media "${m.fileName}" is not ready`);
        const key = m.publicKey ?? m.storageKey;
        return {
          kind: m.mimeType.startsWith('video/') ? 'video' : 'image',
          mimeType: m.publicKey && m.mimeType.startsWith('image/') ? 'image/jpeg' : m.mimeType,
          sizeBytes: Number(m.sizeBytes),
          width: m.width,
          height: m.height,
          durationSec: m.durationSec,
          publicUrl: storage!.publicUrl(key),
          read: (range) => storage!.getBuffer(m.storageKey, range),
        };
      });
      // Image sizes may change after JPEG conversion; read the converted copy for pushed uploads.
      for (const [i, ref] of media.entries()) {
        const m = target.post.media[i]!.media;
        if (m.publicKey && ref.kind === 'image') {
          const head = await storage!.head(m.publicKey);
          if (head) {
            ref.sizeBytes = head.size;
            ref.read = (range) => storage!.getBuffer(m.publicKey!, range);
          }
        }
      }

      // Inject custom thumbnail for YouTube (kind = 'thumbnail')
      const thumbnailMediaId = ((target.options ?? {}) as TargetOptions).thumbnailMediaId;
      if (thumbnailMediaId && storage) {
        const thumbAsset = await prisma.mediaAsset.findUnique({ where: { id: thumbnailMediaId } });
        if (thumbAsset && thumbAsset.status === 'READY') {
          media.push({
            kind: 'thumbnail',
            mimeType: thumbAsset.mimeType,
            sizeBytes: Number(thumbAsset.sizeBytes),
            width: thumbAsset.width,
            height: thumbAsset.height,
            durationSec: null,
            publicUrl: storage.publicUrl(thumbAsset.publicKey ?? thumbAsset.storageKey),
            read: (range) => storage!.getBuffer(thumbAsset.storageKey, range),
          });
        }
      }

      const result = await connector.publish({
        text: target.textOverride ?? target.post.text,
        media,
        options: (target.options ?? {}) as TargetOptions,
        firstComment: target.post.firstComment,
        extendedTextLimit: target.organization.owner.xPremium,
        accessToken,
        account: {
          externalId: channel.externalId,
          username: channel.username,
          metadata: (channel.metadata ?? {}) as Record<string, unknown>,
        },
      });

      await db.postTarget.update({
        where: { id: target.id },
        data: {
          status: 'PUBLISHED',
          externalId: result.externalId,
          externalUrl: result.url ?? null,
          publishedAt: new Date(),
          lastError: null,
        },
      });
      outcome = 'published';
    } catch (err) {
      const message = (err as Error).message || 'Unknown error';
      if (err instanceof AuthError) {
        await db.channel.update({ where: { id: channel.id }, data: { status: 'NEEDS_RECONNECT' } });
        await fail(`${channel.displayName} needs to be reconnected: ${message}`);
        await notifier.notify(
          job.organizationId,
          'CHANNEL_NEEDS_RECONNECT',
          `Reconnect ${channel.displayName}`,
          {
            body: 'We could not publish because the connection expired or was revoked.',
            link: '/channels',
            email: true,
          },
        );
        outcome = 'failed';
      } else if (err instanceof PermanentError || err instanceof NotConfiguredError) {
        await fail(message);
        outcome = 'failed';
      } else if (attempt.attempt < attempt.maxAttempts) {
        // Retryable (or unexpected) error with attempts left: back to the queue.
        await fail(`Retrying: ${message}`, 'QUEUED');
        outcome = 'retry';
      } else {
        await fail(
          err instanceof RetryableError
            ? `Gave up after ${attempt.maxAttempts} attempts: ${message}`
            : message,
        );
        outcome = 'failed';
      }
      deps.log('publish failed', {
        targetId: target.id,
        platform: channel.platform,
        outcome,
        message,
      });
    }

    await finalizePost(deps, job.organizationId, target.postId);
    if (outcome === 'failed') {
      await notifier.notify(
        job.organizationId,
        'POST_FAILED',
        `Post to ${channel.displayName} failed`,
        {
          body:
            (await db.postTarget.findUnique({ where: { id: target.id } }))?.lastError ?? undefined,
          link: '/dashboard',
          email: true,
        },
      );
    }
    return outcome;
  });
}

/** Rolls target statuses up into the post status and announces completion. */
export async function finalizePost(
  deps: WorkerDeps,
  organizationId: string,
  postId: string,
): Promise<PostStatus> {
  const db = forTenant(deps.prisma, organizationId);
  const targets = await db.postTarget.findMany({ where: { postId }, select: { status: true } });
  const statuses = targets.map((t) => t.status);
  const busy = statuses.some((s) => s === 'QUEUED' || s === 'PUBLISHING' || s === 'PENDING');
  const published = statuses.filter((s) => s === 'PUBLISHED').length;

  let status: PostStatus;
  if (busy) status = statuses.some((s) => s === 'PUBLISHING') ? 'PUBLISHING' : 'SCHEDULED';
  else if (published === statuses.length) status = 'PUBLISHED';
  else if (published > 0) status = 'PARTIALLY_FAILED';
  else status = 'FAILED';

  const before = await db.post.findUnique({ where: { id: postId }, select: { status: true } });
  await db.post.update({ where: { id: postId }, data: { status } });
  await deps.notifier.event(organizationId, { type: 'post.updated', postId });
  if (status === 'PUBLISHED' && before?.status !== 'PUBLISHED') {
    await deps.notifier.notify(
      organizationId,
      'POST_PUBLISHED',
      `Your post is live on ${published} channel${published > 1 ? 's' : ''} 🎉`,
      {
        link: '/dashboard',
      },
    );
  }
  return status;
}

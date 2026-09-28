import { credentialContext, forTenant, withSystemTransaction } from '@mehwar/db';
import type { WorkerDeps } from '../deps';

const WINDOW_DAYS = 30;

/**
 * Nightly: snapshots engagement for posts published in the last 30 days and follower counts for
 * every active channel. Failures on one channel never stop the others.
 */
export async function collectMetrics(
  deps: WorkerDeps,
): Promise<{ posts: number; channels: number }> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const channels = await withSystemTransaction(deps.prisma, (tx) =>
    tx.channel.findMany({
      where: { status: 'ACTIVE', credential: { isNot: null } },
      include: {
        credential: true,
        postTargets: {
          where: { status: 'PUBLISHED', publishedAt: { gte: since }, externalId: { not: null } },
          select: { id: true, externalId: true },
        },
      },
    }),
  );

  let posts = 0;
  let done = 0;
  for (const channel of channels) {
    if (!deps.connectors.has(channel.platform) || !channel.credential) continue;
    const orgId = channel.organizationId;
    const db = forTenant(deps.prisma, orgId);
    const connector = deps.connectors.get(channel.platform);
    const account = {
      externalId: channel.externalId,
      username: channel.username,
      metadata: (channel.metadata ?? {}) as Record<string, unknown>,
    };
    try {
      const token = await deps.vault.decrypt(
        orgId,
        channel.credential.accessTokenEnc,
        credentialContext.access(channel.id),
      );
      for (const target of channel.postTargets) {
        try {
          const m = await connector.fetchMetrics(target.externalId!, token, account);
          await db.metricSnapshot.create({
            data: { organizationId: orgId, channelId: channel.id, postTargetId: target.id, ...m },
          });
          posts++;
        } catch (err) {
          deps.log('metrics failed', { targetId: target.id, message: (err as Error).message });
        }
      }
      const followers = await connector.fetchFollowers(token, account).catch(() => null);
      if (followers !== null) {
        await db.metricSnapshot.create({
          data: { organizationId: orgId, channelId: channel.id, followers },
        });
      }
      done++;
    } catch (err) {
      deps.log('channel metrics failed', {
        channelId: channel.id,
        message: (err as Error).message,
      });
    }
  }
  return { posts, channels: done };
}

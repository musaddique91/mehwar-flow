import { randomBytes, randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AuthError,
  ConnectorRegistry,
  PermanentError,
  RetryableError,
  type PlatformConnector,
  type PublishRequest,
} from '@mehwar/connectors';
import {
  credentialContext,
  forTenant,
  PrismaClient,
  TokenVault,
  withSystemTransaction,
} from '@mehwar/db';
import type { Storage } from '@mehwar/storage';
import type { WorkerDeps } from '../deps';
import type { Notifier } from '../notifier';
import { processMedia } from './media';
import { publishTarget } from './publish';
import { findCredentialsDueForRefresh, isDueForRefresh } from './token-refresh';

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const vault = TokenVault.fromEnv(prisma, `1:${randomBytes(32).toString('base64')}`, 1);
const userIds: string[] = [];

/** In-memory storage double. */
function memoryStorage() {
  const objects = new Map<string, { body: Buffer; type: string }>();
  const storage = {
    objects,
    publicUrl: (key: string) => `https://media.test/${key}`,
    presignGet: async (key: string) => `https://media.test/${key}?signed`,
    presignGetInternal: async (key: string) => `http://minio.internal/${key}?signed`,
    head: async (key: string) =>
      objects.has(key) ? { size: objects.get(key)!.body.length } : null,
    getBuffer: async (key: string, range?: { start: number; end: number }) => {
      const body = objects.get(key)!.body;
      return range ? body.subarray(range.start, range.end + 1) : body;
    },
    put: async (key: string, body: Buffer, type: string) => void objects.set(key, { body, type }),
    copy: async (src: string, dest: string) => void objects.set(dest, objects.get(src)!),
  };
  return storage;
}

function fakeConnector(
  platform: 'x' | 'facebook',
  publish: (req: PublishRequest) => Promise<{ externalId: string; url?: string }>,
): PlatformConnector {
  return {
    platform,
    scopes: [],
    usesPkce: false,
    getAuthUrl: () => '',
    exchangeCode: async () => ({ accessToken: '', scopes: [] }),
    listAccounts: async () => [],
    refresh: vi.fn(async () => ({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
      expiresAt: new Date(Date.now() + 7200_000),
      scopes: ['tweet.write'],
    })),
    publish: vi.fn(publish),
    fetchMetrics: async () => ({ impressions: 0, likes: 0, comments: 0, shares: 0, views: 0 }),
    fetchFollowers: async () => null,
    revoke: async () => undefined,
  };
}

function makeDeps(
  connectors: PlatformConnector[],
  storage: ReturnType<typeof memoryStorage> | null = null,
) {
  const notifications: { kind: string; title: string }[] = [];
  const notifier: Notifier = {
    event: async () => undefined,
    notify: async (_org, kind, title) => void notifications.push({ kind, title }),
  };
  const deps: WorkerDeps = {
    prisma,
    vault,
    storage: storage as unknown as Storage,
    connectors: new ConnectorRegistry(connectors),
    redis,
    notifier,
    log: () => undefined,
  };
  return { deps, notifications };
}

/** Creates an account with channels (encrypted credentials) and a queued post targeting them. */
async function setup(
  platforms: ('x' | 'facebook')[],
  opts: { expiresAt?: Date; text?: string } = {},
) {
  const orgId = randomUUID();
  const key = vault.newOrganizationKey(orgId);
  const user = await withSystemTransaction(prisma, async (tx) => {
    const u = await tx.user.create({
      data: { email: `w-${randomUUID()}@test.local`, passwordHash: 'x', name: 'Worker Test' },
    });
    await tx.organization.create({
      data: {
        id: orgId,
        name: 'org',
        ownerId: u.id,
        wrappedDataKey: key.wrappedKey,
        dataKeyVersion: key.keyVersion,
      },
    });
    return u;
  });
  userIds.push(user.id);
  const db = forTenant(prisma, orgId);
  const post = await db.post.create({
    data: {
      organizationId: orgId,
      text: opts.text ?? 'Hello world',
      status: 'SCHEDULED',
      scheduledAt: new Date(),
    },
  });
  const targets = [];
  for (const platform of platforms) {
    const channel = await db.channel.create({
      data: {
        organizationId: orgId,
        platform,
        externalId: randomUUID(),
        displayName: `My ${platform}`,
        username: 'me',
      },
    });
    await db.channelCredential.create({
      data: {
        organizationId: orgId,
        channelId: channel.id,
        accessTokenEnc: await vault.encrypt(
          orgId,
          `access-${platform}`,
          credentialContext.access(channel.id),
        ),
        refreshTokenEnc: await vault.encrypt(
          orgId,
          `refresh-${platform}`,
          credentialContext.refresh(channel.id),
        ),
        accessTokenExpiresAt: opts.expiresAt ?? new Date(Date.now() + 3600_000),
        scopes: [],
      },
    });
    targets.push(
      await db.postTarget.create({
        data: {
          organizationId: orgId,
          postId: post.id,
          channelId: channel.id,
          status: 'QUEUED',
          scheduledAt: new Date(),
        },
      }),
    );
  }
  return { orgId, db, post, targets };
}

const once = { attempt: 1, maxAttempts: 5 };
const last = { attempt: 5, maxAttempts: 5 };

beforeAll(async () => {
  await redis.ping();
});

afterAll(async () => {
  await withSystemTransaction(prisma, (tx) =>
    tx.user.deleteMany({ where: { id: { in: userIds } } }),
  );
  await prisma.$disconnect();
  redis.disconnect();
});

describe('publishTarget', () => {
  it('publishes with the decrypted token and marks the post published', async () => {
    const x = fakeConnector('x', async () => ({
      externalId: 't1',
      url: 'https://x.com/me/status/t1',
    }));
    const { deps, notifications } = makeDeps([x]);
    const { orgId, db, post, targets } = await setup(['x']);

    expect(
      await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once),
    ).toBe('published');
    const req = (x.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PublishRequest;
    expect(req.accessToken).toBe('access-x');
    expect(req.text).toBe('Hello world');

    const target = await db.postTarget.findUniqueOrThrow({ where: { id: targets[0]!.id } });
    expect(target).toMatchObject({
      status: 'PUBLISHED',
      externalId: 't1',
      externalUrl: 'https://x.com/me/status/t1',
      attempts: 1,
    });
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe('PUBLISHED');
    expect(notifications.map((n) => n.kind)).toEqual(['POST_PUBLISHED']);

    // Running the same job again is a no-op (idempotent).
    expect(
      await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once),
    ).toBe('skipped');
    expect(x.publish).toHaveBeenCalledTimes(1);
  });

  it('retries temporary errors while attempts remain, then fails', async () => {
    const x = fakeConnector('x', async () => {
      throw new RetryableError('Rate limited');
    });
    const { deps, notifications } = makeDeps([x]);
    const { orgId, db, post, targets } = await setup(['x']);
    const job = { organizationId: orgId, postTargetId: targets[0]!.id };

    expect(await publishTarget(deps, job, once)).toBe('retry');
    expect(await db.postTarget.findUniqueOrThrow({ where: { id: targets[0]!.id } })).toMatchObject({
      status: 'QUEUED',
      lastError: 'Retrying: Rate limited',
    });
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe('SCHEDULED');

    expect(await publishTarget(deps, job, last)).toBe('failed');
    expect((await db.postTarget.findUniqueOrThrow({ where: { id: targets[0]!.id } })).status).toBe(
      'FAILED',
    );
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe('FAILED');
    expect(notifications.map((n) => n.kind)).toEqual(['POST_FAILED']);
  });

  it('marks the channel for reconnection on auth errors', async () => {
    const x = fakeConnector('x', async () => {
      throw new AuthError('Token revoked');
    });
    const { deps, notifications } = makeDeps([x]);
    const { orgId, db, targets } = await setup(['x']);

    expect(
      await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once),
    ).toBe('failed');
    const channel = await db.channel.findUniqueOrThrow({ where: { id: targets[0]!.channelId } });
    expect(channel.status).toBe('NEEDS_RECONNECT');
    expect(notifications.map((n) => n.kind)).toEqual(['CHANNEL_NEEDS_RECONNECT', 'POST_FAILED']);
  });

  it('rolls up a partial failure across channels', async () => {
    const x = fakeConnector('x', async () => ({ externalId: 'ok' }));
    const fb = fakeConnector('facebook', async () => {
      throw new PermanentError('Page is restricted');
    });
    const { deps } = makeDeps([x, fb]);
    const { orgId, db, post, targets } = await setup(['x', 'facebook']);

    await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once);
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe('SCHEDULED');
    await publishTarget(deps, { organizationId: orgId, postTargetId: targets[1]!.id }, once);
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe(
      'PARTIALLY_FAILED',
    );
    expect(
      (await db.postTarget.findUniqueOrThrow({ where: { id: targets[1]!.id } })).lastError,
    ).toBe('Page is restricted');
  });

  it('refreshes an expired token before publishing and stores the rotated pair', async () => {
    const x = fakeConnector('x', async () => ({ externalId: 'ok' }));
    const { deps } = makeDeps([x]);
    const { orgId, db, targets } = await setup(['x'], { expiresAt: new Date(Date.now() - 1000) });

    expect(
      await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once),
    ).toBe('published');
    expect(x.refresh).toHaveBeenCalledWith('refresh-x');
    expect(
      ((x.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PublishRequest).accessToken,
    ).toBe('fresh-access');
    const cred = await db.channelCredential.findUniqueOrThrow({
      where: { channelId: targets[0]!.channelId },
    });
    expect(
      await vault.decrypt(
        orgId,
        cred.refreshTokenEnc!,
        credentialContext.refresh(targets[0]!.channelId),
      ),
    ).toBe('fresh-refresh');
  });

  it('skips canceled targets', async () => {
    const x = fakeConnector('x', async () => ({ externalId: 'ok' }));
    const { deps } = makeDeps([x]);
    const { orgId, db, targets } = await setup(['x']);
    await db.postTarget.update({ where: { id: targets[0]!.id }, data: { status: 'CANCELED' } });
    expect(
      await publishTarget(deps, { organizationId: orgId, postTargetId: targets[0]!.id }, once),
    ).toBe('skipped');
    expect(x.publish).not.toHaveBeenCalled();
  });
});

describe('token refresh scan', () => {
  it('finds credentials inside their window', async () => {
    const { targets } = await setup(['x'], { expiresAt: new Date(Date.now() + 5 * 60_000) });
    const due = await findCredentialsDueForRefresh(prisma);
    expect(due.map((d) => d.channelId)).toContain(targets[0]!.channelId);
    expect(isDueForRefresh('threads', new Date(Date.now() + 8 * 86_400_000))).toBe(false);
  });
});

describe('processMedia', () => {
  it('converts images to a public JPEG with a thumbnail and real dimensions', async () => {
    const storage = memoryStorage();
    const { deps } = makeDeps([], storage);
    const { orgId, db } = await setup([]);
    const png = await sharp({
      create: { width: 1200, height: 800, channels: 4, background: '#ff00aa' },
    })
      .png()
      .toBuffer();
    const media = await db.mediaAsset.create({
      data: {
        organizationId: orgId,
        storageKey: `org/${orgId}/media/x/pic.png`,
        fileName: 'pic.png',
        mimeType: 'image/png',
        sizeBytes: BigInt(png.length),
        status: 'PROCESSING',
      },
    });
    storage.objects.set(media.storageKey, { body: png, type: 'image/png' });

    await processMedia(
      deps,
      { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' },
      { organizationId: orgId, mediaId: media.id },
    );
    const done = await db.mediaAsset.findUniqueOrThrow({ where: { id: media.id } });
    expect(done).toMatchObject({ status: 'READY', width: 1200, height: 800 });
    expect(done.publicKey).toMatch(new RegExp(`^public/${orgId}/${media.id}/.+\\.jpg$`));
    const publicCopy = storage.objects.get(done.publicKey!)!;
    expect(publicCopy.type).toBe('image/jpeg');
    expect((await sharp(publicCopy.body).metadata()).format).toBe('jpeg');
    const thumb = await sharp(storage.objects.get(done.thumbnailKey!)!.body).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(480);
  });

  it('marks unreadable files as failed with a message', async () => {
    const storage = memoryStorage();
    const { deps } = makeDeps([], storage);
    const { orgId, db } = await setup([]);
    const media = await db.mediaAsset.create({
      data: {
        organizationId: orgId,
        storageKey: `org/${orgId}/media/y/bad.jpg`,
        fileName: 'bad.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 3n,
        status: 'PROCESSING',
      },
    });
    storage.objects.set(media.storageKey, { body: Buffer.from('nope'), type: 'image/jpeg' });
    await processMedia(
      deps,
      { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' },
      { organizationId: orgId, mediaId: media.id },
    );
    const failed = await db.mediaAsset.findUniqueOrThrow({ where: { id: media.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.processingError).toMatch(/Could not process this file/);
  });
});

import { AuthError } from '@mehwar/connectors';
import {
  credentialContext,
  forTenant,
  withSystemTransaction,
  type ChannelCredential,
  type Platform,
  type PrismaClient,
} from '@mehwar/db';
import type { WorkerDeps } from '../deps';
import { withLock } from '../lock';

/**
 * How long before expiry a token should be refreshed. Short-lived tokens (X, Google: ~2h) are
 * refreshed 15 minutes early; long-lived ones (Threads: ~60 days) a week early.
 */
export const REFRESH_WINDOW_MS: Record<Platform, number> = {
  x: 15 * 60_000,
  youtube: 15 * 60_000,
  facebook: 7 * 86_400_000,
  instagram: 7 * 86_400_000,
  threads: 7 * 86_400_000,
  tiktok: 60 * 60_000,
  snapchat: 15 * 60_000,
  linkedin: 7 * 86_400_000,
};

const MAX_WINDOW_MS = Math.max(...Object.values(REFRESH_WINDOW_MS));
const MAX_FAILURES = 5;

export function isDueForRefresh(platform: Platform, expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_WINDOW_MS[platform];
}

/** Active channel credentials inside their refresh window, across all tenants. */
export async function findCredentialsDueForRefresh(prisma: PrismaClient, now = new Date()) {
  const candidates = await withSystemTransaction(prisma, (tx) =>
    tx.channelCredential.findMany({
      where: {
        accessTokenExpiresAt: { lte: new Date(now.getTime() + MAX_WINDOW_MS) },
        refreshTokenEnc: { not: null },
        channel: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        organizationId: true,
        channelId: true,
        accessTokenExpiresAt: true,
        channel: { select: { platform: true } },
      },
    }),
  );
  return candidates.filter((c) =>
    isDueForRefresh(c.channel.platform, c.accessTokenExpiresAt!, now),
  );
}

/**
 * Exchanges the stored refresh token for new credentials and stores them encrypted. Refresh tokens
 * may be single-use (X), so the new pair replaces the old one in one update, under a per-channel
 * lock. Invalid grants mark the channel NEEDS_RECONNECT and notify the user.
 */
export async function refreshChannelToken(
  deps: WorkerDeps,
  organizationId: string,
  channelId: string,
  { locked = false } = {},
): Promise<ChannelCredential> {
  const run = async () => {
    const db = forTenant(deps.prisma, organizationId);
    const channel = await db.channel.findUniqueOrThrow({
      where: { id: channelId },
      include: { credential: true },
    });
    const cred = channel.credential;
    if (!cred?.refreshTokenEnc) throw new AuthError('No refresh token stored');
    // Another worker may have refreshed while we waited for the lock.
    if (
      cred.accessTokenExpiresAt &&
      !isDueForRefresh(channel.platform, cred.accessTokenExpiresAt) &&
      cred.lastRefreshedAt &&
      Date.now() - cred.lastRefreshedAt.getTime() < 60_000
    ) {
      return cred;
    }

    const connector = deps.connectors.get(channel.platform);
    const refreshToken = await deps.vault.decrypt(
      organizationId,
      cred.refreshTokenEnc,
      credentialContext.refresh(channelId),
    );
    try {
      const tokens = await connector.refresh(refreshToken);
      return await db.channelCredential.update({
        where: { channelId },
        data: {
          accessTokenEnc: await deps.vault.encrypt(
            organizationId,
            tokens.accessToken,
            credentialContext.access(channelId),
          ),
          refreshTokenEnc: tokens.refreshToken
            ? await deps.vault.encrypt(
                organizationId,
                tokens.refreshToken,
                credentialContext.refresh(channelId),
              )
            : cred.refreshTokenEnc,
          accessTokenExpiresAt: tokens.expiresAt ?? null,
          refreshTokenExpiresAt: tokens.refreshExpiresAt ?? cred.refreshTokenExpiresAt,
          scopes: tokens.scopes.length ? tokens.scopes : cred.scopes,
          lastRefreshedAt: new Date(),
          refreshFailures: 0,
          lastError: null,
        },
      });
    } catch (err) {
      const message = (err as Error).message;
      const failures = cred.refreshFailures + 1;
      await db.channelCredential.update({
        where: { channelId },
        data: { refreshFailures: failures, lastError: message.slice(0, 1000) },
      });
      if (err instanceof AuthError || failures >= MAX_FAILURES) {
        await db.channel.update({ where: { id: channelId }, data: { status: 'NEEDS_RECONNECT' } });
        await deps.notifier.notify(
          organizationId,
          'CHANNEL_NEEDS_RECONNECT',
          `Reconnect ${channel.displayName}`,
          {
            body: 'Its connection expired and could not be renewed automatically. Scheduled posts to it will fail until you reconnect.',
            link: '/channels',
            email: true,
          },
        );
        await deps.notifier.event(organizationId, { type: 'channel.updated', channelId });
        throw err instanceof AuthError ? err : new AuthError(message);
      }
      throw err;
    }
  };
  return locked ? run() : withLock(deps.redis, `lock:channel:${channelId}`, run);
}

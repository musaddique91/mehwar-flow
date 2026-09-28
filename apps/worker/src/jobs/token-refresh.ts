import { PrismaClient, withSystemTransaction, type Platform } from '@mehwar/db';

/**
 * How long before expiry a token should be refreshed. Short-lived tokens (X, Google: ~2h) are
 * refreshed 15 minutes early; long-lived ones (Meta, Threads, TikTok: ~60 days) a week early.
 */
export const REFRESH_WINDOW_MS: Record<Platform, number> = {
  x: 15 * 60_000,
  youtube: 15 * 60_000,
  facebook: 7 * 86_400_000,
  instagram: 7 * 86_400_000,
  threads: 7 * 86_400_000,
  tiktok: 60 * 60_000,
  snapchat: 15 * 60_000,
};

const MAX_WINDOW_MS = Math.max(...Object.values(REFRESH_WINDOW_MS));

export function isDueForRefresh(platform: Platform, expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_WINDOW_MS[platform];
}

/**
 * Finds active channel credentials that are inside their refresh window. The per-platform token
 * exchange is implemented by the connectors (Phase 2); this scan already selects the right rows.
 */
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

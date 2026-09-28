/** Queue names and job payloads shared by the API (producer) and the worker (consumer). */
export const QUEUES = {
  publish: 'publish',
  media: 'media',
  tokens: 'tokens',
  maintenance: 'maintenance',
} as const;

export const MAINTENANCE_JOBS = {
  tokenRefreshScan: 'token-refresh-scan',
  scheduleSweep: 'schedule-sweep',
  metrics: 'metrics',
} as const;

export interface PublishJob {
  organizationId: string;
  postTargetId: string;
}

export interface MediaJob {
  organizationId: string;
  mediaId: string;
}

export interface TokenRefreshJob {
  organizationId: string;
  channelId: string;
}

/** Redis pub/sub channel for live events, one per organization. */
export const eventsChannel = (organizationId: string) => `events:${organizationId}`;

export type LiveEvent =
  | { type: 'post.updated'; postId: string }
  | { type: 'media.updated'; mediaId: string }
  | { type: 'channel.updated'; channelId: string }
  | { type: 'notification'; id: string; title: string; body?: string | null };

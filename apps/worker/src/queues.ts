/** Queue names shared by the API (producer) and the worker (consumer). */
export const QUEUES = {
  maintenance: 'maintenance',
  publish: 'publish',
} as const;

export const MAINTENANCE_JOBS = {
  tokenRefreshScan: 'token-refresh-scan',
  scheduleSweep: 'schedule-sweep',
} as const;

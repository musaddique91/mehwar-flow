export type PlanId = 'free' | 'pro' | 'business' | 'unlimited';

export interface PlanLimits {
  label: string;
  /** Monthly price in USD, for display. */
  priceUsd: number;
  channels: number;
  scheduledPosts: number;
  storageBytes: number;
  aiCreditsPerMonth: number;
}

const GB = 1024 ** 3;

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    label: 'Free',
    priceUsd: 0,
    channels: 3,
    scheduledPosts: 10,
    storageBytes: 1 * GB,
    aiCreditsPerMonth: 20,
  },
  pro: {
    label: 'Pro',
    priceUsd: 15,
    channels: 10,
    scheduledPosts: 500,
    storageBytes: 25 * GB,
    aiCreditsPerMonth: 500,
  },
  business: {
    label: 'Business',
    priceUsd: 49,
    channels: 50,
    scheduledPosts: 5000,
    storageBytes: 200 * GB,
    aiCreditsPerMonth: 5000,
  },
  /** Self-hosted installs without Stripe configured. */
  unlimited: {
    label: 'Self-hosted',
    priceUsd: 0,
    channels: Number.MAX_SAFE_INTEGER,
    scheduledPosts: Number.MAX_SAFE_INTEGER,
    storageBytes: Number.MAX_SAFE_INTEGER,
    aiCreditsPerMonth: Number.MAX_SAFE_INTEGER,
  },
};

export const PAID_PLANS = ['pro', 'business'] as const;

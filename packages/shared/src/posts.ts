import { z } from 'zod';
import { PLATFORMS, TIKTOK_PRIVACY, YOUTUBE_PRIVACY, type Platform } from './platforms';
import { isValidTimeZone } from './time';

/** Per-network options stored on a post target. All optional; validated per platform. */
export const targetOptionsSchema = z
  .object({
    /** YouTube */
    title: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    privacy: z.enum([...YOUTUBE_PRIVACY, ...TIKTOK_PRIVACY]).optional(),
    madeForKids: z.boolean().optional(),
    tags: z.array(z.string().max(100)).max(30).optional(),
    /** TikTok */
    disableComment: z.boolean().optional(),
    disableDuet: z.boolean().optional(),
    disableStitch: z.boolean().optional(),
    brandContent: z.boolean().optional(),
    brandOrganic: z.boolean().optional(),
    /** X / Threads: explicit thread blocks (otherwise auto-split). */
    threadBlocks: z.array(z.string()).max(25).optional(),
    /** Instagram */
    igMediaType: z.enum(['FEED', 'REELS', 'STORIES']).optional(),
  })
  .strict();
export type TargetOptions = z.infer<typeof targetOptionsSchema>;

export const targetInputSchema = z.object({
  channelId: z.string().uuid(),
  textOverride: z.string().max(25_000).nullish(),
  options: targetOptionsSchema.default({}),
});

export const postInputSchema = z.object({
  text: z.string().max(63_206).default(''),
  firstComment: z.string().max(2_200).nullish(),
  mediaIds: z.array(z.string().uuid()).max(20).default([]),
  targets: z.array(targetInputSchema).max(50).default([]),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const scheduleSchema = z.object({
  /** Wall-clock time in `timezone`, "YYYY-MM-DDTHH:mm". */
  localDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const slotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  minuteOfDay: z.number().int().min(0).max(1439),
});

export const mediaUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().regex(/^(image|video)\/[\w.+-]+$/, 'Only images and videos are supported'),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(4 * 1024 ** 3),
});

export const aiCaptionSchema = z.object({
  prompt: z.string().min(1).max(4000),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(7),
  tone: z.string().max(60).optional(),
});
export const aiRewriteSchema = z.object({
  text: z.string().min(1).max(25_000),
  platform: z.enum(PLATFORMS),
  instruction: z.string().max(500).optional(),
});

// ---------- DTOs returned by the API ----------

export type PostStatusDto =
  'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'PARTIALLY_FAILED' | 'FAILED';
export type TargetStatusDto =
  'PENDING' | 'QUEUED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELED';

export interface MediaDto {
  id: string;
  fileName: string;
  mimeType: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  url: string | null;
  thumbnailUrl: string | null;
  processingError: string | null;
  createdAt: string;
}

export interface PostTargetDto {
  id: string;
  channelId: string;
  platform: Platform;
  channelName: string;
  textOverride: string | null;
  options: TargetOptions;
  status: TargetStatusDto;
  externalUrl: string | null;
  lastError: string | null;
  publishedAt: string | null;
}

export interface PostDto {
  id: string;
  text: string;
  firstComment: string | null;
  status: PostStatusDto;
  scheduledAt: string | null;
  timezone: string;
  media: MediaDto[];
  targets: PostTargetDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelDto {
  id: string;
  platform: Platform;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
  tokenExpiresAt: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummaryDto {
  range: { from: string; to: string };
  totals: {
    posts: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  daily: { date: string; impressions: number; engagement: number; posts: number }[];
  byPlatform: { platform: Platform; posts: number; engagement: number; followers: number | null }[];
  topPosts: {
    postId: string;
    targetId: string;
    platform: Platform;
    text: string;
    url: string | null;
    engagement: number;
  }[];
}

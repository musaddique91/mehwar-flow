/**
 * Single source of truth for per-network publishing rules. Used by the web composer (live
 * validation, disabling networks) and by the API/worker (server-side validation before publish).
 */

export const PLATFORMS = [
  'x',
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'tiktok',
  'snapchat',
] as const;
export type Platform = (typeof PLATFORMS)[number];

export type MediaKind = 'image' | 'video';

export interface PlatformRules {
  label: string;
  /** Max characters of the main text/caption. */
  maxTextLength: number;
  /** Max characters when the account has an extended limit (e.g. X Premium). */
  maxTextLengthExtended?: number;
  maxHashtags?: number;
  /** Text-only posts allowed. */
  allowsTextOnly: boolean;
  /** A video is required. */
  requiresVideo: boolean;
  maxImages: number;
  maxVideos: number;
  /** Images and videos may be mixed in one post. */
  allowsMixedMedia: boolean;
  maxVideoDurationSec?: number;
  /** Required aspect ratio (width / height) with tolerance, if any. */
  requiredAspectRatio?: { ratio: number; label: string };
  /** Links render as plain, non-clickable text. */
  linksNotClickable: boolean;
  /** Supports chaining multiple blocks into a thread. */
  supportsThreads: boolean;
  imageMimeTypes: string[];
  videoMimeTypes: string[];
}

const COMMON_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const COMMON_VIDEOS = ['video/mp4', 'video/quicktime'];

export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  x: {
    label: 'X',
    maxTextLength: 280,
    maxTextLengthExtended: 25_000,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 4,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 140,
    linksNotClickable: false,
    supportsThreads: true,
    imageMimeTypes: COMMON_IMAGES,
    videoMimeTypes: ['video/mp4'],
  },
  facebook: {
    label: 'Facebook',
    maxTextLength: 63_206,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 10,
    maxVideos: 1,
    allowsMixedMedia: false,
    linksNotClickable: false,
    supportsThreads: false,
    imageMimeTypes: COMMON_IMAGES,
    videoMimeTypes: COMMON_VIDEOS,
  },
  instagram: {
    label: 'Instagram',
    maxTextLength: 2_200,
    maxHashtags: 30,
    allowsTextOnly: false,
    requiresVideo: false,
    maxImages: 10,
    maxVideos: 10,
    allowsMixedMedia: true,
    maxVideoDurationSec: 900,
    linksNotClickable: true,
    supportsThreads: false,
    // Instagram only accepts JPEG images; the media worker converts other formats.
    imageMimeTypes: ['image/jpeg'],
    videoMimeTypes: COMMON_VIDEOS,
  },
  threads: {
    label: 'Threads',
    maxTextLength: 500,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 20,
    maxVideos: 20,
    allowsMixedMedia: true,
    maxVideoDurationSec: 300,
    linksNotClickable: false,
    supportsThreads: true,
    imageMimeTypes: ['image/jpeg', 'image/png'],
    videoMimeTypes: COMMON_VIDEOS,
  },
  youtube: {
    label: 'YouTube',
    // Title limit; description (5,000) is a platform-specific field.
    maxTextLength: 100,
    allowsTextOnly: false,
    requiresVideo: true,
    maxImages: 0,
    maxVideos: 1,
    allowsMixedMedia: false,
    linksNotClickable: false,
    supportsThreads: false,
    imageMimeTypes: [],
    videoMimeTypes: [...COMMON_VIDEOS, 'video/webm', 'video/x-msvideo'],
  },
  tiktok: {
    label: 'TikTok',
    maxTextLength: 2_200,
    allowsTextOnly: false,
    requiresVideo: true,
    maxImages: 0,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 600,
    linksNotClickable: true,
    supportsThreads: false,
    imageMimeTypes: [],
    videoMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  snapchat: {
    label: 'Snapchat',
    maxTextLength: 250,
    allowsTextOnly: false,
    requiresVideo: false,
    maxImages: 1,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 60,
    requiredAspectRatio: { ratio: 9 / 16, label: '9:16' },
    linksNotClickable: true,
    supportsThreads: false,
    imageMimeTypes: ['image/jpeg', 'image/png'],
    videoMimeTypes: ['video/mp4', 'video/quicktime'],
  },
};

export const YOUTUBE_DESCRIPTION_MAX = 5_000;
export const YOUTUBE_PRIVACY = ['public', 'private', 'unlisted'] as const;
export const TIKTOK_PRIVACY = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
] as const;

import { PLATFORM_RULES, type MediaKind, type Platform } from './platforms';

export interface DraftMedia {
  kind: MediaKind;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface DraftForPlatform {
  text: string;
  media: DraftMedia[];
  /** Extended text limit enabled (e.g. user has X Premium). */
  extendedTextLimit?: boolean;
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  platform: Platform;
  severity: IssueSeverity;
  code: string;
  message: string;
}

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/i;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const ASPECT_TOLERANCE = 0.02;

/**
 * Counts characters the way users perceive them (grapheme clusters), so an emoji counts as 1.
 * X additionally weighs URLs as 23 chars; that is handled by the X connector preview.
 */
export function countCharacters(text: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return Array.from(text).length;
  let n = 0;
  for (const _ of new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) n++;
  return n;
}

export function countHashtags(text: string): number {
  return text.match(HASHTAG_RE)?.length ?? 0;
}

export function maxTextLength(platform: Platform, extended = false): number {
  const rules = PLATFORM_RULES[platform];
  return extended && rules.maxTextLengthExtended
    ? rules.maxTextLengthExtended
    : rules.maxTextLength;
}

export function validateForPlatform(
  platform: Platform,
  draft: DraftForPlatform,
): ValidationIssue[] {
  const rules = PLATFORM_RULES[platform];
  const issues: ValidationIssue[] = [];
  const add = (severity: IssueSeverity, code: string, message: string) =>
    issues.push({ platform, severity, code, message });

  const images = draft.media.filter((m) => m.kind === 'image');
  const videos = draft.media.filter((m) => m.kind === 'video');

  const limit = maxTextLength(platform, draft.extendedTextLimit);
  const length = countCharacters(draft.text);
  if (length > limit) {
    add(
      'error',
      'TEXT_TOO_LONG',
      `${rules.label} allows ${limit} characters (currently ${length}).`,
    );
  }

  if (rules.maxHashtags !== undefined && countHashtags(draft.text) > rules.maxHashtags) {
    add(
      'error',
      'TOO_MANY_HASHTAGS',
      `${rules.label} allows at most ${rules.maxHashtags} hashtags.`,
    );
  }

  if (draft.media.length === 0) {
    if (rules.requiresVideo) add('error', 'VIDEO_REQUIRED', `${rules.label} requires a video.`);
    else if (!rules.allowsTextOnly)
      add('error', 'MEDIA_REQUIRED', `${rules.label} requires an image or video.`);
    else if (draft.text.trim() === '')
      add('error', 'EMPTY_POST', 'Write something or attach media.');
  } else if (rules.requiresVideo && videos.length === 0) {
    add('error', 'VIDEO_REQUIRED', `${rules.label} requires a video.`);
  }

  if (images.length > rules.maxImages) {
    add(
      'error',
      'TOO_MANY_IMAGES',
      rules.maxImages === 0
        ? `${rules.label} does not accept images.`
        : `${rules.label} allows at most ${rules.maxImages} images.`,
    );
  }
  if (videos.length > rules.maxVideos) {
    add('error', 'TOO_MANY_VIDEOS', `${rules.label} allows at most ${rules.maxVideos} video(s).`);
  }
  if (!rules.allowsMixedMedia && images.length > 0 && videos.length > 0) {
    add(
      'error',
      'MIXED_MEDIA',
      `${rules.label} does not allow mixing images and videos in one post.`,
    );
  }

  for (const m of draft.media) {
    const allowed = m.kind === 'image' ? rules.imageMimeTypes : rules.videoMimeTypes;
    if (allowed.length > 0 && !allowed.includes(m.mimeType)) {
      add(
        'warning',
        'MEDIA_WILL_BE_CONVERTED',
        `${m.mimeType} will be converted for ${rules.label}.`,
      );
    }
    if (
      m.kind === 'video' &&
      rules.maxVideoDurationSec &&
      m.durationSec !== undefined &&
      m.durationSec > rules.maxVideoDurationSec
    ) {
      add(
        'error',
        'VIDEO_TOO_LONG',
        `${rules.label} videos must be at most ${rules.maxVideoDurationSec} seconds.`,
      );
    }
    if (rules.requiredAspectRatio && m.width && m.height) {
      const ratio = m.width / m.height;
      if (Math.abs(ratio - rules.requiredAspectRatio.ratio) > ASPECT_TOLERANCE) {
        add(
          'error',
          'WRONG_ASPECT_RATIO',
          `${rules.label} requires vertical ${rules.requiredAspectRatio.label} media.`,
        );
      }
    }
  }

  if (rules.linksNotClickable && URL_RE.test(draft.text)) {
    add(
      'warning',
      'LINKS_NOT_CLICKABLE',
      `Links are not clickable on ${rules.label}; they show as plain text.`,
    );
  }

  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/**
 * Splits long text into thread blocks (Threads/X), preferring paragraph and sentence boundaries.
 */
export function splitIntoThread(text: string, limit: number): string[] {
  const blocks: string[] = [];
  let current = '';
  const pieces = text
    .split(/\n{2,}/)
    .flatMap((para) => para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [para])
    .map((s) => s.trim())
    .filter(Boolean);

  const push = () => {
    if (current) blocks.push(current);
    current = '';
  };

  for (const piece of pieces) {
    if (countCharacters(piece) > limit) {
      push();
      // Hard-wrap an over-long sentence on word boundaries.
      for (const word of piece.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (countCharacters(candidate) <= limit) current = candidate;
        else {
          push();
          current =
            countCharacters(word) > limit ? Array.from(word).slice(0, limit).join('') : word;
        }
      }
      continue;
    }
    const candidate = current ? `${current} ${piece}` : piece;
    if (countCharacters(candidate) <= limit) current = candidate;
    else {
      push();
      current = piece;
    }
  }
  push();
  return blocks;
}

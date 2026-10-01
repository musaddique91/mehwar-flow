import { validateForPlatform, type TargetOptions, type ValidationIssue } from '@mehwar/shared';
import type { PostWithRelations } from './posts.mapper';

/**
 * Server-side validation of every target of a post, using the real media metadata. Returns all
 * issues; callers block on `severity === 'error'`.
 */
export function validatePost(
  post: PostWithRelations,
  extendedTextLimit: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const notReady = post.media.filter((m) => m.media.status !== 'READY');
  const media = post.media.map(({ media: m }) => ({
    kind: (m.mimeType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(m.fileName)
      ? 'video'
      : 'image') as 'image' | 'video',
    mimeType: m.mimeType,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    durationSec: m.durationSec ?? undefined,
  }));

  for (const t of post.targets) {
    const platform = t.channel.platform;
    const options = (t.options ?? {}) as TargetOptions;
    const add = (code: string, message: string) =>
      issues.push({ platform, severity: 'error', code, message });

    if (t.channel.status !== 'ACTIVE')
      add('CHANNEL_INACTIVE', `${t.channel.displayName} needs to be reconnected.`);
    if (notReady.length > 0)
      add('MEDIA_NOT_READY', 'Some media is still processing or failed to process.');

    const text = t.textOverride ?? post.text;
    // Thread blocks are checked individually; the whole text may exceed one post.
    const blocks = options.threadBlocks?.length ? options.threadBlocks : null;
    if (blocks) {
      for (const block of blocks) {
        issues.push(
          ...validateForPlatform(platform, { text: block, media: [], extendedTextLimit }).filter(
            (i) => i.code === 'TEXT_TOO_LONG',
          ),
        );
      }
      issues.push(
        ...validateForPlatform(platform, {
          text: blocks[0] ?? '',
          media,
          extendedTextLimit,
        }).filter((i) => i.code !== 'TEXT_TOO_LONG'),
      );
    } else if (platform === 'threads' || platform === 'x') {
      // Long text is auto-split into a thread, so only media rules apply here.
      issues.push(
        ...validateForPlatform(platform, { text: text.slice(0, 1), media, extendedTextLimit }),
      );
    } else {
      issues.push(
        ...validateForPlatform(platform, {
          text: platform === 'youtube' ? (options.title ?? text.split('\n')[0] ?? '') : text,
          media,
          extendedTextLimit,
        }),
      );
    }

    if (platform === 'youtube' && options.madeForKids === undefined) {
      add(
        'MADE_FOR_KIDS_REQUIRED',
        'Say whether this YouTube video is made for kids (required by COPPA).',
      );
    }
    if (platform === 'tiktok' && !options.privacy)
      add('PRIVACY_REQUIRED', 'Choose who can view this TikTok.');
  }
  return issues;
}

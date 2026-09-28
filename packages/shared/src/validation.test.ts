import { describe, expect, it } from 'vitest';
import {
  countCharacters,
  hasBlockingIssues,
  splitIntoThread,
  validateForPlatform,
} from './validation';

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('validateForPlatform', () => {
  it('enforces the X 280 limit and the Premium extension', () => {
    const text = 'a'.repeat(281);
    expect(codes(validateForPlatform('x', { text, media: [] }))).toContain('TEXT_TOO_LONG');
    expect(validateForPlatform('x', { text, media: [], extendedTextLimit: true })).toEqual([]);
  });

  it('counts emoji as a single character', () => {
    expect(countCharacters('👍🏽ok')).toBe(3);
    expect(validateForPlatform('x', { text: '😀'.repeat(280), media: [] })).toEqual([]);
  });

  it('requires a video for TikTok and YouTube', () => {
    for (const p of ['tiktok', 'youtube'] as const) {
      expect(codes(validateForPlatform(p, { text: 'hi', media: [] }))).toContain('VIDEO_REQUIRED');
      expect(
        codes(
          validateForPlatform(p, {
            text: 'hi',
            media: [{ kind: 'image', mimeType: 'image/jpeg' }],
          }),
        ),
      ).toContain('VIDEO_REQUIRED');
    }
    const ok = validateForPlatform('tiktok', {
      text: 'hi',
      media: [{ kind: 'video', mimeType: 'video/mp4', durationSec: 30 }],
    });
    expect(hasBlockingIssues(ok)).toBe(false);
  });

  it('blocks text-only Instagram posts and more than 30 hashtags, warns about links', () => {
    expect(codes(validateForPlatform('instagram', { text: 'hello', media: [] }))).toContain(
      'MEDIA_REQUIRED',
    );
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
    const media = [{ kind: 'image' as const, mimeType: 'image/jpeg' }];
    expect(codes(validateForPlatform('instagram', { text: tags, media }))).toContain(
      'TOO_MANY_HASHTAGS',
    );
    const linkIssues = validateForPlatform('instagram', { text: 'see https://example.com', media });
    expect(codes(linkIssues)).toEqual(['LINKS_NOT_CLICKABLE']);
    expect(hasBlockingIssues(linkIssues)).toBe(false);
  });

  it('enforces 9:16 and 60s for Snapchat', () => {
    const horizontal = {
      kind: 'video' as const,
      mimeType: 'video/mp4',
      width: 1920,
      height: 1080,
      durationSec: 30,
    };
    const long = {
      kind: 'video' as const,
      mimeType: 'video/mp4',
      width: 1080,
      height: 1920,
      durationSec: 61,
    };
    expect(codes(validateForPlatform('snapchat', { text: '', media: [horizontal] }))).toContain(
      'WRONG_ASPECT_RATIO',
    );
    expect(codes(validateForPlatform('snapchat', { text: '', media: [long] }))).toEqual([
      'VIDEO_TOO_LONG',
    ]);
  });

  it('rejects empty text-only posts and mixed media where unsupported', () => {
    expect(codes(validateForPlatform('facebook', { text: '  ', media: [] }))).toEqual([
      'EMPTY_POST',
    ]);
    const mixed = [
      { kind: 'image' as const, mimeType: 'image/jpeg' },
      { kind: 'video' as const, mimeType: 'video/mp4' },
    ];
    expect(codes(validateForPlatform('x', { text: 'x', media: mixed }))).toContain('MIXED_MEDIA');
    expect(hasBlockingIssues(validateForPlatform('threads', { text: 'x', media: mixed }))).toBe(
      false,
    );
  });
});

describe('splitIntoThread', () => {
  it('keeps every block within the limit and preserves content order', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const blocks = splitIntoThread(text, 500);
    expect(blocks.length).toBeGreaterThan(1);
    for (const b of blocks) expect(countCharacters(b)).toBeLessThanOrEqual(500);
    expect(blocks.join(' ')).toBe(text);
  });

  it('hard-wraps a single over-long sentence', () => {
    const blocks = splitIntoThread('word '.repeat(300).trim(), 100);
    for (const b of blocks) expect(b.length).toBeLessThanOrEqual(100);
    expect(blocks.join(' ').split(' ').length).toBe(300);
  });

  it('returns a single block when text fits', () => {
    expect(splitIntoThread('Short post.', 500)).toEqual(['Short post.']);
  });
});

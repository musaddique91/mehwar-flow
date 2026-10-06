'use client';

import {
  Bookmark,
  CheckCheck,
  Ellipsis,
  Heart,
  Lock,
  MessageCircle,
  Music2,
  Play,
  Repeat2,
  Send,
  Share,
  ThumbsUp,
} from 'lucide-react';
import { PLATFORM_RULES, splitIntoThread, type Platform } from '@mehwar/shared';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

export interface PreviewProps {
  platform: Platform;
  text: string;
  name: string;
  handle: string;
  /** Thumbnail/image URL of the first attached media. */
  mediaUrl?: string | null;
  /** Direct video URL — used by YouTube preview to show a playable video. */
  videoUrl?: string | null;
  /** Platform-specific target options (e.g. whatsappPostType) */
  options?: Record<string, unknown>;
  className?: string;
}

/** The attached media, or a colourful placeholder when nothing is attached yet. */
function MediaPlaceholder({
  platform,
  tall = false,
  url,
}: {
  platform: Platform;
  tall?: boolean;
  url?: string | null;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={cn('w-full object-cover', tall ? 'aspect-[9/16]' : 'aspect-square')}
      />
    );
  }
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        tall ? 'aspect-[9/16]' : 'aspect-square',
      )}
      style={{ background: PLATFORM_BRAND[platform].gradient }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
      <PlatformIcon platform={platform} className="size-10 text-white/70 drop-shadow" />
    </div>
  );
}

function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <p className={cn('whitespace-pre-wrap break-words', className)}>
      {parts.map((p, i) =>
        /^[#@]\w+/.test(p) || /^https?:\/\//.test(p) ? (
          <span key={i} className="text-sky-400">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </p>
  );
}

const placeholder = 'Your post will appear here ✨';

export function PostPreview({
  platform,
  text,
  name,
  handle,
  mediaUrl,
  videoUrl,
  options,
  className,
}: PreviewProps) {
  const body = text.trim() || placeholder;
  const frame = 'rounded-2xl border border-line bg-elevated text-[14px] text-fg shadow-xl';

  switch (platform) {
    case 'x':
      return (
        <div className={cn(frame, 'p-4', className)}>
          <div className="flex gap-3">
            <Avatar name={name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-bold">{name}</span>
                <span className="truncate text-muted">@{handle} · now</span>
              </div>
              <RichText text={body} className="mt-1 leading-snug" />
              {mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt=""
                  className="mt-2 max-h-72 w-full rounded-2xl border border-line object-cover"
                />
              )}
              <div className="mt-3 flex justify-between pr-6 text-muted">
                <MessageCircle className="size-4" />
                <Repeat2 className="size-4" />
                <Heart className="size-4" />
                <Share className="size-4" />
              </div>
            </div>
          </div>
        </div>
      );
    case 'threads': {
      const blocks = splitIntoThread(body, PLATFORM_RULES.threads.maxTextLength);
      return (
        <div className={cn(frame, 'p-4', className)}>
          {blocks.map((block, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Avatar name={name} size={36} />
                {i < blocks.length - 1 && <div className="my-1 w-0.5 flex-1 rounded bg-line" />}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{handle}</span>
                  <span className="text-xs text-muted">
                    {blocks.length > 1 ? `${i + 1}/${blocks.length}` : 'now'}
                  </span>
                </div>
                <RichText text={block} className="mt-0.5 leading-snug" />
                <div className="mt-2 flex gap-4 text-muted">
                  <Heart className="size-4" />
                  <MessageCircle className="size-4" />
                  <Repeat2 className="size-4" />
                  <Send className="size-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'instagram':
      return (
        <div className={cn(frame, 'overflow-hidden', className)}>
          <div className="flex items-center gap-2.5 p-3">
            <span
              className="rounded-full p-[2px]"
              style={{ background: PLATFORM_BRAND.instagram.gradient }}
            >
              <Avatar name={name} size={30} className="ring-2 ring-[var(--bg-elevated)]" />
            </span>
            <span className="flex-1 text-sm font-semibold">{handle}</span>
            <Ellipsis className="size-4 text-muted" />
          </div>
          <MediaPlaceholder platform="instagram" url={mediaUrl} />
          <div className="space-y-2 p-3">
            <div className="flex gap-4">
              <Heart className="size-5" />
              <MessageCircle className="size-5" />
              <Send className="size-5" />
              <Bookmark className="ml-auto size-5" />
            </div>
            <p className="line-clamp-3 text-sm">
              <span className="mr-1.5 font-semibold">{handle}</span>
              {body}
            </p>
          </div>
        </div>
      );
    case 'facebook':
      return (
        <div className={cn(frame, 'overflow-hidden', className)}>
          <div className="flex items-center gap-2.5 p-3">
            <Avatar name={name} size={40} />
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted">Just now · 🌎</p>
            </div>
          </div>
          <RichText text={body} className="px-3 pb-3" />
          {mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="max-h-80 w-full object-cover" />
          )}
          <div className="grid grid-cols-3 border-t border-line text-xs font-semibold text-muted">
            {[
              [ThumbsUp, 'Like'],
              [MessageCircle, 'Comment'],
              [Share, 'Share'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof ThumbsUp;
              return (
                <span
                  key={label as string}
                  className="flex items-center justify-center gap-1.5 py-2.5"
                >
                  <I className="size-4" /> {label as string}
                </span>
              );
            })}
          </div>
        </div>
      );
    case 'tiktok':
    case 'snapchat':
      return (
        <div
          className={cn(
            'relative mx-auto w-full max-w-[260px] overflow-hidden rounded-[2rem] border-4 border-zinc-900 shadow-2xl',
            className,
          )}
        >
          <MediaPlaceholder platform={platform} tall url={mediaUrl} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white">
            <p className="text-sm font-bold">@{handle}</p>
            <p className="mt-1 line-clamp-3 text-xs">{body}</p>
            {platform === 'tiktok' && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90">
                <Music2 className="size-3" /> original sound · {name}
              </p>
            )}
          </div>
          {platform === 'tiktok' && (
            <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 text-white">
              <Heart className="size-6 fill-white" />
              <MessageCircle className="size-6" />
              <Bookmark className="size-6" />
            </div>
          )}
        </div>
      );
    case 'youtube':
      return (
        <div className={cn(frame, 'overflow-hidden', className)}>
          <div
            className="relative aspect-video overflow-hidden bg-black/90"
            style={{ background: (mediaUrl || videoUrl) ? undefined : PLATFORM_BRAND.youtube.gradient }}
          >
            {videoUrl ? (
              // Playable video preview
              <video
                src={videoUrl}
                className="size-full object-cover"
                controls
                preload="metadata"
                poster={mediaUrl ?? undefined}
              />
            ) : mediaUrl ? (
              // Static thumbnail only (e.g. after processing when video isn't presigned)
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="" className="size-full object-cover" />
                <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-2xl bg-black/40 backdrop-blur">
                  <Play className="size-6 fill-white text-white" />
                </span>
              </>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-white/80">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                  <Play className="size-6 text-white" />
                </span>
                <span className="text-xs font-medium">Attach a video to preview YouTube player</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 p-3">
            <Avatar name={name} size={36} />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold">{body.slice(0, 100)}</p>
              <p className="mt-0.5 text-xs text-muted">{name} · 0 views · just now</p>
            </div>
          </div>
        </div>
      );
    case 'linkedin':
      return (
        <div className={cn(frame, 'overflow-hidden', className)}>
          <div className="flex items-start gap-3 p-4 pb-2">
            <Avatar name={name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-fg truncate">{name}</p>
                <Ellipsis className="size-4 text-muted shrink-0" />
              </div>
              <p className="text-xs text-muted truncate">@{handle || 'member'}</p>
              <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                <span>Just now</span>
                <span>•</span>
                <span>🌐</span>
              </p>
            </div>
          </div>
          <RichText text={body} className="px-4 py-2 text-sm leading-relaxed" />
          {mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="max-h-80 w-full object-cover border-y border-line" />
          )}
          <div className="grid grid-cols-4 border-t border-line text-xs font-semibold text-muted">
            {[
              [ThumbsUp, 'Like'],
              [MessageCircle, 'Comment'],
              [Repeat2, 'Repost'],
              [Send, 'Send'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof ThumbsUp;
              return (
                <span
                  key={label as string}
                  className="flex items-center justify-center gap-1.5 py-3 hover:text-fg transition"
                >
                  <I className="size-3.5" /> {label as string}
                </span>
              );
            })}
          </div>
        </div>
      );
    case 'whatsapp': {
      const isStatus = (options?.whatsappPostType ?? 'STATUS') === 'STATUS';
      if (isStatus) {
        return (
          <div className={cn(frame, 'overflow-hidden border border-emerald-500/20 shadow-xl bg-[#0b141a]', className)}>
            {/* WhatsApp Status Header */}
            <div className="flex items-center justify-between bg-[#1f2c34] px-3.5 py-2.5 text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="rounded-full ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#1f2c34]">
                    <Avatar name={name} size={36} />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight">{name}</p>
                  <p className="text-[11px] text-emerald-400 font-medium leading-tight">Status • Just now</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[#aebac1]">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Status
                </span>
                <PlatformIcon platform="whatsapp" className="size-4 text-[#25d366]" />
              </div>
            </div>

            {/* Status Story / Bio Preview */}
            <div className="p-4 space-y-3 bg-[#0b141a]/95 min-h-[180px] flex flex-col justify-center">
              {mediaUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-black aspect-video flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white text-xs">
                    <RichText text={body} className="line-clamp-2 text-white" />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0b3b32] to-[#04201a] p-4 text-center shadow-lg space-y-2">
                  <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                    WhatsApp About / Bio Status
                  </p>
                  <p className="text-base font-medium text-white italic break-words">
                    &ldquo;{body || 'Hey there! I am using WhatsApp.'}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className={cn(frame, 'overflow-hidden border border-emerald-500/20 shadow-xl bg-[#0b141a]', className)}>
          {/* WhatsApp Header */}
          <div className="flex items-center justify-between bg-[#1f2c34] px-3.5 py-2.5 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={name} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{name}</p>
                <p className="text-[11px] text-emerald-400 font-medium leading-tight">online</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[#aebac1]">
              <PlatformIcon platform="whatsapp" className="size-4 text-[#25d366]" />
            </div>
          </div>

          {/* Chat wallpaper & bubble */}
          <div className="p-4 space-y-3 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px] bg-[#0b141a]/95 min-h-[180px] flex flex-col justify-end">
            <div className="mx-auto rounded-lg bg-[#182229] px-3 py-1 text-[10px] text-[#ffd279] shadow-sm flex items-center gap-1.5 border border-[#ffd279]/20">
              <Lock className="size-2.5 shrink-0" />
              <span>Messages are end-to-end encrypted</span>
            </div>

            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#005c4b] text-white p-3 shadow-md space-y-2">
              {mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt=""
                  className="rounded-xl max-h-56 w-full object-cover"
                />
              )}
              <RichText text={body} className="text-xs text-[#e9edef] leading-relaxed break-words" />
              <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] pt-0.5">
                <span>Just now</span>
                <CheckCheck className="size-3.5 text-[#53bdeb]" />
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}

'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ImagePlus, Loader2, MessageSquare, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  countCharacters,
  maxTextLength,
  PLATFORM_RULES,
  splitIntoThread,
  TIKTOK_PRIVACY,
  YOUTUBE_PRIVACY,
  type ChannelDto,
  type MediaDto,
  type TargetOptions,
} from '@mehwar/shared';
import { Switch } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';
import { uploadMedia } from '@/lib/media';

export interface TargetDraft {
  textOverride: string | null;
  options: TargetOptions;
}

const TIKTOK_LABELS: Record<(typeof TIKTOK_PRIVACY)[number], string> = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  labels,
}: {
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold capitalize transition',
            value === o
              ? 'border-transparent bg-fg text-[var(--bg)]'
              : 'border-line text-muted hover:text-fg',
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

const field =
  'w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]';

/** Per-channel overrides and required platform fields (YouTube, TikTok, Instagram, threads). */
export function ChannelOptions({
  channel,
  baseText,
  draft,
  xPremium,
  onChange,
}: {
  channel: ChannelDto;
  baseText: string;
  draft: TargetDraft;
  xPremium: boolean;
  onChange: (d: TargetDraft) => void;
}) {
  const needsInput =
    (channel.platform === 'youtube' && draft.options.madeForKids === undefined) ||
    (channel.platform === 'tiktok' && !draft.options.privacy);
  const [open, setOpen] = useState(needsInput);
  const [thumbnail, setThumbnail] = useState<MediaDto | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbRef = useRef<HTMLInputElement>(null);
  const set = (options: Partial<TargetOptions>) =>
    onChange({ ...draft, options: { ...draft.options, ...options } });
  const text = draft.textOverride ?? baseText;
  const limit = maxTextLength(channel.platform, xPremium);
  const isThread = channel.platform === 'threads' || channel.platform === 'x';
  const blocks = isThread ? (draft.options.threadBlocks ?? splitIntoThread(text, limit)) : [];

  return (
    <div className={cn('rounded-2xl border', needsInput ? 'border-amber-400/60' : 'border-line')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold"
      >
        <PlatformIcon platform={channel.platform} className="size-4" />
        <span className="flex-1 truncate">
          {channel.displayName}
          {needsInput && (
            <span className="ml-2 text-xs font-medium text-amber-500">needs your input</span>
          )}
          {draft.textOverride !== null && (
            <span className="ml-2 text-xs font-medium text-fuchsia-400">custom text</span>
          )}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="size-4 text-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-line p-3 text-sm">
              <label className="block space-y-1">
                <span className="flex items-center justify-between text-xs font-medium text-muted">
                  Text for {PLATFORM_RULES[channel.platform].label}
                  {draft.textOverride !== null ? (
                    <button
                      type="button"
                      className="text-fuchsia-400 hover:underline"
                      onClick={() => onChange({ ...draft, textOverride: null })}
                    >
                      Use main text
                    </button>
                  ) : null}
                </span>
                <textarea
                  value={text}
                  onChange={(e) => onChange({ ...draft, textOverride: e.target.value })}
                  rows={3}
                  className={field}
                />
                {!isThread && (
                  <span
                    className={cn(
                      'text-[11px]',
                      countCharacters(text) > limit ? 'text-red-400' : 'text-muted',
                    )}
                  >
                    {countCharacters(text)} / {limit}
                  </span>
                )}
              </label>

              {isThread && blocks.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted">
                    Posted as a thread of {blocks.length}
                  </span>
                  {blocks.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-line text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <textarea
                        value={b}
                        rows={2}
                        onChange={(e) => {
                          const next = [...blocks];
                          next[i] = e.target.value;
                          set({ threadBlocks: next });
                        }}
                        className={field}
                      />
                    </div>
                  ))}
                  {draft.options.threadBlocks && (
                    <button
                      type="button"
                      className="text-xs text-fuchsia-400 hover:underline"
                      onClick={() => set({ threadBlocks: undefined })}
                    >
                      Reset automatic split
                    </button>
                  )}
                </div>
              )}

              {channel.platform === 'youtube' && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted">Video title (max 100)</span>
                    <input
                      maxLength={100}
                      value={draft.options.title ?? ''}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder={text.split('\n')[0]?.slice(0, 100)}
                      className={field}
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted">Visibility</span>
                    <Segmented
                      value={
                        (draft.options.privacy as (typeof YOUTUBE_PRIVACY)[number]) ?? 'private'
                      }
                      options={YOUTUBE_PRIVACY}
                      onChange={(v) => set({ privacy: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      Is this video made for kids? (required by law)
                    </span>
                    <Segmented
                      value={
                        draft.options.madeForKids === undefined
                          ? undefined
                          : draft.options.madeForKids
                            ? 'yes'
                            : 'no'
                      }
                      options={['yes', 'no'] as const}
                      labels={{ yes: "Yes, it's made for kids", no: 'No' }}
                      onChange={(v) => set({ madeForKids: v === 'yes' })}
                    />
                  </div>
                  {/* Custom Thumbnail */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted">Custom thumbnail (optional)</span>
                    {thumbnail ? (
                      <div className="relative w-full overflow-hidden rounded-xl border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnail.thumbnailUrl ?? thumbnail.url ?? undefined}
                          alt="Thumbnail"
                          className="aspect-video w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnail(null);
                            set({ thumbnailMediaId: undefined });
                          }}
                          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                          aria-label="Remove thumbnail"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={thumbUploading}
                        onClick={() => thumbRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-medium text-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
                      >
                        {thumbUploading ? (
                          <><Loader2 className="size-4 animate-spin" /> Uploading…</>
                        ) : (
                          <><ImagePlus className="size-4" /> Upload thumbnail image</>  
                        )}
                      </button>
                    )}
                    <input
                      ref={thumbRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setThumbUploading(true);
                        try {
                          const done = await uploadMedia(file, () => {});
                          setThumbnail(done);
                          set({ thumbnailMediaId: done.id });
                        } catch {
                          // toast is shown by uploadMedia
                        } finally {
                          setThumbUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </>
              )}

              {channel.platform === 'tiktok' && (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      Who can watch this video?
                    </span>
                    <Segmented
                      value={draft.options.privacy as (typeof TIKTOK_PRIVACY)[number] | undefined}
                      options={TIKTOK_PRIVACY}
                      labels={TIKTOK_LABELS}
                      onChange={(v) => set({ privacy: v })}
                    />
                    <p className="text-[11px] text-muted">
                      Until TikTok approves this app, only “Only me” posts are allowed.
                    </p>
                  </div>
                  {(
                    [
                      ['disableComment', 'Allow comments'],
                      ['disableDuet', 'Allow Duet'],
                      ['disableStitch', 'Allow Stitch'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>{label}</span>
                      <Switch
                        checked={!draft.options[key]}
                        onChange={(v) => set({ [key]: !v } as Partial<TargetOptions>)}
                        label={label}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span>Promotes my own brand</span>
                    <Switch
                      checked={!!draft.options.brandOrganic}
                      onChange={(v) => set({ brandOrganic: v })}
                      label="Your brand"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Paid partnership</span>
                    <Switch
                      checked={!!draft.options.brandContent}
                      onChange={(v) => set({ brandContent: v })}
                      label="Branded content"
                    />
                  </div>
                </>
              )}

              {channel.platform === 'instagram' && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted">Post as</span>
                  <Segmented
                    value={draft.options.igMediaType ?? 'FEED'}
                    options={['FEED', 'REELS', 'STORIES'] as const}
                    labels={{ FEED: 'Post', REELS: 'Reel', STORIES: 'Story' }}
                    onChange={(v) => set({ igMediaType: v })}
                  />
                </div>
              )}

              {channel.platform === 'whatsapp' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted">WhatsApp Action</span>
                    <Segmented
                      value={draft.options.whatsappPostType ?? 'STATUS'}
                      options={['STATUS', 'MESSAGE'] as const}
                      labels={{ STATUS: 'Set Status', MESSAGE: 'Send Message' }}
                      onChange={(v) => set({ whatsappPostType: v })}
                    />
                  </div>

                  {(draft.options.whatsappPostType ?? 'STATUS') === 'STATUS' ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1 text-muted">
                      <p className="font-semibold text-fg flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-emerald-500" />
                        WhatsApp Profile Status (About / Bio)
                      </p>
                      <p>
                        When published, updates your WhatsApp profile bio / About status using{' '}
                        <code className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-[11px] text-emerald-500 dark:text-emerald-400">
                          client.setStatus()
                        </code>{' '}
                        and broadcasts to your WhatsApp status story.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted">
                          Recipient Phone Number (optional)
                        </span>
                        <input
                          type="tel"
                          placeholder="+971501234567 (or leave empty to send to own number)"
                          value={draft.options.whatsappRecipient ?? ''}
                          onChange={(e) => set({ whatsappRecipient: e.target.value })}
                          className={field}
                        />
                      </label>
                      <p className="text-[11px] text-muted">
                        Dispatches this post directly as a WhatsApp message to the specified recipient.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

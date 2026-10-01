'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarClock,
  ImagePlus,
  Images,
  Info,
  Link2,
  MessageSquarePlus,
  Save,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import {
  countCharacters,
  hasBlockingIssues,
  maxTextLength,
  PLATFORM_RULES,
  validateForPlatform,
  type ChannelDto,
  type MediaDto,
  type PostDto,
  type UserDto,
  type ValidationIssue,
  utcToZonedLocal,
} from '@mehwar/shared';
import { Avatar, Button, Card, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi, useLiveEvent } from '@/lib/hooks';
import { uploadMedia } from '@/lib/media';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';
import { AiPanel } from './AiPanel';
import { ChannelOptions, type TargetDraft } from './ChannelOptions';
import { EmojiPicker } from './EmojiPicker';
import { MediaTray, type PendingUpload } from './MediaTray';
import { PostPreview } from './PostPreview';
import { ScheduleModal } from './ScheduleModal';

/** Circular character counter, like X's. */
export function CharRing({
  count,
  limit,
  size = 26,
}: {
  count: number;
  limit: number;
  size?: number;
}) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(count / limit, 1);
  const remaining = limit - count;
  const warn = remaining <= Math.max(10, limit * 0.1);
  const color = remaining < 0 ? '#ef4444' : warn ? '#f59e0b' : '#d946ef';
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={2.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - ratio), stroke: color }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </svg>
      {warn && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute text-[9px] font-bold tabular-nums"
          style={{ color }}
        >
          {remaining < -99 ? '-99+' : remaining}
        </motion.span>
      )}
    </span>
  );
}

const emptyDraft = (): TargetDraft => ({ textOverride: null, options: {} });

function MediaLibraryPicker({
  open,
  onClose,
  selected,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onPick: (m: MediaDto) => void;
}) {
  const { data } = useApi<MediaDto[]>(open ? '/media' : null, ['media']);
  const ready = (data ?? []).filter((m) => m.status === 'READY' && !selected.includes(m.id));
  return (
    <Modal open={open} onClose={onClose} title="Media library">
      {ready.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No other media yet. Upload photos or videos from the composer.
        </p>
      ) : (
        <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
          {ready.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="group relative aspect-square overflow-hidden rounded-xl bg-line"
            >
              {m.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbnailUrl}
                  alt={m.fileName}
                  className="size-full object-cover transition group-hover:scale-105"
                />
              )}
              {m.kind === 'video' && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                  video
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function Composer({
  user,
  channels,
  editing,
  onDone,
  initialText,
  focusedChannelId,
}: {
  user: UserDto;
  channels: ChannelDto[];
  /** Post being edited, or null for a new post. */
  editing: PostDto | null;
  onDone: () => void;
  initialText?: string;
  focusedChannelId?: string | null;
}) {
  const active = channels.filter((c) => c.status === 'ACTIVE');
  const [text, setText] = useState(editing?.text ?? initialText ?? '');
  const [firstComment, setFirstComment] = useState<string | null>(editing?.firstComment ?? null);
  const [selected, setSelected] = useState<string[]>(() => {
    if (editing) return editing.targets.map((t) => t.channelId);
    if (focusedChannelId) return [focusedChannelId];
    return [];
  });
  const [drafts, setDrafts] = useState<Record<string, TargetDraft>>(() =>
    Object.fromEntries(
      (editing?.targets ?? []).map((t) => [
        t.channelId,
        { textOverride: t.textOverride, options: t.options },
      ]),
    ),
  );
  const [media, setMedia] = useState<MediaDto[]>(editing?.media ?? []);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [focused, setFocused] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState<null | 'draft' | 'schedule' | 'now'>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiStatus = useApi<{ enabled: boolean }>('/ai/status');

  const expanded = focused || text.length > 0 || media.length > 0 || editing !== null;
  const handle =
    user.email
      .split('@')[0]!
      .replace(/[^a-z0-9_.]/gi, '')
      .toLowerCase() || 'you';
  const selectedChannels = active.filter((c) => selected.includes(c.id));
  const platforms = [...new Set(selectedChannels.map((c) => c.platform))];
  const draftOf = (id: string) => {
    const d = drafts[id] ?? emptyDraft();
    const ch = channels.find((c) => c.id === id);
    if (ch?.platform === 'youtube' && d.options.madeForKids === undefined) {
      return { ...d, options: { ...d.options, madeForKids: false } };
    }
    return d;
  };

  // Keep processing media fresh when the worker reports progress.
  useLiveEvent((event) => {
    if (event.type !== 'media.updated' || !media.some((m) => m.id === event.mediaId)) return;
    void api<MediaDto>(`/media/${event.mediaId}`).then((fresh) =>
      setMedia((cur) => cur.map((m) => (m.id === fresh.id ? fresh : m))),
    );
  });

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (focusedChannelId && !editing) {
      setSelected([focusedChannelId]);
      setPreview(focusedChannelId);
    }
  }, [focusedChannelId, editing]);

  const issues = useMemo(() => {
    const pendingVideos = uploads.filter((u) => /\.(mp4|mov|webm|mkv|avi)$/i.test(u.name));
    const pendingImages = uploads.filter((u) => !/\.(mp4|mov|webm|mkv|avi)$/i.test(u.name));

    const mediaMeta = [
      ...media.map((m) => ({
        kind: m.kind,
        mimeType: m.mimeType,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
        durationSec: m.durationSec ?? undefined,
      })),
      ...pendingVideos.map((u) => ({
        kind: 'video' as const,
        mimeType: 'video/mp4',
        width: undefined,
        height: undefined,
        durationSec: undefined,
      })),
      ...pendingImages.map((u) => ({
        kind: 'image' as const,
        mimeType: 'image/jpeg',
        width: undefined,
        height: undefined,
        durationSec: undefined,
      })),
    ];

    const out: ValidationIssue[] = [];
    for (const c of selectedChannels) {
      const d = draftOf(c.id);
      const t = d.textOverride ?? text;
      const isThread = c.platform === 'x' || c.platform === 'threads';
      const found = validateForPlatform(c.platform, {
        text: c.platform === 'youtube' ? (d.options.title ?? t.split('\n')[0] ?? '') : t,
        media: mediaMeta,
        extendedTextLimit: user.xPremium,
      }).filter((i) => !(isThread && i.code === 'TEXT_TOO_LONG'));
      out.push(...found);
      if (c.platform === 'youtube' && d.options.madeForKids === undefined) {
        out.push({
          platform: 'youtube',
          severity: 'error',
          code: 'KIDS',
          message: 'Choose whether the YouTube video is made for kids.',
        });
      }
      if (c.platform === 'tiktok' && !d.options.privacy) {
        out.push({
          platform: 'tiktok',
          severity: 'error',
          code: 'PRIVACY',
          message: 'Choose who can watch the TikTok.',
        });
      }
    }
    if (media.some((m) => m.status === 'FAILED')) {
      out.push({
        platform: platforms[0] ?? 'x',
        severity: 'error',
        code: 'MEDIA_FAILED',
        message: 'Remove media that failed to process.',
      });
    }
    // De-duplicate identical messages across channels of the same network.
    return out.filter(
      (i, idx) =>
        out.findIndex((j) => j.platform === i.platform && j.message === i.message) === idx,
    );
  }, [selectedChannels, drafts, text, media, uploads, user.xPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocking =
    hasBlockingIssues(issues) ||
    selectedChannels.length === 0 ||
    (!text.trim() && media.length === 0 && uploads.length === 0);
  const processing =
    media.some((m) => m.status !== 'READY' && m.status !== 'FAILED') || uploads.length > 0;
  const previewChannel = selectedChannels.find((c) => c.id === preview) ?? selectedChannels[0];

  function toggleChannel(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setPreview(id);
  }

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const isMedia =
        /^(image|video)\//.test(file.type) ||
        /\.(mp4|mov|webm|mkv|avi|jpg|jpeg|png|webp|gif)$/i.test(file.name);
      if (!isMedia) {
        toast.error(`${file.name} is not an image or video`);
        continue;
      }
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        const done = await uploadMedia(file, (p) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))),
        );
        setMedia((m) => [...m, done]);
      } catch (err) {
        const e = err as ApiError;
        toast.error(`Could not upload ${file.name}`, {
          description:
            e.body?.code === 'PLAN_LIMIT' ? 'Your storage is full for your plan.' : e.message,
        });
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  function insertAtCursor(value: string) {
    const el = textareaRef.current;
    if (!el) return setText((t) => t + value);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + value + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + value.length;
    });
  }

  function payload() {
    return {
      text,
      firstComment: firstComment?.trim() ? firstComment : null,
      mediaIds: media.map((m) => m.id),
      targets: selectedChannels.map((c) => ({
        channelId: c.id,
        textOverride: draftOf(c.id).textOverride,
        options: draftOf(c.id).options,
      })),
    };
  }

  async function save(): Promise<PostDto> {
    return editing
      ? api<PostDto>(`/posts/${editing.id}`, { method: 'PATCH', json: payload() })
      : api<PostDto>('/posts', { method: 'POST', json: payload() });
  }

  function reset() {
    setText('');
    setFirstComment(null);
    setMedia([]);
    setDrafts({});
    setServerIssues([]);
    setFocused(false);
    onDone();
  }

  async function run(kind: 'draft' | 'schedule' | 'now', localDateTime?: string) {
    setBusy(kind);
    setServerIssues([]);
    let saved: PostDto | null = null;
    try {
      saved = await save();
      if (kind === 'schedule') {
        await api(`/posts/${saved.id}/schedule`, {
          method: 'POST',
          json: { localDateTime, timezone: user.timezone },
        });
        toast.success('Scheduled ✨', {
          description: `Goes out ${localDateTime!.replace('T', ' at ')}`,
        });
      } else if (kind === 'now') {
        await api(`/posts/${saved.id}/publish-now`, { method: 'POST' });
        toast.success('Publishing now 🚀', {
          description: 'Watch the status update live in your feed.',
        });
      } else {
        toast.success(editing ? 'Changes saved' : 'Draft saved');
      }
      setScheduleOpen(false);
      invalidate('posts');
      reset();
    } catch (err) {
      const e = err as ApiError;
      if (saved && !editing) invalidate('posts'); // the draft exists even if scheduling failed
      if (e.body?.issues) setServerIssues(e.body.issues as ValidationIssue[]);
      toast.error(
        e.body?.code === 'PLAN_LIMIT' ? 'Plan limit reached' : 'Could not save the post',
        { description: e.message },
      );
    } finally {
      setBusy(null);
    }
  }

  const shownIssues = [
    ...issues,
    ...serverIssues.filter((s) => !issues.some((i) => i.message === s.message)),
  ];

  return (
    <Card
      id="compose"
      layout
      className={cn(
        'relative scroll-mt-24 bg-card-strong p-0',
        dragging && 'ring-4 ring-fuchsia-500/40',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-fuchsia-500/10 text-sm font-semibold text-fuchsia-400 backdrop-blur-sm"
          >
            Drop photos or videos to attach
          </motion.div>
        )}
      </AnimatePresence>

      {editing && (
        <div className="flex items-center justify-between border-b border-line px-5 py-2 text-xs font-semibold text-fuchsia-400">
          Editing a {editing.status.toLowerCase()} post
          <button
            type="button"
            onClick={reset}
            className="text-muted hover:text-fg"
            aria-label="Stop editing"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3 p-4 sm:p-5">
        <Avatar name={user.name} size={44} />
        <motion.textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="What’s on your mind?"
          aria-label="Post text"
          animate={{ height: expanded ? 140 : 52 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="min-w-0 flex-1 resize-none bg-transparent pt-2.5 text-base leading-relaxed outline-none placeholder:text-muted/70 sm:text-lg"
        />
      </div>

      <MediaTray
        media={media}
        uploads={uploads}
        onRemove={(id) => setMedia((m) => m.filter((x) => x.id !== id))}
      />

      {/* Channel chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 sm:px-5">
        {active.length === 0 ? (
          <Link
            href="/channels"
            className="flex items-center gap-1.5 rounded-full border border-dashed border-fuchsia-400/60 px-3 py-1 text-xs font-semibold text-fuchsia-400"
          >
            <Link2 className="size-3.5" /> Connect a channel to start posting
          </Link>
        ) : (
          active.map((c) => {
            const on = selected.includes(c.id);
            const limit = maxTextLength(c.platform, user.xPremium);
            const t = draftOf(c.id).textOverride ?? text;
            return (
              <motion.button
                key={c.id}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => toggleChannel(c.id)}
                aria-pressed={on}
                title={c.displayName}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-semibold transition-all shadow-xs',
                  on
                    ? 'border-transparent bg-fg text-[var(--bg)] ring-1 ring-fg/20'
                    : 'border-line/80 bg-elevated/40 text-muted hover:border-line hover:text-fg hover:bg-elevated',
                )}
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-white shadow-xs"
                  style={{ background: on ? PLATFORM_BRAND[c.platform].gradient : 'var(--line)' }}
                >
                  <PlatformIcon platform={c.platform} className="size-2.5" />
                </span>
                <span className="max-w-28 truncate">{c.displayName}</span>
                {on && c.platform !== 'youtube' && (
                  <CharRing count={countCharacters(t)} limit={limit} size={16} />
                )}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Issues */}
      <AnimatePresence initial={false}>
        {(text.length > 0 || media.length > 0 || serverIssues.length > 0) &&
          shownIssues.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 overflow-hidden px-4 pb-3 sm:px-5"
            >
              {shownIssues.map((i) => (
                <motion.li
                  key={`${i.platform}-${i.code}-${i.message}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
                    i.severity === 'error'
                      ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  )}
                >
                  {i.severity === 'error' ? (
                    <TriangleAlert className="size-3.5 shrink-0" />
                  ) : (
                    <Info className="size-3.5 shrink-0" />
                  )}
                  <PlatformIcon platform={i.platform} className="size-3 shrink-0" />
                  {i.message}
                </motion.li>
              ))}
            </motion.ul>
          )}
      </AnimatePresence>

      {/* Per-network options + preview */}
      <AnimatePresence initial={false}>
        {expanded && selectedChannels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line"
          >
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Per network
                </span>
                {selectedChannels.map((c) => (
                  <ChannelOptions
                    key={c.id}
                    channel={c}
                    baseText={text}
                    draft={draftOf(c.id)}
                    xPremium={user.xPremium}
                    onChange={(d) => setDrafts((cur) => ({ ...cur, [c.id]: d }))}
                  />
                ))}
                {platforms.some((p) => p === 'instagram' || p === 'facebook') && (
                  <label className="block space-y-1 pt-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                      <MessageSquarePlus className="size-3.5" /> First comment (Instagram &
                      Facebook)
                    </span>
                    <textarea
                      value={firstComment ?? ''}
                      onChange={(e) => setFirstComment(e.target.value)}
                      rows={2}
                      placeholder="Hashtags or a link, posted right after"
                      className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
                    />
                  </label>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Preview
                  </span>
                  {selectedChannels.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPreview(c.id)}
                      className="relative rounded-full px-3 py-1.5"
                      aria-label={`Preview on ${c.displayName}`}
                    >
                      {previewChannel?.id === c.id && (
                        <motion.span
                          layoutId="preview-tab"
                          className="absolute inset-0 rounded-full bg-line"
                        />
                      )}
                      <PlatformIcon
                        platform={c.platform}
                        className={cn(
                          'relative size-4',
                          previewChannel?.id === c.id ? 'text-fg' : 'text-muted',
                        )}
                      />
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {previewChannel && (
                    <motion.div
                      key={previewChannel.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                    >
                      <PostPreview
                        platform={previewChannel.platform}
                        text={draftOf(previewChannel.id).textOverride ?? text}
                        name={previewChannel.displayName}
                        handle={previewChannel.username ?? handle}
                        mediaUrl={media[0]?.thumbnailUrl ?? (media[0]?.kind === 'image' ? media[0]?.url : null) ?? null}
                        videoUrl={previewChannel.platform === 'youtube' ? (media.find(m => m.kind === 'video')?.url ?? null) : null}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-0.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.12, rotate: -6 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileRef.current?.click()}
            className="rounded-full p-2.5 text-fuchsia-500 transition hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
            aria-label="Add photo or video"
          >
            <ImagePlus className="size-5" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.12, rotate: -6 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setLibraryOpen(true)}
            className="rounded-full p-2.5 text-fuchsia-500 transition hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
            aria-label="Pick from media library"
          >
            <Images className="size-5" />
          </motion.button>
          <EmojiPicker onPick={insertAtCursor} />
          {aiStatus.data?.enabled && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.12, rotate: -6 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAiOpen(true)}
              className="rounded-full p-2.5 text-fuchsia-500 transition hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
              aria-label="Write with AI"
            >
              <Sparkles className="size-5" />
            </motion.button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run('draft')}
            loading={busy === 'draft'}
            disabled={!text.trim() && media.length === 0}
          >
            <Save className="size-4" />{' '}
            <span className="hidden sm:inline">{editing ? 'Save' : 'Draft'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={blocking || processing || busy !== null}
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarClock className="size-4" /> <span className="hidden sm:inline">Schedule</span>
          </Button>
          <Button
            size="sm"
            disabled={blocking || processing || busy !== null}
            loading={busy === 'now'}
            onClick={() => run('now')}
            title={processing ? 'Wait for media to finish processing' : undefined}
          >
            <Send className="size-4" /> Post
          </Button>
        </div>
      </div>

      <ScheduleModal
        open={scheduleOpen}
        timezone={user.timezone}
        initial={
          editing?.scheduledAt && new Date(editing.scheduledAt) > new Date()
            ? utcToZonedLocal(new Date(editing.scheduledAt), user.timezone)
            : null
        }
        busy={busy === 'schedule'}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(local) => run('schedule', local)}
      />
      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        platforms={platforms}
        currentText={text}
        onUseMain={(t) => {
          setText(t);
          setAiOpen(false);
        }}
        onUseFor={(platform, t) => {
          setDrafts((cur) => {
            const next = { ...cur };
            for (const c of selectedChannels.filter((c) => c.platform === platform))
              next[c.id] = { ...(cur[c.id] ?? emptyDraft()), textOverride: t };
            return next;
          });
          toast.success(`Custom text set for ${PLATFORM_RULES[platform].label}`);
        }}
      />
      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        selected={media.map((m) => m.id)}
        onPick={(m) => setMedia((cur) => [...cur, m])}
      />
    </Card>
  );
}

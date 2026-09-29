'use client';

import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock,
  Ellipsis,
  ExternalLink,
  FilePen,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PLATFORM_RULES,
  PLATFORMS,
  type ChannelDto,
  type PostDto,
  type PostStatusDto,
  type TargetStatusDto,
} from '@mehwar/shared';
import { Stagger, StaggerItem } from '@/components/motion';
import { Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

export type { ChannelDto };

/** Instagram-stories style row: connected channels get a gradient ring, a "+" connects more. */
export function StoriesRow({ channels }: { channels: ChannelDto[] }) {
  const connectedPlatforms = new Set(channels.map((c) => c.platform));
  const missing = PLATFORMS.filter((p) => !connectedPlatforms.has(p));
  return (
    <Stagger className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1">
      {channels.map((c) => (
        <StaggerItem key={c.id} className="shrink-0">
          <Link
            href="/channels"
            className="flex w-[72px] flex-col items-center gap-2"
            title={c.displayName}
          >
            <motion.span
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.92 }}
              className="relative flex size-[68px] items-center justify-center rounded-full p-[3px]"
              style={{
                background: c.status === 'ACTIVE' ? PLATFORM_BRAND[c.platform].gradient : '#f59e0b',
              }}
            >
              <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated ring-2 ring-[var(--bg)]">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <PlatformIcon platform={c.platform} className="size-6" />
                )}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-elevated ring-2 ring-[var(--bg)]">
                <PlatformIcon platform={c.platform} className="size-3" />
              </span>
            </motion.span>
            <span
              className={cn(
                'w-full truncate text-center text-xs font-medium',
                c.status === 'ACTIVE' ? 'text-muted' : 'text-amber-500',
              )}
            >
              {c.status === 'ACTIVE' ? c.displayName : 'Reconnect'}
            </span>
          </Link>
        </StaggerItem>
      ))}
      {missing.slice(0, channels.length ? 3 : 7).map((p) => (
        <StaggerItem key={p} className="shrink-0">
          <Link
            href={`/channels?connect=${p}`}
            className="flex w-[72px] flex-col items-center gap-2"
            aria-label={`Connect ${PLATFORM_RULES[p].label}`}
          >
            <motion.span
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.92 }}
              className="relative flex size-[68px] items-center justify-center rounded-full"
            >
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-dashed border-muted/50"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              />
              <PlatformIcon platform={p} className="size-6 text-muted" />
              <span className="brand-gradient absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)]">
                <Plus className="size-3.5" strokeWidth={3} />
              </span>
            </motion.span>
            <span className="w-full truncate text-center text-xs font-medium text-muted">
              {PLATFORM_RULES[p].label}
            </span>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setShown(value), 150);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <Card whileHover={{ y: -4 }} className="relative flex items-center gap-4 overflow-hidden p-4">
      <span
        className="absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: accent }}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none tabular-nums">
          <NumberFlow value={shown} />
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
    </Card>
  );
}

const TARGET_STYLE: Record<
  TargetStatusDto,
  { label: string; className: string; icon: LucideIcon }
> = {
  PENDING: { label: 'Draft', className: 'bg-line text-muted', icon: FilePen },
  QUEUED: {
    label: 'Scheduled',
    className: 'bg-sky-500/15 text-sky-500 dark:text-sky-300',
    icon: Clock,
  },
  PUBLISHING: {
    label: 'Publishing',
    className: 'bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-300',
    icon: Loader2,
  },
  PUBLISHED: {
    label: 'Live',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    icon: CircleCheck,
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-500 dark:text-red-300',
    icon: CircleAlert,
  },
  CANCELED: { label: 'Canceled', className: 'bg-line text-muted', icon: Undo2 },
};

const POST_LABEL: Record<PostStatusDto, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHING: 'Publishing',
  PUBLISHED: 'Published',
  PARTIALLY_FAILED: 'Partly failed',
  FAILED: 'Failed',
};

function PostMenu({ post, onEdit }: { post: PostDto; onEdit: (p: PostDto) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const act = async (path: string, method: 'POST' | 'DELETE', success: string) => {
    setOpen(false);
    try {
      await api(path, { method });
      toast.success(success);
      invalidate('posts');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  };
  const editable = ['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIALLY_FAILED'].includes(post.status);
  const items: { label: string; icon: LucideIcon; run: () => void; danger?: boolean }[] = [];
  if (editable)
    items.push({ label: 'Edit', icon: Pencil, run: () => (setOpen(false), onEdit(post)) });
  if (post.status === 'SCHEDULED')
    items.push({
      label: 'Unschedule',
      icon: Undo2,
      run: () => act(`/posts/${post.id}/cancel`, 'POST', 'Moved back to drafts'),
    });
  if (post.status === 'FAILED' || post.status === 'PARTIALLY_FAILED') {
    items.push({
      label: 'Retry failed',
      icon: RotateCcw,
      run: () => act(`/posts/${post.id}/retry`, 'POST', 'Retrying now'),
    });
  }
  if (post.status !== 'PUBLISHING')
    items.push({
      label: 'Delete',
      icon: Trash2,
      danger: true,
      run: () => act(`/posts/${post.id}`, 'DELETE', 'Post deleted'),
    });
  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1.5 text-muted hover:bg-line hover:text-fg"
        aria-label="Post actions"
      >
        <Ellipsis className="size-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            className="glass absolute right-0 top-8 z-30 w-44 rounded-2xl bg-card-strong p-1.5 shadow-2xl"
          >
            {items.map((i) => (
              <button
                key={i.label}
                type="button"
                onClick={i.run}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-line',
                  i.danger && 'text-red-500 hover:bg-red-500/10',
                )}
              >
                <i.icon className="size-4" /> {i.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PostCard({
  post,
  timezone,
  onEdit,
}: {
  post: PostDto;
  timezone: string;
  onEdit: (p: PostDto) => void;
}) {
  const when = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleString(undefined, {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const thumbs = post.media.filter((m) => m.thumbnailUrl).slice(0, 4);
  return (
    <Card
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-fg">{POST_LABEL[post.status]}</span>
            {when && (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" /> {when}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[15px]">
            {post.text || <span className="italic text-muted">No text</span>}
          </p>
        </div>
        <PostMenu post={post} onEdit={onEdit} />
      </div>
      {thumbs.length > 0 && (
        <div
          className={cn(
            'grid gap-1.5 overflow-hidden rounded-2xl',
            thumbs.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {thumbs.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.thumbnailUrl!}
              alt={m.fileName}
              className="max-h-64 w-full object-cover"
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {post.targets.map((t) => {
          const s = TARGET_STYLE[t.status];
          const chip = (
            <motion.span
              layout
              key={t.status}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                s.className,
              )}
              title={t.lastError ?? undefined}
            >
              <PlatformIcon platform={t.platform} className="size-3" />
              <span className="max-w-28 truncate">{t.channelName}</span>
              <s.icon className={cn('size-3', t.status === 'PUBLISHING' && 'animate-spin')} />
              {s.label}
              {t.externalUrl && <ExternalLink className="size-3" />}
            </motion.span>
          );
          return t.externalUrl ? (
            <a key={t.id} href={t.externalUrl} target="_blank" rel="noreferrer">
              {chip}
            </a>
          ) : (
            <span key={t.id}>{chip}</span>
          );
        })}
      </div>
      {post.targets.some((t) => t.status === 'FAILED' && t.lastError) && (
        <div className="space-y-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500 dark:text-red-300">
          {post.targets
            .filter((t) => t.status === 'FAILED' && t.lastError)
            .map((t) => (
              <p key={t.id}>
                <b>{t.channelName}:</b> {t.lastError}
              </p>
            ))}
        </div>
      )}
    </Card>
  );
}

const FILTERS: { id: string; label: string; status?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled', status: 'SCHEDULED,PUBLISHING' },
  { id: 'published', label: 'Published', status: 'PUBLISHED' },
  { id: 'drafts', label: 'Drafts', status: 'DRAFT' },
  { id: 'failed', label: 'Needs attention', status: 'FAILED,PARTIALLY_FAILED' },
];

export function FeedFilters({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, status?: string) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id, f.status)}
          className="relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold"
        >
          {value === f.id && (
            <motion.span
              layoutId="feed-filter"
              className="absolute inset-0 rounded-full bg-card-strong shadow-sm ring-1 ring-line"
            />
          )}
          <span className={cn('relative', value === f.id ? 'text-fg' : 'text-muted')}>
            {f.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i} className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function EmptyFeed({ filtered }: { filtered?: boolean }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-6 h-28 w-40">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="glass absolute inset-x-4 h-16 rounded-2xl bg-card-strong p-3 shadow-lg"
            style={{ top: i * 14, zIndex: 3 - i, scale: 1 - i * 0.08 }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-2">
              <span className="brand-gradient size-6 rounded-full" />
              <span className="h-2 w-16 rounded-full bg-line" />
            </div>
            <span className="mt-2 block h-2 w-24 rounded-full bg-line" />
          </motion.div>
        ))}
      </div>
      <h3 className="text-lg font-bold">
        {filtered ? 'Nothing here yet' : 'Your feed is waiting for its first post'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Scheduled and published posts show up here with their live status on every network.
      </p>
      <a
        href="#compose"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-500 hover:underline dark:text-fuchsia-400"
      >
        <Sparkles className="size-4" /> Write a post
      </a>
    </Card>
  );
}

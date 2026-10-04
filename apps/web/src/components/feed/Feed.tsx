'use client';

import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Ellipsis,
  ExternalLink,
  FilePen,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  X,
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
import { ShareToCustomersModal } from '@/components/modals/ShareToCustomersModal';
import { Stagger, StaggerItem } from '@/components/motion';
import { Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

export type { ChannelDto };

/** Instagram-stories style row: connected channels get a gradient ring, a "+" connects more. */
export function StoriesRow({
  channels,
  selectedChannelId,
  onSelectChannel,
}: {
  channels: ChannelDto[];
  selectedChannelId?: string | null;
  onSelectChannel?: (channelId: string | null) => void;
}) {
  const connectedPlatforms = new Set(channels.map((c) => c.platform));
  const missing = PLATFORMS.filter((p) => !connectedPlatforms.has(p));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [channels]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Left arrow */}
      <AnimatePresence>
        {canScrollLeft && (
          <motion.button
            key="arr-left"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 z-10 -translate-y-[calc(50%+8px)] flex size-8 items-center justify-center rounded-full glass border-line shadow-md text-fg hover:bg-card-strong transition"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Right arrow */}
      <AnimatePresence>
        {canScrollRight && (
          <motion.button
            key="arr-right"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 z-10 -translate-y-[calc(50%+8px)] flex size-8 items-center justify-center rounded-full glass border-line shadow-md text-fg hover:bg-card-strong transition"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <div
        ref={scrollRef}
        className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1 scroll-smooth"
      >
        <Stagger className="flex gap-4">
        {/* "All" channel pill */}
        {channels.length > 0 && (
          <StaggerItem className="shrink-0">
            <button
              type="button"
              onClick={() => onSelectChannel?.(null)}
              className="flex w-[72px] flex-col items-center gap-2 group"
              title="Show all channels"
            >
              <motion.span
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  'relative flex size-[68px] items-center justify-center rounded-full p-[3px] transition',
                  !selectedChannelId
                    ? 'brand-gradient shadow-md shadow-fuchsia-500/25 ring-2 ring-fuchsia-500'
                    : 'border-2 border-line bg-card/60 hover:border-line/80',
                )}
              >
                <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated ring-2 ring-[var(--bg)]">
                  <Sparkles
                    className={cn(
                      'size-6',
                      !selectedChannelId
                        ? 'text-fuchsia-500 dark:text-fuchsia-400'
                        : 'text-muted group-hover:text-fg',
                    )}
                  />
                </span>
              </motion.span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs font-semibold',
                  !selectedChannelId ? 'text-fg font-bold' : 'text-muted group-hover:text-fg',
                )}
              >
                All
              </span>
            </button>
          </StaggerItem>
        )}

        {channels.map((c) => {
          const isSelected = selectedChannelId === c.id;
          const brand = PLATFORM_BRAND[c.platform];
          const innerContent = (
            <>
              <motion.span
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  'relative flex size-[68px] items-center justify-center rounded-full p-[3px] transition',
                  isSelected && 'ring-4 ring-fuchsia-500 shadow-lg shadow-fuchsia-500/30 scale-105',
                )}
                style={{
                  background: c.status === 'ACTIVE' ? brand.gradient : '#f59e0b',
                }}
              >
                <span
                  className="flex size-full items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--bg)]"
                  style={
                    !c.avatarUrl && c.status === 'ACTIVE'
                      ? { background: brand.color }
                      : undefined
                  }
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <PlatformIcon
                      platform={c.platform}
                      className={cn('size-7', c.status === 'ACTIVE' ? 'text-white drop-shadow-sm' : 'text-muted')}
                    />
                  )}
                </span>
                {/* Brand-colored badge in bottom-right corner */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full ring-2 ring-[var(--bg)]"
                  style={{ background: isSelected ? undefined : brand.color }}
                >
                  {isSelected ? (
                    <span className="flex size-full items-center justify-center rounded-full bg-elevated">
                      <Check className="size-3.5 text-fuchsia-500 font-bold" />
                    </span>
                  ) : (
                    <PlatformIcon platform={c.platform} className="size-3 text-white drop-shadow-sm" />
                  )}
                </span>
              </motion.span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs font-medium',
                  isSelected
                    ? 'font-bold text-fg'
                    : c.status === 'ACTIVE'
                      ? 'text-muted'
                      : 'text-amber-500',
                )}
              >
                {c.status === 'ACTIVE' ? c.displayName : 'Reconnect'}
              </span>
            </>
          );

          return (
            <StaggerItem key={c.id} className="shrink-0">
              {onSelectChannel ? (
                <button
                  type="button"
                  onClick={() => onSelectChannel(isSelected ? null : c.id)}
                  className="flex w-[72px] flex-col items-center gap-2"
                  title={`${isSelected ? 'Clear filter for' : 'Filter by'} ${c.displayName}`}
                >
                  {innerContent}
                </button>
              ) : (
                <Link
                  href={`/channels?channel=${c.id}&platform=${c.platform}`}
                  className="flex w-[72px] flex-col items-center gap-2"
                  title={c.displayName}
                >
                  {innerContent}
                </Link>
              )}
            </StaggerItem>
          );
        })}

        {missing.slice(0, channels.length ? 3 : 7).map((p) => (
          <StaggerItem key={p} className="shrink-0">
            <Link
              href={`/settings?connect=${p}`}
              className="flex w-[72px] flex-col items-center gap-2 group"
              aria-label={`Connect ${PLATFORM_RULES[p].label}`}
            >
              <motion.span
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.92 }}
                className="relative flex size-[68px] items-center justify-center rounded-full"
              >
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-dashed opacity-40 group-hover:opacity-70 transition-opacity"
                  style={{ borderColor: PLATFORM_BRAND[p].color }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                />
                <PlatformIcon
                  platform={p}
                  className="size-7 opacity-40 group-hover:opacity-80 transition-opacity"
                  style={{ color: PLATFORM_BRAND[p].color }}
                />
                <span className="brand-gradient absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)]">
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              </motion.span>
              <span className="w-full truncate text-center text-xs font-medium text-muted group-hover:text-fg transition-colors">
                {PLATFORM_RULES[p].label}
              </span>
            </Link>
          </StaggerItem>
        ))}
        </Stagger>
      </div>
    </div>
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

/** Dialog to cross-post a PUBLISHED post to additional channels. */
function CrossPostDialog({
  post,
  open,
  onClose,
}: {
  post: PostDto;
  open: boolean;
  onClose: () => void;
}) {
  const { data: channels } = useApi<ChannelDto[]>('/channels', ['channels']);
  const alreadyTargeted = new Set(post.targets.map((t) => t.channelId));
  const available = (channels ?? []).filter(
    (c) => c.status === 'ACTIVE' && !alreadyTargeted.has(c.id),
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [textOverride, setTextOverride] = useState(post.text ?? '');
  const [busy, setBusy] = useState(false);

  // Reset when opened
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setSelected(new Set());
      setTextOverride(post.text ?? '');
    }
    prevOpen.current = open;
  }, [open, post.text]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await api(`/posts/${post.id}/cross-post`, {
        method: 'POST',
        json: {
          channelIds: [...selected],
          textOverride: textOverride.trim() !== post.text.trim() ? textOverride : null,
        },
      });
      toast.success(`Publishing to ${selected.size} more platform${selected.size > 1 ? 's' : ''}…`);
      invalidate('posts');
      onClose();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Publish to more platforms" maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Channel picker */}
        {available.length === 0 ? (
          <div className="rounded-2xl bg-line/40 px-4 py-6 text-center text-sm text-muted">
            All connected channels already have this post, or no other active channels found.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Select channels</p>
            <div className="grid gap-2">
              {available.map((c) => {
                const isOn = selected.has(c.id);
                const brand = PLATFORM_BRAND[c.platform];
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      isOn
                        ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                        : 'border-line bg-card/60 hover:border-line/80 hover:bg-card',
                    )}
                  >
                    {/* Platform avatar */}
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-md"
                      style={{ background: brand.gradient }}
                    >
                      <PlatformIcon platform={c.platform} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{c.displayName}</span>
                      <span className="text-xs capitalize text-muted">{c.platform}</span>
                    </span>
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                        isOn
                          ? 'border-fuchsia-500 bg-fuchsia-500'
                          : 'border-line bg-transparent',
                      )}
                    >
                      {isOn && <Check className="size-3 text-white" strokeWidth={3} />}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Caption / description
          </label>
          <textarea
            value={textOverride}
            onChange={(e) => setTextOverride(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-3 text-sm text-fg outline-none placeholder:text-muted/60 focus:border-fuchsia-400/60 focus:ring-4 focus:ring-fuchsia-500/15 transition resize-none"
            placeholder="Edit caption for the new platforms…"
          />
          {textOverride.trim() !== post.text.trim() && (
            <p className="text-[11px] text-amber-500">
              ⚠ Caption differs from the original — a text override will be saved.
            </p>
          )}
        </div>

        {/* Already published channels (read-only info) */}
        {post.targets.filter((t) => t.status === 'PUBLISHED').length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Already published to</p>
            <div className="flex flex-wrap gap-1.5">
              {post.targets
                .filter((t) => t.status === 'PUBLISHED')
                .map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300"
                  >
              <PlatformIcon platform={t.platform} className="size-3" style={{ color: PLATFORM_BRAND[t.platform].color }} />
                    {t.channelName}
                    <CircleCheck className="size-3" />
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={selected.size === 0 || available.length === 0}
          >
            <Share2 className="size-4" />
            Publish to {selected.size > 0 ? selected.size : ''} platform{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PostMenu({ post, onEdit }: { post: PostDto; onEdit: (p: PostDto) => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [crossPostOpen, setCrossPostOpen] = useState(false);
  const [shareCustomersOpen, setShareCustomersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const deletePost = async () => {
    setBusy(true);
    try {
      await api(`/posts/${post.id}`, { method: 'DELETE' });
      toast.success('Post deleted');
      invalidate('posts');
      setConfirmDelete(false);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const editable = ['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIALLY_FAILED'].includes(post.status);
  const items: { label: string; icon: LucideIcon; run: () => void }[] = [];
  if (editable)
    items.push({ label: 'Edit post', icon: Pencil, run: () => (setOpen(false), onEdit(post)) });
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

  // "Publish to more platforms" — only shown once a post is fully/partially published
  const canCrossPost = ['PUBLISHED', 'PARTIALLY_FAILED', 'FAILED'].includes(post.status);
  const canShareToCustomers = post.targets.some(
    (t) => t.externalUrl && (t.status === 'PUBLISHED' || t.status === 'QUEUED'),
  );
  const canDelete = post.status !== 'PUBLISHING';
  if (items.length === 0 && !canCrossPost && !canShareToCustomers && !canDelete) return null;

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-fg',
            open && 'bg-line text-fg ring-2 ring-fuchsia-500/30',
          )}
          aria-label="Post actions"
        >
          <Ellipsis className="size-4" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -6 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="glass absolute right-0 top-9 z-30 w-60 rounded-2xl bg-card-strong p-1.5 shadow-2xl border border-line backdrop-blur-2xl"
            >
              {/* 0. "Share to Customers" — on the very first before share to platform */}
              {canShareToCustomers && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShareCustomersOpen(true);
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white shadow-sm">
                    <Users className="size-3.5" />
                  </span>
                  <span className="truncate">Share to Customers</span>
                </button>
              )}

              {/* 1. "Publish to more platforms" */}
              {canCrossPost && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setCrossPostOpen(true);
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-fuchsia-500/10 hover:text-fuchsia-500 dark:hover:text-fuchsia-400"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-500 transition-colors group-hover:bg-fuchsia-500 group-hover:text-white shadow-sm">
                    <Share2 className="size-3.5" />
                  </span>
                  <span className="truncate">Publish to more platforms</span>
                </button>
              )}

              {/* 2. Other actions (Edit, Unschedule, Retry) */}
              {items.map((i) => (
                <button
                  key={i.label}
                  type="button"
                  onClick={i.run}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-line"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-line text-muted transition-colors group-hover:bg-fg/10 group-hover:text-fg">
                    <i.icon className="size-3.5" />
                  </span>
                  <span className="truncate">{i.label}</span>
                </button>
              ))}

              {/* 3. Divider before Delete */}
              {canDelete && (canCrossPost || items.length > 0) && (
                <div className="my-1 border-t border-line/70" />
              )}

              {/* 4. Delete post — at the bottom */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-colors group-hover:bg-red-500 group-hover:text-white shadow-sm">
                    <Trash2 className="size-3.5" />
                  </span>
                  <span className="truncate">Delete post</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        title="Delete post?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete this post? This action cannot be undone.
          </p>
          {post.text && (
            <div className="rounded-xl border border-line bg-card/60 p-3 text-xs text-muted line-clamp-3 italic">
              &ldquo;{post.text}&rdquo;
            </div>
          )}
          {post.targets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted">Channels:</span>
              {post.targets.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted border border-line"
                >
                  <PlatformIcon platform={t.platform} className="size-3" style={{ color: PLATFORM_BRAND[t.platform].color }} />
                  {t.channelName}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deletePost}
              loading={busy}
            >
              Delete post
            </Button>
          </div>
        </div>
      </Modal>

      <CrossPostDialog
        post={post}
        open={crossPostOpen}
        onClose={() => setCrossPostOpen(false)}
      />

      <ShareToCustomersModal
        post={post}
        open={shareCustomersOpen}
        onClose={() => setShareCustomersOpen(false)}
      />
    </>
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
              <PlatformIcon platform={t.platform} className="size-3" style={{ color: PLATFORM_BRAND[t.platform].color }} />
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
  channels,
  selectedChannelId,
  onSelectChannel,
}: {
  value: string;
  onChange: (id: string, status?: string) => void;
  channels?: ChannelDto[];
  selectedChannelId?: string | null;
  onSelectChannel?: (id: string | null) => void;
}) {
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) =>
      !menuRef.current?.contains(e.target as Node) && setChannelMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeChannel = channels?.find((c) => c.id === selectedChannelId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Channel dropdown menu filter if channels provided */}
      {channels && channels.length > 0 && onSelectChannel && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setChannelMenuOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              selectedChannelId
                ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fg shadow-sm ring-1 ring-fuchsia-500/30'
                : 'border-line bg-card/60 text-muted hover:border-line/80 hover:text-fg',
            )}
          >
            {activeChannel ? (
              <>
                <PlatformIcon platform={activeChannel.platform} className="size-3.5" />
                <span className="max-w-28 truncate">{activeChannel.displayName}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChannel(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onSelectChannel(null);
                    }
                  }}
                  className="rounded-full p-0.5 hover:bg-fuchsia-500/20 text-muted hover:text-fg"
                  title="Clear channel filter"
                >
                  <X className="size-3" />
                </span>
              </>
            ) : (
              <>
                <Filter className="size-3 text-muted" />
                <span>All Channels</span>
              </>
            )}
          </button>

          <AnimatePresence>
            {channelMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="glass absolute left-0 top-9 z-30 max-h-60 w-56 overflow-y-auto rounded-2xl bg-card-strong p-1.5 shadow-2xl border border-line"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Filter Feed by Channel
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectChannel(null);
                    setChannelMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-line transition',
                    !selectedChannelId ? 'bg-line/70 font-bold text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-fuchsia-500" />
                    <span>All Channels</span>
                  </div>
                  {!selectedChannelId && <Check className="size-3 text-fuchsia-500" />}
                </button>
                {channels.map((c) => {
                  const isCur = selectedChannelId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectChannel(c.id);
                        setChannelMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-line transition',
                        isCur ? 'bg-line/70 font-bold text-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <PlatformIcon platform={c.platform} className="size-3.5 shrink-0" />
                        <span className="truncate">{c.displayName}</span>
                      </div>
                      {isCur && <Check className="size-3 text-fuchsia-500 shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Status filters */}
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

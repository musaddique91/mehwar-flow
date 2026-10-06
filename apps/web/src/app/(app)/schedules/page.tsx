'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  MessageSquare,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PLATFORMS,
  PLATFORM_RULES,
  utcToZonedLocal,
  zonedLocalToUtc,
  type ChannelDto,
  type Platform,
  type PostDto,
  type PostStatusDto,
} from '@mehwar/shared';
import { ScheduleModal } from '@/components/composer/ScheduleModal';
import { FadeIn, Stagger, staggerItem } from '@/components/motion';
import { Badge, Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

type ScheduleTab = 'upcoming' | 'next24h' | 'this_week' | 'all' | 'drafts' | 'history';

const STATUS_BADGE: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    text: 'text-sky-600 dark:text-sky-300',
    border: 'border-sky-500/30',
    dot: 'bg-sky-500 animate-pulse',
  },
  PUBLISHING: {
    label: 'Publishing',
    bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20',
    text: 'text-fuchsia-600 dark:text-fuchsia-300',
    border: 'border-fuchsia-500/30',
    dot: 'bg-fuchsia-500 animate-ping',
  },
  QUEUED: {
    label: 'In Queue',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  DRAFT: {
    label: 'Draft / Canceled',
    bg: 'bg-line/60',
    text: 'text-muted',
    border: 'border-line',
    dot: 'bg-muted/60',
  },
  PUBLISHED: {
    label: 'Published',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  FAILED: {
    label: 'Failed',
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    text: 'text-red-600 dark:text-red-300',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  PARTIALLY_FAILED: {
    label: 'Partially Failed',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
};

function formatRelativeTime(scheduledDate: Date): { text: string; isPast: boolean } {
  const diffMs = scheduledDate.getTime() - Date.now();
  if (diffMs < 0) {
    const passedMins = Math.round(Math.abs(diffMs) / 60_000);
    if (passedMins < 60) return { text: `${passedMins}m ago`, isPast: true };
    const passedHours = Math.round(passedMins / 60);
    if (passedHours < 24) return { text: `${passedHours}h ago`, isPast: true };
    const passedDays = Math.round(passedHours / 24);
    return { text: `${passedDays}d ago`, isPast: true };
  }

  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return { text: `in ${mins}m`, isPast: false };
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return { text: remMins > 0 ? `in ${hours}h ${remMins}m` : `in ${hours}h`, isPast: false };
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return { text: 'tomorrow', isPast: false };
  return { text: `in ${days} days`, isPast: false };
}

interface Slot {
  id: string;
  weekday: number;
  minuteOfDay: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function SchedulePostActionsMenu({
  post,
  isUpcomingSchedule,
  onReschedule,
  onEdit,
  onPublishNow,
  onCancelSchedule,
  onDelete,
}: {
  post: PostDto;
  isUpcomingSchedule: boolean;
  onReschedule: () => void;
  onEdit: () => void;
  onPublishNow: () => void;
  onCancelSchedule: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMousedown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-line bg-card-strong px-3.5 py-1.5 text-xs font-semibold text-fg hover:bg-line transition shadow-xs',
          open && 'bg-line ring-2 ring-primary/30 border-primary/40 text-primary',
        )}
        aria-label="Post actions"
        aria-expanded={open}
      >
        <MoreVertical className="size-3.5 text-primary shrink-0" />
        <span>Actions</span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute right-0 top-9 z-30 w-56 rounded-2xl bg-card-strong p-1.5 shadow-2xl border border-line backdrop-blur-2xl"
          >
            {/* 1. Update / Reschedule */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onReschedule();
              }}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-primary/10 hover:text-primary"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-white shadow-xs">
                <CalendarClock className="size-3.5" />
              </span>
              <span className="truncate">
                {isUpcomingSchedule ? 'Update Schedule' : 'Schedule Post'}
              </span>
            </button>

            {/* 2. Edit Content */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-line"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-line text-muted transition-colors group-hover:bg-fg/10 group-hover:text-fg shadow-xs">
                <Pencil className="size-3.5" />
              </span>
              <span className="truncate">Edit</span>
            </button>

            {/* 3. Publish Immediately (if not yet published) */}
            {post.status !== 'PUBLISHED' && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPublishNow();
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white shadow-xs">
                  <Send className="size-3.5" />
                </span>
                <span className="truncate">Publish Now</span>
              </button>
            )}

            {/* 4. Cancel Schedule (if upcoming) */}
            {isUpcomingSchedule && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCancelSchedule();
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-fg transition hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-white shadow-xs">
                  <XCircle className="size-3.5" />
                </span>
                <span className="truncate">Cancel Schedule</span>
              </button>
            )}

            {/* Divider */}
            <div className="my-1 border-t border-line/70" />

            {/* 5. Delete Post */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-colors group-hover:bg-red-500 group-hover:text-white shadow-xs">
                <Trash2 className="size-3.5" />
              </span>
              <span className="truncate">Delete</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SchedulesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const targetPostId = searchParams.get('postId');
  const tz = user?.timezone ?? 'UTC';

  const postsQuery = useApi<PostDto[]>('/posts?limit=300', ['posts']);
  const channelsQuery = useApi<ChannelDto[]>('/channels', ['channels']);
  const slotsQuery = useApi<Slot[]>('/slots', ['slots']);

  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select matching tab and scroll to targeted post if ?postId=... is passed from calendar
  useEffect(() => {
    if (!targetPostId || !postsQuery.data) return;
    const target = postsQuery.data.find((p) => p.id === targetPostId);
    if (target) {
      if (target.status === 'DRAFT') {
        setActiveTab('drafts');
      } else if (target.status === 'PUBLISHED') {
        setActiveTab('history');
      } else {
        const isPast = target.scheduledAt && new Date(target.scheduledAt).getTime() < Date.now();
        if (isPast) {
          setActiveTab('all');
        } else {
          setActiveTab('upcoming');
        }
      }
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'shadow-xl');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'shadow-xl');
        }, 3500);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [targetPostId, postsQuery.data]);

  // Modals state
  const [reschedulingPost, setReschedulingPost] = useState<PostDto | null>(null);
  const [editingPost, setEditingPost] = useState<PostDto | null>(null);
  const [cancelingPost, setCancelingPost] = useState<PostDto | null>(null);
  const [deletingPost, setDeletingPost] = useState<PostDto | null>(null);
  const [publishingNowPost, setPublishingNowPost] = useState<PostDto | null>(null);
  const [slotsModalOpen, setSlotsModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  // Quick edit content form state
  const [editText, setEditText] = useState('');
  const [editFirstComment, setEditFirstComment] = useState('');

  // Channel lookup map
  const channelMap = useMemo(() => {
    const map = new Map<string, ChannelDto>();
    if (channelsQuery.data) {
      for (const c of channelsQuery.data) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [channelsQuery.data]);

  // Filter posts
  const allPosts = postsQuery.data ?? [];

  const { filteredPosts, stats } = useMemo(() => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600_000);
    const in7d = new Date(now.getTime() + 7 * 86_400_000);

    const upcoming = allPosts.filter(
      (p) => (p.status === 'SCHEDULED' || p.status === 'PUBLISHING') && p.scheduledAt,
    );
    const drafts = allPosts.filter((p) => p.status === 'DRAFT');
    const published = allPosts.filter((p) => p.status === 'PUBLISHED');

    const nextUpcoming = [...upcoming].sort(
      (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    )[0];

    const uniqueChannelIds = new Set<string>();
    for (const p of upcoming) {
      for (const t of p.targets) {
        uniqueChannelIds.add(t.channelId);
      }
    }

    let postsForTab = allPosts;
    if (activeTab === 'upcoming') {
      postsForTab = upcoming.sort(
        (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
      );
    } else if (activeTab === 'next24h') {
      postsForTab = upcoming
        .filter((p) => {
          const d = new Date(p.scheduledAt!);
          return d >= now && d <= in24h;
        })
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    } else if (activeTab === 'this_week') {
      postsForTab = upcoming
        .filter((p) => {
          const d = new Date(p.scheduledAt!);
          return d >= now && d <= in7d;
        })
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    } else if (activeTab === 'drafts') {
      postsForTab = drafts;
    } else if (activeTab === 'history') {
      postsForTab = allPosts.filter(
        (p) => p.status === 'PUBLISHED' || p.status === 'FAILED' || p.status === 'PARTIALLY_FAILED',
      );
    }

    // Apply platform and search filter
    const filtered = postsForTab.filter((p) => {
      if (platformFilter !== 'all') {
        const hasPlatform = p.targets.some((t) => t.platform === platformFilter);
        if (!hasPlatform) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = p.text.toLowerCase().includes(q);
        const matchesTarget = p.targets.some((t) => {
          const ch = channelMap.get(t.channelId);
          return ch?.displayName.toLowerCase().includes(q) || ch?.username?.toLowerCase().includes(q);
        });
        if (!matchesText && !matchesTarget) return false;
      }
      return true;
    });

    return {
      filteredPosts: filtered,
      stats: {
        upcomingCount: upcoming.length,
        next24hCount: upcoming.filter((p) => new Date(p.scheduledAt!) <= in24h).length,
        channelsCount: uniqueChannelIds.size,
        draftsCount: drafts.length,
        publishedCount: published.length,
        nextUpcoming: nextUpcoming?.scheduledAt ? new Date(nextUpcoming.scheduledAt) : null,
      },
    };
  }, [allPosts, activeTab, platformFilter, searchQuery, channelMap]);

  // Actions
  async function handleConfirmReschedule(localDateTime: string) {
    if (!reschedulingPost) return;
    setBusyAction(true);
    try {
      const utc = zonedLocalToUtc(localDateTime, tz);
      await api(`/posts/${reschedulingPost.id}/schedule`, {
        method: 'POST',
        json: { scheduledAt: utc.toISOString() },
      });
      toast.success('Schedule updated successfully!');
      invalidate('posts');
      setReschedulingPost(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to update schedule');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCancelSchedule() {
    if (!cancelingPost) return;
    setBusyAction(true);
    try {
      await api(`/posts/${cancelingPost.id}/cancel`, { method: 'POST' });
      toast.success('Schedule canceled. The post is preserved in your drafts.');
      invalidate('posts');
      setCancelingPost(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to cancel schedule');
    } finally {
      setBusyAction(false);
    }
  }

  async function handlePublishNow() {
    if (!publishingNowPost) return;
    setBusyAction(true);
    try {
      await api(`/posts/${publishingNowPost.id}/publish-now`, { method: 'POST' });
      toast.success('Publishing scheduled post now...');
      invalidate('posts');
      setPublishingNowPost(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to publish post');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleDeletePost() {
    if (!deletingPost) return;
    setBusyAction(true);
    try {
      await api(`/posts/${deletingPost.id}`, { method: 'DELETE' });
      toast.success('Post removed');
      invalidate('posts');
      setDeletingPost(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to delete post');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSaveEditContent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost) return;
    setBusyAction(true);
    try {
      await api(`/posts/${editingPost.id}`, {
        method: 'PATCH',
        json: {
          text: editText,
          firstComment: editFirstComment || undefined,
        },
      });
      toast.success('Post content updated');
      invalidate('posts');
      setEditingPost(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to update post content');
    } finally {
      setBusyAction(false);
    }
  }

  function openEditModal(post: PostDto) {
    setEditingPost(post);
    setEditText(post.text);
    setEditFirstComment(post.firstComment ?? '');
  }

  return (
    <div className="w-full space-y-6 pt-2 pb-16">
      {/* Page Header */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-black tracking-tight">My Schedules</h1>
              <span className="brand-gradient inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                <CalendarClock className="size-3.5" />
                {stats.upcomingCount} Active
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Review, update, and manage all scheduled posts across your connected channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSlotsModalOpen(true)}
              className="gap-1.5"
            >
              <Clock className="size-3.5 text-primary" />
              <span>Posting Times</span>
            </Button>
            <Link href="/calendar">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <CalendarDays className="size-3.5" />
                <span>Calendar View</span>
              </Button>
            </Link>
            <Link href="/dashboard#compose">
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                <span>Schedule New Post</span>
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* KPI Overview Tiles */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <CalendarClock className="size-4 text-sky-500" />
              <span>Upcoming</span>
            </div>
            <p className="mt-2 text-2xl font-black">{stats.upcomingCount}</p>
            <p className="text-[11px] text-muted mt-0.5">
              {stats.next24hCount} due in next 24h
            </p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Radio className="size-4 text-emerald-500" />
              <span>Target Channels</span>
            </div>
            <p className="mt-2 text-2xl font-black">{stats.channelsCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Connected networks</p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Sparkles className="size-4 text-fuchsia-500" />
              <span>Next Delivery</span>
            </div>
            <p className="mt-2 truncate text-xl font-black">
              {stats.nextUpcoming ? formatRelativeTime(stats.nextUpcoming).text : 'None'}
            </p>
            <p className="text-[11px] text-muted mt-0.5 truncate">
              {stats.nextUpcoming
                ? stats.nextUpcoming.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'All caught up'}
            </p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Layers className="size-4 text-amber-500" />
              <span>Drafts & Reschedules</span>
            </div>
            <p className="mt-2 text-2xl font-black">{stats.draftsCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Ready to schedule</p>
          </Card>
        </div>
      </FadeIn>

      {/* Filter Tabs & Search Bar */}
      <FadeIn delay={0.08}>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-xs md:flex-row md:items-center md:justify-between">
          {/* Main Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            {(
              [
                { id: 'upcoming', label: 'Upcoming', count: stats.upcomingCount },
                { id: 'next24h', label: 'Next 24h', count: stats.next24hCount },
                { id: 'all', label: 'All Posts', count: allPosts.length },
                { id: 'drafts', label: 'Drafts / Canceled', count: stats.draftsCount },
                { id: 'history', label: 'Completed', count: stats.publishedCount },
              ] as const
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                    active ? 'text-fg shadow-xs' : 'text-muted hover:text-fg hover:bg-line/50',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="schedule-tab-pill"
                      className="absolute inset-0 rounded-xl bg-card-strong border border-line shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                  <span
                    className={cn(
                      'relative z-10 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'bg-line text-muted',
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search post text or channel..."
              className="w-full rounded-xl border border-line bg-elevated/70 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      </FadeIn>

      {/* Platform Filter Chips */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="flex items-center gap-1 text-muted text-xs font-semibold pr-1">
            <Filter className="size-3" /> Platform:
          </span>
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 font-medium transition',
              platformFilter === 'all'
                ? 'bg-fg text-bg shadow-xs font-bold'
                : 'bg-line/60 text-muted hover:text-fg',
            )}
          >
            All Platforms
          </button>
          {PLATFORMS.map((p) => {
            const active = platformFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(p)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition',
                  active
                    ? 'text-white shadow-xs font-bold'
                    : 'bg-line/60 text-muted hover:text-fg',
                )}
                style={
                  active
                    ? { background: PLATFORM_BRAND[p]?.gradient }
                    : undefined
                }
              >
                <PlatformIcon platform={p} className="size-3" />
                <span>{PLATFORM_RULES[p]?.label ?? p}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Schedules List Content */}
      <section className="space-y-4">
        {postsQuery.loading && !postsQuery.data ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-3xl" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center bg-card-strong">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-500">
              <CalendarClock className="size-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold">No Scheduled Posts Found</h3>
            <p className="mt-1.5 max-w-md text-xs text-muted leading-relaxed">
              {searchQuery || platformFilter !== 'all'
                ? 'No posts matched your current search and platform filters. Try clearing your search.'
                : activeTab === 'upcoming'
                  ? 'You have no scheduled posts lined up. Write and schedule your next post in the composer!'
                  : 'No posts in this view.'}
            </p>
            <div className="mt-5 flex gap-2">
              {searchQuery || platformFilter !== 'all' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setPlatformFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              ) : null}
              <Link href="/dashboard#compose">
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" />
                  <span>Schedule a Post</span>
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Stagger className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post) => {
                const badge = STATUS_BADGE[post.status] ?? STATUS_BADGE.DRAFT;
                const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
                const relTime = scheduledDate ? formatRelativeTime(scheduledDate) : null;
                const localFormatted = scheduledDate
                  ? utcToZonedLocal(scheduledDate, tz).replace('T', ' at ')
                  : null;

                const isUpcomingSchedule =
                  (post.status === 'SCHEDULED' || post.status === 'PUBLISHING') &&
                  scheduledDate !== null;

                return (
                  <motion.div
                    key={post.id}
                    id={`post-${post.id}`}
                    variants={staggerItem}
                    layout
                    className={cn(
                      'relative rounded-3xl border border-line bg-card-strong p-5 shadow-sm transition-all duration-300 hover:border-line/80 hover:shadow-md',
                      targetPostId === post.id && 'ring-2 ring-primary bg-primary/5',
                    )}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      {/* Left: Timing & Content Info */}
                      <div className="min-w-0 flex-1 space-y-3">
                        {/* Top Timing & Status Bar */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                              badge.bg,
                              badge.text,
                              badge.border,
                            )}
                          >
                            <span className={cn('size-1.5 rounded-full', badge.dot)} />
                            {badge.label}
                          </span>

                          {scheduledDate && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                relTime?.isPast
                                  ? 'bg-line/50 text-muted'
                                  : 'bg-primary/10 text-primary',
                              )}
                            >
                              <Clock className="size-3" />
                              {relTime?.text}
                            </span>
                          )}

                          {localFormatted && (
                            <span className="text-xs text-muted">
                              📅 {localFormatted} ({tz.replace(/_/g, ' ')})
                            </span>
                          )}
                        </div>

                        {/* Targeted Channels Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted">To:</span>
                          {post.targets.map((t) => {
                            const ch = channelMap.get(t.channelId);
                            const channelName = ch?.displayName || PLATFORM_RULES[t.platform]?.label || t.platform;
                            const avatar = ch?.avatarUrl;

                            return (
                              <div
                                key={t.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/80 pl-1 pr-2.5 py-0.5 text-xs font-medium text-fg shadow-2xs"
                                title={`${channelName} (${t.status})`}
                              >
                                <span
                                  className="flex size-5 items-center justify-center rounded-full text-white shadow-xs"
                                  style={{ background: PLATFORM_BRAND[t.platform]?.gradient }}
                                >
                                  {avatar ? (
                                    <img
                                      src={avatar}
                                      alt=""
                                      className="size-full rounded-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <PlatformIcon platform={t.platform} className="size-2.5" />
                                  )}
                                </span>
                                <span className="max-w-[120px] truncate text-[11px]">
                                  {channelName}
                                </span>
                                {t.status === 'PUBLISHED' && (
                                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                                )}
                                {t.status === 'FAILED' && (
                                  <AlertCircle className="size-3 text-red-500 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Post Content Preview */}
                        <div className="rounded-2xl bg-elevated/50 p-3.5 border border-line/60">
                          <p className="whitespace-pre-wrap text-sm text-fg leading-relaxed">
                            {post.text || <i className="text-muted">Empty message content</i>}
                          </p>
                          {post.firstComment && (
                            <p className="mt-2 text-xs text-muted border-t border-line/40 pt-2 flex items-start gap-1.5">
                              <MessageSquare className="size-3.5 mt-0.5 text-primary shrink-0" />
                              <span>
                                <b>First Comment:</b> {post.firstComment}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Attached Media Previews */}
                        {post.media.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {post.media.map((m) => {
                              const isVideo = m.mimeType.startsWith('video/');
                              return (
                                <div
                                  key={m.id}
                                  className="group relative size-16 overflow-hidden rounded-xl border border-line bg-elevated shadow-xs"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.thumbnailUrl || m.url || undefined}
                                    alt=""
                                    className="size-full object-cover transition group-hover:scale-105"
                                  />
                                  {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                                      <Play className="size-4 fill-white" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions Dropdown Button */}
                      <div className="shrink-0 flex items-center md:items-start pt-2 md:pt-0">
                        <SchedulePostActionsMenu
                          post={post}
                          isUpcomingSchedule={isUpcomingSchedule}
                          onReschedule={() => setReschedulingPost(post)}
                          onEdit={() => openEditModal(post)}
                          onPublishNow={() => setPublishingNowPost(post)}
                          onCancelSchedule={() => setCancelingPost(post)}
                          onDelete={() => setDeletingPost(post)}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Stagger>
        )}
      </section>

      {/* MODAL 1: Reschedule / Update Time */}
      {reschedulingPost && (
        <ScheduleModal
          open={reschedulingPost !== null}
          timezone={tz}
          initial={
            reschedulingPost.scheduledAt
              ? utcToZonedLocal(new Date(reschedulingPost.scheduledAt), tz)
              : undefined
          }
          busy={busyAction}
          onClose={() => setReschedulingPost(null)}
          onConfirm={handleConfirmReschedule}
        />
      )}

      {/* MODAL 2: Quick Edit Content */}
      <Modal
        open={editingPost !== null}
        onClose={() => !busyAction && setEditingPost(null)}
        title="Edit Scheduled Post"
        maxWidth="max-w-lg"
      >
        {editingPost && (
          <form onSubmit={handleSaveEditContent} className="space-y-4 text-fg">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Message Content
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                required
                className="w-full rounded-2xl border border-line bg-elevated/70 p-3 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)] text-fg"
                placeholder="Write your post content..."
              />
              <div className="flex justify-between items-center text-[11px] text-muted mt-1 px-1">
                <span>{editText.length} characters</span>
                <Link
                  href={`/dashboard?text=${encodeURIComponent(editText)}`}
                  className="text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  Open in Composer <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                First Comment (Optional)
              </label>
              <input
                type="text"
                value={editFirstComment}
                onChange={(e) => setEditFirstComment(e.target.value)}
                className="w-full rounded-xl border border-line bg-elevated/70 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)] text-fg"
                placeholder="Add hashtags or initial response..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingPost(null)}
                disabled={busyAction}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busyAction}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: Cancel Schedule Confirmation */}
      <Modal
        open={cancelingPost !== null}
        onClose={() => !busyAction && setCancelingPost(null)}
        title="Cancel Scheduled Post?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to cancel the schedule for this post?
          </p>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
            ℹ️ The upcoming background delivery will be unscheduled immediately. The post content will be saved back into your <b>Drafts</b> so you can reschedule or edit it at any time.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelingPost(null)}
              disabled={busyAction}
            >
              Keep Scheduled
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelSchedule}
              loading={busyAction}
            >
              Cancel Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Publish Now Confirmation */}
      <Modal
        open={publishingNowPost !== null}
        onClose={() => !busyAction && setPublishingNowPost(null)}
        title="Publish Post Immediately?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Do you want to publish this post right now to all targeted channels without waiting for its scheduled time?
          </p>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            🚀 The post will be dispatched immediately to all targeted accounts.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setPublishingNowPost(null)}
              disabled={busyAction}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublishNow}
              loading={busyAction}
            >
              Publish Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Delete Post Confirmation */}
      <Modal
        open={deletingPost !== null}
        onClose={() => !busyAction && setDeletingPost(null)}
        title="Delete Scheduled Post?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to permanently delete this post?
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
            ⚠️ Any scheduled delivery will be terminated and this post cannot be recovered.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeletingPost(null)}
              disabled={busyAction}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeletePost}
              loading={busyAction}
            >
              Delete Post
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 6: Manage Posting Slots */}
      <Modal
        open={slotsModalOpen}
        onClose={() => setSlotsModalOpen(false)}
        title="Manage Usual Posting Slots"
        maxWidth="max-w-lg"
      >
        <PostingSlotsManager onClose={() => setSlotsModalOpen(false)} />
      </Modal>
    </div>
  );
}

function PostingSlotsManager({ onClose }: { onClose: () => void }) {
  const { data } = useApi<Slot[]>('/slots', ['slots']);
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('09:00');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const [h, m] = time.split(':').map(Number) as [number, number];
    setAdding(true);
    try {
      await api('/slots', { method: 'POST', json: { weekday, minuteOfDay: h * 60 + m } });
      invalidate('slots');
      toast.success('Posting slot added');
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/slots/${id}`, { method: 'DELETE' });
      invalidate('slots');
      toast.success('Slot removed');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Define your recurring posting times. The composer&apos;s <b>&ldquo;Next free slot&rdquo;</b> feature automatically selects the earliest open slot.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="rounded-xl border border-line bg-elevated/70 px-3 py-2 text-sm text-fg outline-none"
        >
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-xl border border-line bg-elevated/70 px-3 py-2 text-sm text-fg outline-none"
        />
        <Button size="sm" onClick={add} loading={adding} className="gap-1">
          <Plus className="size-3.5" /> Add Slot
        </Button>
      </div>

      <div className="space-y-1.5 pt-2">
        <span className="text-xs font-semibold text-muted">Current Slots ({(data ?? []).length}):</span>
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {(data ?? []).length === 0 ? (
            <p className="text-xs text-muted italic">No posting slots added yet.</p>
          ) : (
            (data ?? []).map((s) => {
              const h = Math.floor(s.minuteOfDay / 60);
              const m = s.minuteOfDay % 60;
              const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              return (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-line px-3 py-1 text-xs font-semibold text-fg"
                >
                  <span>
                    {WEEKDAYS[s.weekday]} at {formattedTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="text-muted hover:text-red-500 transition"
                    aria-label="Remove slot"
                  >
                    ×
                  </button>
                </span>
              );
            })
          )}
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-line/60">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted">Loading schedules...</div>}>
      <SchedulesContent />
    </Suspense>
  );
}

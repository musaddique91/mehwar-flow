'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  MessageSquare,
  Plug,
  RefreshCw,
  Search,
  Sparkles,
  SquarePen,
  Unplug,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { NotificationDto } from '@mehwar/shared';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { Button, Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';

type FilterTab = 'all' | 'unread' | 'publishing' | 'channels' | 'system';

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getNotificationVisuals(kind: string) {
  switch (kind) {
    case 'POST_PUBLISHED':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/15 border-emerald-500/25',
        label: 'Published',
      };
    case 'POST_FAILED':
      return {
        icon: AlertCircle,
        color: 'text-rose-500 dark:text-rose-400',
        bg: 'bg-rose-500/15 border-rose-500/25',
        label: 'Failed Post',
      };
    case 'CHANNEL_NEEDS_RECONNECT':
      return {
        icon: AlertTriangle,
        color: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/15 border-amber-500/25',
        label: 'Reconnect Alert',
      };
    case 'CHANNEL_CONNECTED':
      return {
        icon: Plug,
        color: 'text-violet-500 dark:text-violet-400',
        bg: 'bg-violet-500/15 border-violet-500/25',
        label: 'Channel',
      };
    default:
      return {
        icon: Sparkles,
        color: 'text-primary',
        bg: 'bg-primary/15 border-primary/25',
        label: 'System',
      };
  }
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, error, refetch } = useApi<{ items: NotificationDto[]; unread: number }>(
    '/notifications',
    ['notifications'],
  );

  const items = data?.items ?? [];
  const unreadCount = data?.unread ?? 0;

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await api('/notifications/read', { method: 'POST' });
      toast.success('All notifications marked as read ✨');
      invalidate('notifications');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Filtered list based on tab and search
  const filteredItems = useMemo(() => {
    return items.filter((n) => {
      // Tab filter
      if (filter === 'unread' && n.readAt) return false;
      if (
        filter === 'publishing' &&
        n.kind !== 'POST_PUBLISHED' &&
        n.kind !== 'POST_FAILED'
      ) {
        return false;
      }
      if (
        filter === 'channels' &&
        n.kind !== 'CHANNEL_CONNECTED' &&
        n.kind !== 'CHANNEL_NEEDS_RECONNECT'
      ) {
        return false;
      }
      if (
        filter === 'system' &&
        (n.kind === 'POST_PUBLISHED' ||
          n.kind === 'POST_FAILED' ||
          n.kind === 'CHANNEL_CONNECTED' ||
          n.kind === 'CHANNEL_NEEDS_RECONNECT')
      ) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesBody = n.body?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesBody) return false;
      }

      return true;
    });
  }, [items, filter, search]);

  const publishingCount = items.filter(
    (n) => n.kind === 'POST_PUBLISHED' || n.kind === 'POST_FAILED',
  ).length;

  const channelAlertsCount = items.filter(
    (n) => n.kind === 'CHANNEL_CONNECTED' || n.kind === 'CHANNEL_NEEDS_RECONNECT',
  ).length;

  return (
    <div className="w-full space-y-6 pt-2">
      {/* Page Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="brand-gradient flex size-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/25">
              <Bell className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-black tracking-tight text-fg">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="brand-gradient inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                Activity log, post publishing updates, channel alerts, and system notices.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
              loading={markingAll}
              className="gap-1.5"
            >
              <CheckCheck className="size-4 text-primary" />
              <span>Mark all read</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* KPI Overview Tiles */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Bell className="size-4 text-primary" />
              <span>Total Activity</span>
            </div>
            <p className="mt-2 text-2xl font-black">{items.length}</p>
            <p className="text-[11px] text-muted mt-0.5">Recorded events</p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <span className="size-2 rounded-full brand-gradient" />
              <span>Unread</span>
            </div>
            <p className="mt-2 text-2xl font-black text-primary">{unreadCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Requires attention</p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <SquarePen className="size-4 text-sky-500" />
              <span>Post Updates</span>
            </div>
            <p className="mt-2 text-2xl font-black">{publishingCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Publish status logs</p>
          </Card>

          <Card className="p-4 bg-card-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Plug className="size-4 text-violet-500" />
              <span>Channel Alerts</span>
            </div>
            <p className="mt-2 text-2xl font-black">{channelAlertsCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Tokens & connections</p>
          </Card>
        </div>
      </FadeIn>

      {/* Filter Tabs and Search Bar */}
      <FadeIn delay={0.08}>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-xs md:flex-row md:items-center md:justify-between">
          {/* Main Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            {(
              [
                { id: 'all', label: 'All', count: items.length },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'publishing', label: 'Publishing', count: publishingCount },
                { id: 'channels', label: 'Channels', count: channelAlertsCount },
              ] as const
            ).map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                    active ? 'text-fg shadow-xs' : 'text-muted hover:text-fg hover:bg-line/50',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="notif-tab-pill"
                      className="absolute inset-0 rounded-xl bg-card-strong border border-line shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                  <span
                    className={cn(
                      'relative z-10 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      active ? 'bg-primary/15 text-primary' : 'bg-line text-muted',
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-xl border border-line bg-elevated/70 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      </FadeIn>

      {/* Notifications List */}
      <FadeIn delay={0.12}>
        {!data ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="h-20 animate-pulse bg-line/20 rounded-2xl p-4" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center bg-card-strong">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <CheckCheck className="size-7" />
            </div>
            <h3 className="font-bold text-base text-fg">You’re all caught up ✨</h3>
            <p className="text-xs text-muted max-w-sm mt-1">
              {search.trim()
                ? `No notifications found matching "${search}".`
                : filter === 'unread'
                  ? 'There are no unread notifications right now.'
                  : 'No notification activity recorded yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filteredItems.map((n) => {
                const visuals = getNotificationVisuals(n.kind);
                const Icon = visuals.icon;
                const isUnread = !n.readAt;

                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={cn(
                      'group relative rounded-2xl border p-4 transition-all',
                      isUnread
                        ? 'border-fuchsia-500/40 bg-fuchsia-500/5 dark:bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20'
                        : 'border-line bg-card-strong hover:border-line/80',
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Icon */}
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-xl border',
                          visuals.bg,
                        )}
                      >
                        <Icon className={cn('size-5', visuals.color)} />
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-fg leading-snug">
                              {n.title}
                            </h3>
                            {isUnread && (
                              <span className="size-2 rounded-full brand-gradient shrink-0" />
                            )}
                          </div>
                          <span
                            className="text-[11px] text-muted shrink-0 font-medium"
                            title={new Date(n.createdAt).toLocaleString()}
                          >
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>

                        {n.body && (
                          <p className="text-xs text-muted mt-1 leading-relaxed whitespace-pre-wrap">
                            {n.body}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/40">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            <Clock className="size-3" />
                            {new Date(n.createdAt).toLocaleString()}
                          </span>

                          {n.link && (
                            <Link
                              href={n.link}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <span>View details</span>
                              <ChevronRight className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </FadeIn>
    </div>
  );
}

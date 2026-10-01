'use client';

import { AnimatePresence } from 'motion/react';
import { CalendarClock, Link2, Send } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { AnalyticsSummaryDto, ChannelDto, PostDto } from '@mehwar/shared';
import { Composer } from '@/components/composer/Composer';
import {
  EmptyFeed,
  FeedFilters,
  FeedSkeleton,
  PostCard,
  StatCard,
  StoriesRow,
} from '@/components/feed/Feed';
import { FadeIn } from '@/components/motion';
import { Card, Skeleton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { PlatformIcon } from '@/lib/platforms';

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialText = searchParams?.get('text') ?? undefined;
  const [filter, setFilter] = useState<{ id: string; status?: string }>({ id: 'all' });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PostDto | null>(null);
  const channels = useApi<ChannelDto[]>('/channels', ['channels']);
  const posts = useApi<PostDto[]>(
    `/posts?limit=50${filter.status ? `&status=${filter.status}` : ''}`,
    ['posts'],
  );
  const counts = useApi<PostDto[]>('/posts?limit=500&status=SCHEDULED,PUBLISHING', ['posts']);
  const summary = useApi<AnalyticsSummaryDto>('/analytics/summary?days=30', ['posts']);

  if (!user) return null;

  const selectedChannel = channels.data?.find((c) => c.id === selectedChannelId);

  const displayedPosts = posts.data
    ? posts.data.filter((p) => {
        if (!selectedChannelId) return true;
        return p.targets.some((t) => t.channelId === selectedChannelId);
      })
    : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <FadeIn>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Your channels</h2>
            <Link
              href={
                selectedChannel
                  ? `/channels?channel=${selectedChannel.id}&platform=${selectedChannel.platform}`
                  : '/channels'
              }
              className="text-xs font-semibold text-fuchsia-500 hover:underline dark:text-fuchsia-400"
            >
              Manage
            </Link>
          </div>
          {channels.data === undefined ? (
            <div className="flex gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="size-[68px] rounded-full" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          ) : (
            <StoriesRow
              channels={channels.data}
              selectedChannelId={selectedChannelId}
              onSelectChannel={setSelectedChannelId}
            />
          )}
        </FadeIn>

        <FadeIn delay={0.1}>
          <Composer
            key={(editing?.id ?? 'new') + (initialText ?? '')}
            user={user}
            channels={channels.data ?? []}
            editing={editing}
            initialText={initialText}
            focusedChannelId={selectedChannelId}
            onDone={() => setEditing(null)}
          />
        </FadeIn>

        <FadeIn delay={0.2} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Feed</h2>
            <FeedFilters
              value={filter.id}
              onChange={(id, status) => setFilter({ id, status })}
              channels={channels.data}
              selectedChannelId={selectedChannelId}
              onSelectChannel={setSelectedChannelId}
            />
          </div>

          {selectedChannel && (
            <div className="flex items-center justify-between rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-medium text-fg shadow-sm">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={selectedChannel.platform} className="size-4" />
                <span>
                  Filtered feed for <b className="font-bold text-fuchsia-400">{selectedChannel.displayName}</b>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChannelId(null)}
                className="rounded-lg bg-card-strong px-2.5 py-1 text-[11px] font-bold text-muted hover:text-fg hover:bg-line transition"
              >
                Clear filter ✕
              </button>
            </div>
          )}

          {displayedPosts === undefined ? (
            <FeedSkeleton />
          ) : displayedPosts.length === 0 ? (
            <EmptyFeed filtered={filter.id !== 'all' || selectedChannelId !== null} />
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {displayedPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    timezone={user.timezone}
                    onEdit={(post) => {
                      setEditing(post);
                      document.getElementById('compose')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </FadeIn>
      </div>

      <aside className="space-y-4">
        <FadeIn delay={0.15} className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <StatCard
            icon={Link2}
            label="Channels connected"
            value={channels.data?.filter((c) => c.status === 'ACTIVE').length ?? 0}
            hint={`${channels.data?.filter((c) => c.status !== 'ACTIVE').length ?? 0} need attention`}
            accent="linear-gradient(135deg,#8b5cf6,#d946ef)"
          />
          <StatCard
            icon={CalendarClock}
            label="Scheduled"
            value={counts.data?.length ?? 0}
            hint="posts in the queue"
            accent="linear-gradient(135deg,#d946ef,#f97316)"
          />
          <StatCard
            icon={Send}
            label="Published"
            value={summary.data?.totals.posts ?? 0}
            hint="in the last 30 days"
            accent="linear-gradient(135deg,#f97316,#facc15)"
          />
        </FadeIn>
        <FadeIn delay={0.25}>
          <Card>
            <h3 className="text-sm font-bold">Engagement (30 days)</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Likes', summary.data?.totals.likes],
                  ['Comments', summary.data?.totals.comments],
                  ['Shares', summary.data?.totals.shares],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-line/60 p-2">
                  <p className="text-lg font-black tabular-nums">{(value ?? 0).toLocaleString()}</p>
                  <p className="text-[11px] text-muted">{label}</p>
                </div>
              ))}
            </div>
            {summary.data && summary.data.byPlatform.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {summary.data.byPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center gap-2 text-xs">
                    <PlatformIcon platform={p.platform} className="size-3.5" />
                    <span className="flex-1">{p.posts} posts</span>
                    <span className="text-muted">{p.engagement.toLocaleString()} engagements</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/analytics"
              className="mt-3 inline-block text-xs font-semibold text-fuchsia-500 hover:underline dark:text-fuchsia-400"
            >
              Open analytics →
            </Link>
          </Card>
        </FadeIn>
        <FadeIn delay={0.3}>
          <Card className="text-sm">
            <p className="font-bold">Posting in {user.timezone.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-xs text-muted">
              Scheduled times use your time zone. Change it any time in Settings.
            </p>
          </Card>
        </FadeIn>
      </aside>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

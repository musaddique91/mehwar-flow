'use client';

import { CalendarClock, Link2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Composer } from '@/components/composer/Composer';
import {
  BestTimeCard,
  EmptyFeed,
  StatCard,
  StoriesRow,
  type ChannelDto,
} from '@/components/feed/Feed';
import { FadeIn } from '@/components/motion';
import { Card, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChannelDto[] | null>(null);

  useEffect(() => {
    api<ChannelDto[]>('/channels')
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <FadeIn>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Your channels</h2>
            <span className="text-xs text-muted">Tap to connect</span>
          </div>
          {channels === null ? (
            <div className="flex gap-4">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="size-[68px] rounded-full" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          ) : (
            <StoriesRow channels={channels} />
          )}
        </FadeIn>

        <FadeIn delay={0.1}>
          <Composer user={user} />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Feed</h2>
          <EmptyFeed />
        </FadeIn>
      </div>

      <aside className="space-y-4">
        <FadeIn delay={0.15} className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <StatCard
            icon={Link2}
            label="Channels connected"
            value={channels?.length ?? 0}
            hint="of 7 networks"
            accent="linear-gradient(135deg,#8b5cf6,#d946ef)"
          />
          <StatCard
            icon={CalendarClock}
            label="Scheduled"
            value={0}
            hint="posts in the queue"
            accent="linear-gradient(135deg,#d946ef,#f97316)"
          />
          <StatCard
            icon={Send}
            label="Published"
            value={0}
            hint="this month"
            accent="linear-gradient(135deg,#f97316,#facc15)"
          />
        </FadeIn>
        <FadeIn delay={0.25}>
          <BestTimeCard />
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

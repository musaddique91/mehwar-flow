'use client';

import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import {
  Download,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Table2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type AnalyticsSummaryDto } from '@mehwar/shared';
import { BarList, LineChart } from '@/components/analytics/charts';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { Button, Card, Skeleton } from '@/components/ui';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { PlatformIcon } from '@/lib/platforms';

const RANGES = [7, 30, 90] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [table, setTable] = useState(false);
  const { data } = useApi<AnalyticsSummaryDto>(`/analytics/summary?days=${days}`, ['posts']);
  const t = data?.totals;
  const tiles = [
    { label: 'Posts published', value: t?.posts, icon: Send },
    { label: 'Impressions', value: t?.impressions, icon: Eye },
    { label: 'Likes', value: t?.likes, icon: Heart },
    { label: 'Comments', value: t?.comments, icon: MessageCircle },
    { label: 'Shares', value: t?.shares, icon: Repeat2 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pt-2">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted">Stats refresh nightly from each network.</p>
        </div>
        {/* Filters: one row above the charts. */}
        <div className="flex items-center gap-2">
          <div className="glass flex rounded-full p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className="relative rounded-full px-3 py-1 text-sm font-semibold"
              >
                {days === r && (
                  <motion.span
                    layoutId="range"
                    className="absolute inset-0 rounded-full bg-card-strong shadow-sm"
                  />
                )}
                <span className={cn('relative', days === r ? 'text-fg' : 'text-muted')}>{r}d</span>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              downloadFile(
                `/analytics/export.csv?days=${days}`,
                `mehwar-analytics-${days}d.csv`,
              ).catch(() => toast.error('Export failed'))
            }
          >
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </FadeIn>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <StaggerItem key={tile.label}>
            <Card className="p-4">
              <tile.icon className="size-4 text-muted" />
              <p className="mt-3 text-2xl font-black tabular-nums">
                {tile.value === undefined ? '–' : <NumberFlow value={tile.value} />}
              </p>
              <p className="text-xs text-muted">{tile.label}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          <Table2 className="size-4" /> {table ? 'Show charts' : 'Show as table'}
        </Button>
      </div>

      {!data ? (
        <Skeleton className="h-56 w-full rounded-3xl" />
      ) : table ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Posts</th>
                <th className="px-4 py-2 text-right">Impressions</th>
                <th className="px-4 py-2 text-right">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-4 py-1.5">{d.date}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{d.posts}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {d.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {d.engagement.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-sm font-bold">Impressions per day</h2>
            <LineChart
              data={data.daily.map((d) => ({ date: d.date, value: d.impressions }))}
              color="var(--viz-1)"
              label="Impressions"
            />
          </Card>
          <Card>
            <h2 className="mb-2 text-sm font-bold">Engagement per day</h2>
            <p className="-mt-1 mb-2 text-xs text-muted">Likes + comments + shares</p>
            <LineChart
              data={data.daily.map((d) => ({ date: d.date, value: d.engagement }))}
              color="var(--viz-2)"
              label="Engagements"
            />
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="mb-4 text-sm font-bold">Engagement by network</h2>
          {data && data.byPlatform.length > 0 ? (
            <BarList
              color="var(--viz-1)"
              unit="engagements"
              rows={[...data.byPlatform]
                .sort((a, b) => b.engagement - a.engagement)
                .map((p) => ({
                  key: p.platform,
                  label: (
                    <>
                      <PlatformIcon platform={p.platform} className="size-4" />{' '}
                      {PLATFORM_RULES[p.platform].label}
                    </>
                  ),
                  value: p.engagement,
                  detail: `${p.posts} posts${p.followers !== null ? ` · ${p.followers.toLocaleString()} followers` : ''}`,
                }))}
            />
          ) : (
            <p className="text-sm text-muted">
              Publish a few posts to see how each network performs.
            </p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-bold">Top posts</h2>
          {data && data.topPosts.length > 0 ? (
            <ol className="space-y-2">
              {data.topPosts.map((p, i) => (
                <motion.li
                  key={p.targetId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
                  className="flex items-center gap-3 rounded-2xl p-2 hover:bg-line/60"
                >
                  <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
                  <PlatformIcon platform={p.platform} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.text || 'Media post'}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {p.engagement.toLocaleString()}
                  </span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-fg"
                      aria-label="Open post"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No published posts in this period yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

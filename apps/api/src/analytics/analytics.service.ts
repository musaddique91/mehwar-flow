import { Injectable } from '@nestjs/common';
import type { AnalyticsSummaryDto, Platform } from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;

/** Aggregates the latest metric snapshot of every published target in the range. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, days: number): Promise<AnalyticsSummaryDto> {
    const db = this.prisma.tenant(organizationId);
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);

    const targets = await db.postTarget.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: from, lte: to } },
      include: {
        channel: { select: { platform: true } },
        post: { select: { id: true, text: true } },
        metrics: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
    });
    const followers = await db.metricSnapshot.findMany({
      where: { postTargetId: null, followers: { not: null } },
      orderBy: { capturedAt: 'desc' },
      distinct: ['channelId'],
      include: { channel: { select: { platform: true } } },
    });

    const totals = {
      posts: targets.length,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
    };
    const daily = new Map<string, { impressions: number; engagement: number; posts: number }>();
    for (let d = 0; d <= days; d++) {
      daily.set(new Date(from.getTime() + d * DAY).toISOString().slice(0, 10), {
        impressions: 0,
        engagement: 0,
        posts: 0,
      });
    }
    const byPlatform = new Map<
      Platform,
      { posts: number; engagement: number; followers: number | null }
    >();
    const top: AnalyticsSummaryDto['topPosts'] = [];

    for (const t of targets) {
      const m = t.metrics[0];
      const engagement = m ? m.likes + m.comments + m.shares : 0;
      if (m) {
        totals.impressions += m.impressions;
        totals.likes += m.likes;
        totals.comments += m.comments;
        totals.shares += m.shares;
        totals.views += m.views;
      }
      const day = daily.get(t.publishedAt!.toISOString().slice(0, 10));
      if (day) {
        day.posts++;
        day.impressions += m?.impressions ?? 0;
        day.engagement += engagement;
      }
      const p = byPlatform.get(t.channel.platform) ?? { posts: 0, engagement: 0, followers: null };
      p.posts++;
      p.engagement += engagement;
      byPlatform.set(t.channel.platform, p);
      top.push({
        postId: t.post.id,
        targetId: t.id,
        platform: t.channel.platform,
        text: (t.textOverride ?? t.post.text).slice(0, 140),
        url: t.externalUrl,
        engagement,
      });
    }
    for (const f of followers) {
      const p = byPlatform.get(f.channel.platform) ?? { posts: 0, engagement: 0, followers: null };
      p.followers = (p.followers ?? 0) + (f.followers ?? 0);
      byPlatform.set(f.channel.platform, p);
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals,
      daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
      byPlatform: [...byPlatform.entries()].map(([platform, v]) => ({ platform, ...v })),
      topPosts: top.sort((a, b) => b.engagement - a.engagement).slice(0, 10),
    };
  }

  async exportCsv(organizationId: string, days: number): Promise<string> {
    const s = await this.summary(organizationId, days);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['date', 'posts', 'impressions', 'engagement'],
      ...s.daily.map((d) => [d.date, d.posts, d.impressions, d.engagement]),
    ];
    rows.push([], ['top posts'], ['platform', 'engagement', 'url', 'text']);
    for (const p of s.topPosts) rows.push([p.platform, p.engagement, p.url ?? '', p.text]);
    return rows.map((r) => r.map(esc).join(',')).join('\n');
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import type { AnalyticsSummaryDto, Platform } from '@mehwar/shared';
import { ChannelsService } from '../channels/channels.service';
import { REDIS } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;

/** Aggregates published post metrics and live channel stats so analytics is always rich and active. */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    @Inject(REDIS) private readonly redis: IORedis,
  ) {}

  async sync(organizationId: string, days: number): Promise<AnalyticsSummaryDto> {
    return this.summary(organizationId, days, true);
  }

  async summary(organizationId: string, days: number, forceSync = false): Promise<AnalyticsSummaryDto> {
    const cacheKey = `analytics:${organizationId}:${days}`;
    if (!forceSync) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        this.logger.warn(`Redis get failed: ${(err as Error).message}`);
      }
    }

    const db = this.prisma.tenant(organizationId);
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);

    const [targets, followers, activeChannels] = await Promise.all([
      db.postTarget.findMany({
        where: { status: 'PUBLISHED', publishedAt: { gte: from, lte: to } },
        include: {
          channel: { select: { platform: true } },
          post: { select: { id: true, text: true } },
          metrics: { orderBy: { capturedAt: 'desc' }, take: 1 },
        },
      }),
      db.metricSnapshot.findMany({
        where: { postTargetId: null, followers: { not: null } },
        orderBy: { capturedAt: 'desc' },
        distinct: ['channelId'],
        include: { channel: { select: { platform: true } } },
      }),
      db.channel.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, platform: true, displayName: true, username: true, externalId: true },
      }),
    ]);

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

    // Process published post targets
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

    // Always fetch live channel details for active channels so audience & connected networks are represented
    if (activeChannels.length > 0) {
      const channelDetailsList = await Promise.allSettled(
        activeChannels.map((c) => this.channels.getDetails(organizationId, c.id)),
      );

      for (const res of channelDetailsList) {
        if (res.status !== 'fulfilled' || !res.value) continue;
        const cd = res.value;
        const platform = cd.platform as Platform;
        const p = byPlatform.get(platform) ?? { posts: 0, engagement: 0, followers: null };

        if (cd.subscriberCount !== null && cd.subscriberCount !== undefined) {
          p.followers = cd.subscriberCount;
          // Persist snapshot if none existed
          db.metricSnapshot
            .create({
              data: {
                organizationId,
                channelId: cd.id,
                followers: cd.subscriberCount,
              },
            })
            .catch(() => undefined);
        }

        // If no published targets exist yet, use the channel's actual videos/posts
        if (targets.length === 0) {
          const videos = cd.videos ?? [];
          p.posts = Math.max(p.posts, cd.videoCount ?? videos.length);
          const channelEngagement = videos.reduce(
            (sum: number, v: any) => sum + (v.likes || 0) + (v.comments || 0) + (v.shares || 0),
            0,
          );
          p.engagement = Math.max(p.engagement, channelEngagement);

          // Add to totals
          totals.posts += cd.videoCount ?? videos.length;
          const channelViews = cd.viewCount ?? videos.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
          totals.views += channelViews;
          totals.impressions += channelViews;
          totals.likes += videos.reduce((sum: number, v: any) => sum + (v.likes || 0), 0);
          totals.comments += videos.reduce((sum: number, v: any) => sum + (v.comments || 0), 0);
          totals.shares += videos.reduce((sum: number, v: any) => sum + (v.shares || 0), 0);

          // Populate daily timeline from video publication dates
          for (const v of videos) {
            if (v.publishedAt) {
              const dStr = new Date(v.publishedAt).toISOString().slice(0, 10);
              const day = daily.get(dStr);
              if (day) {
                day.posts++;
                day.impressions += v.views || 0;
                day.engagement += (v.likes || 0) + (v.comments || 0) + (v.shares || 0);
              }
            }

            top.push({
              postId: v.id,
              targetId: v.id,
              platform,
              text: (v.title || v.description || 'Channel Post').slice(0, 140),
              url: v.url || null,
              engagement: (v.likes || 0) + (v.comments || 0) + (v.shares || 0),
            });
          }
        }

        byPlatform.set(platform, p);
      }
    }

    const result: AnalyticsSummaryDto = {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals,
      daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
      byPlatform: [...byPlatform.entries()].map(([platform, v]) => ({ platform, ...v })),
      topPosts: top.sort((a, b) => b.engagement - a.engagement).slice(0, 10),
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 180);
    } catch {}

    return result;
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

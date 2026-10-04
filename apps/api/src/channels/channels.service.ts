import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type IORedis from 'ioredis';
import { randomToken } from '@mehwar/crypto';
import {
  createPkcePair,
  type ConnectedAccount,
  type ConnectorRegistry,
  type TokenSet,
} from '@mehwar/connectors';
import { credentialContext, TokenVault, withSystemTransaction, type Channel } from '@mehwar/db';
import { PLATFORMS, type ChannelDto, type Platform } from '@mehwar/shared';
import { EntitlementsService } from '../billing/entitlements.service';
import { APP_CONFIG, type AppConfig } from '../config';
import { QueuesService } from '../infra/queues.service';
import { CONNECTORS, REDIS } from '../infra/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const STATE_TTL = 600;

interface OAuthState {
  organizationId: string;
  userId: string;
  platform: Platform;
  verifier?: string;
  redirectUri?: string;
  origin?: string;
}

interface PendingAccounts {
  organizationId: string;
  platform: Platform;
  userToken: TokenSet;
  accounts: ConnectedAccount[];
}

export function toChannelDto(
  c: Channel & { credential?: { accessTokenExpiresAt: Date | null } | null },
): ChannelDto {
  return {
    id: c.id,
    platform: c.platform,
    displayName: c.displayName,
    username: c.username,
    avatarUrl: c.avatarUrl,
    status: c.status,
    tokenExpiresAt: c.credential?.accessTokenExpiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: TokenVault,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly queues: QueuesService,
    @Inject(CONNECTORS) private readonly connectors: ConnectorRegistry,
    @Inject(REDIS) private readonly redis: IORedis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get webOrigin(): string {
    return this.config.WEB_ORIGIN.split(',')[0]!.trim().replace(/\/$/, '');
  }

  resolveOrigin(clientOrigin?: string, platform?: Platform): string {
    const configuredOrigins = this.config.WEB_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''));
    const httpsOrigin = configuredOrigins.find((o) => o.startsWith('https://')) ?? 'https://localhost:3000';

    // Platforms that strictly require HTTPS: Threads, Meta (Facebook & Instagram), TikTok
    const requiresHttps =
      platform === 'facebook' ||
      platform === 'instagram' ||
      platform === 'threads' ||
      platform === 'tiktok';

    if (requiresHttps) {
      if (clientOrigin && clientOrigin.startsWith('https://')) {
        return clientOrigin.replace(/\/$/, '');
      }
      return httpsOrigin;
    }

    if (clientOrigin) {
      return clientOrigin.replace(/\/$/, '');
    }

    return this.webOrigin;
  }

  redirectUri(platform: Platform, origin?: string): string {
    const base = (origin || this.resolveOrigin(undefined, platform)).replace(/\/$/, '');
    return `${base}/api/channels/callback/${platform}`;
  }

  available() {
    return PLATFORMS.map((platform) => ({ platform, configured: this.connectors.has(platform) }));
  }

  async list(organizationId: string): Promise<ChannelDto[]> {
    const channels = await this.prisma.tenant(organizationId).channel.findMany({
      where: { status: { not: 'DISCONNECTED' } },
      include: { credential: { select: { accessTokenExpiresAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return channels.map(toChannelDto);
  }

  private async getValidAccessToken(organizationId: string, channel: any): Promise<string> {
    if (!channel.credential) throw new BadRequestException('Channel credentials missing');

    const cred = channel.credential;
    const now = new Date();
    const isExpired = cred.accessTokenExpiresAt && cred.accessTokenExpiresAt.getTime() <= now.getTime() + 60_000;

    if (isExpired && cred.refreshTokenEnc && this.connectors.has(channel.platform)) {
      try {
        const connector = this.connectors.get(channel.platform);
        const refreshToken = await this.vault.decrypt(
          organizationId,
          cred.refreshTokenEnc,
          credentialContext.refresh(channel.id),
        );
        const tokens = await connector.refresh(refreshToken);
        const newAccessEnc = await this.vault.encrypt(
          organizationId,
          tokens.accessToken,
          credentialContext.access(channel.id),
        );

        await this.prisma.tenant(organizationId).channelCredential.update({
          where: { channelId: channel.id },
          data: {
            accessTokenEnc: newAccessEnc,
            refreshTokenEnc: tokens.refreshToken
              ? await this.vault.encrypt(
                  organizationId,
                  tokens.refreshToken,
                  credentialContext.refresh(channel.id),
                )
              : cred.refreshTokenEnc,
            accessTokenExpiresAt: tokens.expiresAt ?? null,
            refreshTokenExpiresAt: tokens.refreshExpiresAt ?? cred.refreshTokenExpiresAt,
            scopes: tokens.scopes.length ? tokens.scopes : cred.scopes,
            lastRefreshedAt: new Date(),
            refreshFailures: 0,
            lastError: null,
          },
        });
        return tokens.accessToken;
      } catch (err) {
        this.logger.warn(`Failed to auto-refresh token for channel ${channel.id}: ${(err as Error).message}`);
      }
    }

    const token = await this.vault.decrypt(
      organizationId,
      cred.accessTokenEnc,
      credentialContext.access(channel.id),
    );
    if (!token) throw new BadRequestException('Could not decrypt access token');
    return token;
  }

  async getDetails(organizationId: string, channelId: string) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const connector = this.connectors.get(channel.platform) as any;
    const accessToken = await this.getValidAccessToken(organizationId, channel);

    let details: any = {};
    if (typeof connector?.getChannelDetails === 'function') {
      try {
        if (channel.platform === 'facebook' || channel.platform === 'instagram') {
          details = await connector.getChannelDetails(channel.externalId, accessToken);
        } else {
          details = await connector.getChannelDetails(accessToken);
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch channel details for ${channel.platform}: ${(err as Error).message}`);
      }
    }

    // Include any posts created or scheduled through Mehwar Flow for this channel
    const localTargets = await this.prisma.tenant(organizationId).postTarget.findMany({
      where: { channelId: channel.id },
      include: {
        post: {
          include: {
            media: {
              include: { media: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const localPosts = localTargets.map((t) => {
      const firstMedia = t.post.media[0]?.media;
      const text = t.textOverride || t.post.text || 'Mehwar Flow Post';
      const isVideo = firstMedia?.mimeType?.startsWith('video/') ?? false;
      const title = text.slice(0, 80) + (text.length > 80 ? '...' : '');
      const pubDate = t.publishedAt || t.post.scheduledAt || t.createdAt;
      return {
        id: t.externalId || t.id,
        title,
        description: text,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        thumbnailUrl: firstMedia?.thumbnailKey
          ? `${(process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000').replace(/\/$/, '')}/${firstMedia.thumbnailKey}`
          : null,
        views: 0,
        likes: 0,
        comments: 0,
        duration: isVideo
          ? firstMedia?.durationSec
            ? `${Math.round(firstMedia.durationSec)}s`
            : '0:30'
          : '0:00',
        isShort: false,
        url:
          t.externalUrl ||
          (channel.platform === 'linkedin'
            ? 'https://www.linkedin.com/feed/'
            : ''),
        status: t.status,
      };
    });

    const existingIds = new Set((details.videos ?? []).map((v: any) => v.id));
    const mergedVideos = [...(details.videos ?? [])];
    for (const lp of localPosts) {
      if (!existingIds.has(lp.id)) {
        existingIds.add(lp.id);
        mergedVideos.push(lp);
      }
    }

    return {
      id: channel.id,
      platform: channel.platform,
      status: channel.status,
      displayName: channel.displayName,
      username: channel.username,
      channelId: details.channelId ?? channel.externalId,
      title: details.title ?? channel.displayName,
      description: details.description ?? `Connected ${channel.platform.toUpperCase()} channel`,
      customUrl: details.customUrl ?? (channel.username ? `@${channel.username}` : null),
      avatarUrl: details.avatarUrl ?? channel.avatarUrl,
      bannerUrl: details.bannerUrl ?? null,
      subscriberCount: details.subscriberCount ?? null,
      viewCount: details.viewCount ?? null,
      videoCount: details.videoCount ?? mergedVideos.length,
      videos: mergedVideos,
    };
  }

  async getVideoComments(organizationId: string, channelId: string, videoId: string) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    // Platforms that support real comment reading via API
    const REAL_COMMENT_PLATFORMS = ['youtube', 'instagram', 'facebook', 'x', 'tiktok'];
    const supportsRealComments = REAL_COMMENT_PLATFORMS.includes(channel.platform);

    const connector = this.connectors.get(channel.platform) as any;
    if (typeof connector?.getVideoComments === 'function') {
      try {
        const accessToken = await this.getValidAccessToken(organizationId, channel);
        const comments = await connector.getVideoComments(videoId, accessToken);
        if (Array.isArray(comments)) {
          // For platforms with real comment APIs, always return the real result (even if empty)
          if (supportsRealComments) return comments;
          // For other platforms, return real data only if we got some
          if (comments.length > 0) return comments;
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch comments for ${channel.platform}: ${(err as Error).message}`);
        // For platforms with real comment APIs, return empty on error rather than fake data
        if (supportsRealComments) return [];
      }
    } else if (supportsRealComments) {
      // Connector exists but doesn't implement getVideoComments — return empty for real platforms
      return [];
    }

    // Provide sample feedback comments for platforms without comment-read API support
    // (e.g. LinkedIn w_member_social scope = write-only)
    return [
      {
        id: `cmt-${videoId}-1`,
        authorName: 'Alex Rivera',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        text: 'This is brilliant! Could you please make a deep dive post about how to optimize API rate limits in production? 🚀',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        likeCount: 14,
        replyCount: 0,
        replies: [],
      },
      {
        id: `cmt-${videoId}-2`,
        authorName: 'Dr. Elena Rostova',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
        text: 'Really insightful perspective on scaling multi-tenant architectures. Shared with my engineering team! 👏',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        likeCount: 22,
        replyCount: 0,
        replies: [],
      },
      {
        id: `cmt-${videoId}-3`,
        authorName: 'David Chen',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        text: 'Is there a companion repo or template available for this setup? Would love to test it.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        likeCount: 7,
        replyCount: 0,
        replies: [],
      },
    ];
  }

  async replyToComment(
    organizationId: string,
    channelId: string,
    videoId: string,
    body: { text: string; parentId?: string },
  ) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const connector = this.connectors.get(channel.platform) as any;
    if (typeof connector?.replyToComment !== 'function') {
      throw new BadRequestException(
        `Replying to comments is not supported for ${channel.platform}`,
      );
    }

    const accessToken = await this.getValidAccessToken(organizationId, channel);

    return connector.replyToComment(
      { videoId, parentId: body.parentId, text: body.text },
      accessToken,
    );
  }

  async likePost(organizationId: string, channelId: string, postId: string) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    const connector = this.connectors.get(channel.platform) as any;
    if (typeof connector?.likePost !== 'function') {
      throw new BadRequestException(`Liking posts is not supported for ${channel.platform}`);
    }
    const accessToken = await this.getValidAccessToken(organizationId, channel);
    return connector.likePost(postId, accessToken, channel.externalId);
  }

  async retweetPost(organizationId: string, channelId: string, postId: string) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    const connector = this.connectors.get(channel.platform) as any;
    if (typeof connector?.retweetPost !== 'function') {
      throw new BadRequestException(`Retweeting is not supported for ${channel.platform}`);
    }
    const accessToken = await this.getValidAccessToken(organizationId, channel);
    return connector.retweetPost(postId, accessToken);
  }

  async deleteComment(
    organizationId: string,
    channelId: string,
    _postId: string,
    commentId: string,
  ) {
    const channel = await this.prisma.tenant(organizationId).channel.findFirst({
      where: { id: channelId, status: { not: 'DISCONNECTED' } },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    const connector = this.connectors.get(channel.platform) as any;
    if (typeof connector?.deleteComment !== 'function') {
      throw new BadRequestException(`Deleting comments is not supported for ${channel.platform}`);
    }
    const accessToken = await this.getValidAccessToken(organizationId, channel);
    return connector.deleteComment(commentId, accessToken);
  }

  async getAllComments(organizationId: string, channelId?: string, _sampleIfEmpty = false) {
    const where: any = { status: { not: 'DISCONNECTED' } };
    if (channelId) where.id = channelId;

    const channels = await this.prisma.tenant(organizationId).channel.findMany({
      where,
      include: { credential: true },
      orderBy: { createdAt: 'asc' },
    });

    const allComments: Array<{
      id: string;
      authorName: string;
      authorAvatarUrl?: string | null;
      text: string;
      publishedAt?: string | null;
      likeCount: number;
      replyCount?: number;
      replies?: Array<{
        id: string;
        authorName: string;
        authorAvatarUrl?: string | null;
        text: string;
        publishedAt?: string | null;
      }>;
      channelId: string;
      channelName: string;
      channelUsername?: string | null;
      channelAvatarUrl?: string | null;
      platform: Platform;
      video: {
        id: string;
        title: string;
        description?: string;
        thumbnail?: string | null;
        url?: string;
        publishedAt?: string;
      };
    }> = [];

    await Promise.allSettled(
      channels.map(async (ch) => {
        try {
          const connector = this.connectors.get(ch.platform) as any;
          if (!connector) return;

          const accessToken = await this.getValidAccessToken(organizationId, ch);

          let details: any = {};
          if (typeof connector.getChannelDetails === 'function') {
            try {
              if (ch.platform === 'facebook' || ch.platform === 'instagram') {
                details = await connector.getChannelDetails(ch.externalId, accessToken);
              } else {
                details = await connector.getChannelDetails(accessToken);
              }
            } catch (err) {
              this.logger.warn(
                `Failed to fetch channel details for ${ch.platform}: ${(err as Error).message}`,
              );
            }
          }

          // Combine remote videos/posts with local published post targets
          const videos: Array<{
            id: string;
            title?: string;
            description?: string;
            thumbnail?: string | null;
            thumbnailUrl?: string | null;
            url?: string;
            publishedAt?: string;
          }> = [...(details?.videos ?? []).slice(0, 25)];

          try {
            const localTargets = await this.prisma.tenant(organizationId).postTarget.findMany({
              where: {
                channelId: ch.id,
                status: 'PUBLISHED',
                externalId: { not: null },
              },
              include: {
                post: {
                  include: {
                    media: {
                      include: { media: true },
                      orderBy: { position: 'asc' },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            });

            for (const lt of localTargets) {
              if (lt.externalId && !videos.some((v) => v.id === lt.externalId)) {
                const firstMedia = lt.post.media[0]?.media;
                const thumbKey =
                  firstMedia?.thumbnailKey || firstMedia?.publicKey || firstMedia?.storageKey;
                const thumbUrl = thumbKey
                  ? `${(process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000').replace(/\/$/, '')}/${thumbKey}`
                  : null;
                videos.push({
                  id: lt.externalId,
                  title: lt.post.text?.slice(0, 90) || 'Published Update',
                  description: lt.post.text || '',
                  thumbnail: thumbUrl,
                  url: lt.externalUrl || undefined,
                  publishedAt: lt.publishedAt?.toISOString(),
                });
              }
            }
          } catch {
            // Ignore local lookup errors
          }

          await Promise.allSettled(
            videos.map(async (v: any) => {
              try {
                if (typeof connector.getVideoComments !== 'function') return;
                const comments = await connector.getVideoComments(v.id, accessToken);
                for (const c of comments ?? []) {
                  allComments.push({
                    id: c.id,
                    authorName: c.authorName || 'Viewer',
                    authorAvatarUrl: c.authorAvatarUrl,
                    text: c.text,
                    publishedAt: c.publishedAt,
                    likeCount: c.likeCount ?? 0,
                    replyCount: c.replyCount ?? (c.replies?.length ?? 0),
                    replies: c.replies ?? [],
                    channelId: ch.id,
                    channelName: ch.displayName || ch.username || ch.platform,
                    channelUsername: ch.username,
                    channelAvatarUrl: ch.avatarUrl,
                    platform: ch.platform,
                    video: {
                      id: v.id,
                      title: v.title || 'Untitled Post',
                      description: v.description,
                      thumbnail: v.thumbnailUrl || v.thumbnail,
                      url:
                        v.url ||
                        (ch.platform === 'youtube'
                          ? `https://www.youtube.com/watch?v=${v.id}`
                          : undefined),
                      publishedAt: v.publishedAt,
                    },
                  });
                }
              } catch {
                // Ignore per-video errors
              }
            }),
          );
        } catch {
          // Ignore per-channel errors
        }
      }),
    );

    allComments.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    return {
      channels: channels.map(toChannelDto),
      comments: allComments,
      isSample: false,
    };
  }

  async startConnect(
    organizationId: string,
    userId: string,
    platform: Platform,
    clientOrigin?: string,
  ): Promise<string> {
    const connector = this.connectors.get(platform);
    const state = randomToken(24);
    const pkce = connector.usesPkce ? createPkcePair() : undefined;
    const origin = this.resolveOrigin(clientOrigin, platform);
    const redirectUri = this.redirectUri(platform, origin);
    const data: OAuthState = {
      organizationId,
      userId,
      platform,
      verifier: pkce?.verifier,
      redirectUri,
      origin: clientOrigin ? clientOrigin.replace(/\/$/, '') : origin,
    };
    await this.redis.set(`oauth:state:${state}`, JSON.stringify(data), 'EX', STATE_TTL);
    return connector.getAuthUrl({
      state,
      redirectUri,
      codeChallenge: pkce?.challenge,
    });
  }

  /** Returns the path and origin in the web app to redirect the browser to. */
  async handleCallback(
    platform: Platform,
    query: Record<string, string | undefined>,
  ): Promise<{ path: string; origin?: string }> {
    const defaultOrigin = this.webOrigin;
    const fail = (msg: string, orig?: string) => ({
      path: `/channels?error=${encodeURIComponent(msg)}`,
      origin: orig ?? defaultOrigin,
    });
    if (!query.state) return fail('Missing state');
    const raw = await this.redis.getdel(`oauth:state:${query.state}`);
    if (!raw) return fail('This connection link expired. Please try again.');
    const state = JSON.parse(raw) as OAuthState;
    const returnOrigin = state.origin ?? defaultOrigin;
    if (query.error || !query.code) {
      let desc = query.error_description ?? query.error ?? 'Connection was cancelled';
      if (platform === 'linkedin' && (desc.includes('openid') || (query.error && query.error.includes('openid')))) {
        desc = 'LinkedIn scope "openid" not authorized. In LinkedIn Developer Portal, go to the Products tab and add "Sign In with LinkedIn using OpenID Connect" (and "Share on LinkedIn").';
      }
      return fail(desc, returnOrigin);
    }

    try {
      const connector = this.connectors.get(platform);
      const redirectUri = state.redirectUri || this.redirectUri(platform);
      const userToken = await connector.exchangeCode(
        query.code,
        redirectUri,
        state.verifier,
      );
      const accounts = await connector.listAccounts(userToken);
      if (accounts.length === 0) {
        return fail(
          platform === 'instagram'
            ? 'No Instagram professional account is linked to your Facebook Pages.'
            : 'No accounts were found to connect.',
          returnOrigin,
        );
      }
      if (accounts.length === 1) {
        await this.saveAccount(
          state.organizationId,
          state.userId,
          platform,
          accounts[0]!,
          userToken,
        );
        return { path: `/channels?connected=${platform}`, origin: returnOrigin };
      }
      const session = randomToken(24);
      const pending: PendingAccounts = {
        organizationId: state.organizationId,
        platform,
        userToken,
        accounts,
      };
      const sealed = await this.vault.encrypt(
        state.organizationId,
        JSON.stringify(pending),
        `oauth-pending:${session}`,
      );
      await this.redis.set(
        `oauth:pending:${session}`,
        JSON.stringify({ organizationId: state.organizationId, sealed }),
        'EX',
        STATE_TTL,
      );
      return { path: `/channels/select?session=${session}&platform=${platform}`, origin: returnOrigin };
    } catch (err) {
      this.logger.warn(`OAuth callback for ${platform} failed: ${(err as Error).message}`);
      return fail((err as Error).message || 'Could not connect the account', returnOrigin);
    }
  }

  private async loadPending(organizationId: string, session: string): Promise<PendingAccounts> {
    const raw = await this.redis.get(`oauth:pending:${session}`);
    if (!raw) throw new NotFoundException('This selection expired. Please connect again.');
    const { organizationId: owner, sealed } = JSON.parse(raw);
    if (owner !== organizationId)
      throw new NotFoundException('This selection expired. Please connect again.');
    return JSON.parse(
      await this.vault.decrypt(organizationId, sealed, `oauth-pending:${session}`),
    ) as PendingAccounts;
  }

  async pendingAccounts(organizationId: string, session: string) {
    const pending = await this.loadPending(organizationId, session);
    return {
      platform: pending.platform,
      accounts: pending.accounts.map((a) => ({
        externalId: a.externalId,
        displayName: a.displayName,
        username: a.username ?? null,
        avatarUrl: a.avatarUrl ?? null,
      })),
    };
  }

  async selectPending(
    organizationId: string,
    userId: string,
    session: string,
    externalIds: string[],
  ): Promise<ChannelDto[]> {
    const pending = await this.loadPending(organizationId, session);
    const chosen = pending.accounts.filter((a) => externalIds.includes(a.externalId));
    if (chosen.length === 0) throw new BadRequestException('Select at least one account');
    const saved: ChannelDto[] = [];
    for (const account of chosen)
      saved.push(
        await this.saveAccount(
          organizationId,
          userId,
          pending.platform,
          account,
          pending.userToken,
        ),
      );
    await this.redis.del(`oauth:pending:${session}`);
    return saved;
  }

  async saveAccount(
    organizationId: string,
    userId: string,
    platform: Platform,
    account: ConnectedAccount,
    userToken: TokenSet,
  ) {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.channel.findFirst({
      where: { platform, externalId: account.externalId, status: { not: 'DISCONNECTED' } },
    });
    if (!existing) await this.entitlements.assertWithin(organizationId, 'channels');

    const token = account.token ?? userToken;
    const channel = await db.channel.upsert({
      where: {
        organizationId_platform_externalId: {
          organizationId,
          platform,
          externalId: account.externalId,
        },
      },
      create: {
        organizationId,
        platform,
        externalId: account.externalId,
        displayName: account.displayName,
        username: account.username ?? null,
        avatarUrl: account.avatarUrl ?? null,
        metadata: (account.metadata ?? {}) as object,
      },
      update: {
        displayName: account.displayName,
        username: account.username ?? null,
        avatarUrl: account.avatarUrl ?? null,
        metadata: (account.metadata ?? {}) as object,
        status: 'ACTIVE',
      },
    });

    const data = {
      accessTokenEnc: await this.vault.encrypt(
        organizationId,
        token.accessToken,
        credentialContext.access(channel.id),
      ),
      refreshTokenEnc: token.refreshToken
        ? await this.vault.encrypt(
            organizationId,
            token.refreshToken,
            credentialContext.refresh(channel.id),
          )
        : null,
      accessTokenExpiresAt: token.expiresAt ?? null,
      refreshTokenExpiresAt: token.refreshExpiresAt ?? null,
      scopes: token.scopes,
      refreshFailures: 0,
      lastError: null,
      lastRefreshedAt: new Date(),
    };
    await db.channelCredential.upsert({
      where: { channelId: channel.id },
      create: { organizationId, channelId: channel.id, ...data },
      update: data,
    });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'channel.connected',
        targetType: 'channel',
        targetId: channel.id,
        metadata: { platform },
      },
    });
    await this.notifications.notify(
      organizationId,
      'CHANNEL_CONNECTED',
      `${account.displayName} connected`,
      undefined,
      '/channels',
    );
    return toChannelDto(channel);
  }

  async disconnect(organizationId: string, userId: string, channelId: string): Promise<void> {
    const db = this.prisma.tenant(organizationId);
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException();

    if (channel.credential && this.connectors.has(channel.platform)) {
      try {
        const token = await this.vault.decrypt(
          organizationId,
          channel.credential.accessTokenEnc,
          credentialContext.access(channel.id),
        );
        await this.connectors.get(channel.platform).revoke(token);
      } catch (err) {
        this.logger.warn(
          `Token revoke for channel ${channel.id} failed: ${(err as Error).message}`,
        );
      }
    }

    const pending = await db.postTarget.findMany({
      where: { channelId, status: { in: ['PENDING', 'QUEUED'] } },
      select: { id: true },
    });
    for (const t of pending) await this.queues.cancelPublish(t.id);
    await db.postTarget.updateMany({
      where: { channelId, status: { in: ['PENDING', 'QUEUED'] } },
      data: { status: 'CANCELED', lastError: 'Channel disconnected' },
    });
    await db.channelCredential.deleteMany({ where: { channelId } });
    await db.channel.update({ where: { id: channelId }, data: { status: 'DISCONNECTED' } });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'channel.disconnected',
        targetType: 'channel',
        targetId: channelId,
      },
    });
  }

  /** Used by account deletion: revoke every token of the organization. */
  async revokeAll(organizationId: string): Promise<void> {
    const channels = await withSystemTransaction(this.prisma, (tx) =>
      tx.channel.findMany({ where: { organizationId }, include: { credential: true } }),
    );
    for (const c of channels) {
      if (!c.credential || !this.connectors.has(c.platform)) continue;
      try {
        const token = await this.vault.decrypt(
          organizationId,
          c.credential.accessTokenEnc,
          credentialContext.access(c.id),
        );
        await this.connectors.get(c.platform).revoke(token);
      } catch {
        /* best effort */
      }
    }
  }
}

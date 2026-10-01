import { PermanentError } from '../errors';
import { expiresIn, poll, request } from '../http';
import {
  defaultContext,
  emptyMetrics,
  type AuthUrlParams,
  type ConnectedAccount,
  type ConnectorContext,
  type MediaRef,
  type OAuthClientConfig,
  type PlatformConnector,
  type PostMetrics,
  type PublishRequest,
  type PublishResult,
  type TokenSet,
} from '../types';

export const GRAPH_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Facebook Login shared by the Facebook Pages and Instagram connectors. The short-lived user token
 * is exchanged for a long-lived (~60 day) one; Page tokens derived from it do not expire.
 */
abstract class MetaConnector {
  abstract readonly scopes: string[];
  readonly usesPkce = false;

  constructor(
    protected readonly client: OAuthClientConfig,
    protected readonly ctx: ConnectorContext = defaultContext,
  ) {}

  getAuthUrl({ state, redirectUri }: AuthUrlParams): string {
    const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    u.search = new URLSearchParams({
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: this.scopes.join(','),
    }).toString();
    return u.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const short = await request(this.ctx, `${GRAPH}/oauth/access_token`, {
      query: {
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });
    return this.longLived(short.access_token);
  }

  /** Long-lived user tokens can be re-extended; Page tokens never expire. */
  async refresh(token: string): Promise<TokenSet> {
    return this.longLived(token);
  }

  private async longLived(token: string): Promise<TokenSet> {
    const res = await request(this.ctx, `${GRAPH}/oauth/access_token`, {
      query: {
        grant_type: 'fb_exchange_token',
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        fb_exchange_token: token,
      },
    });
    return {
      accessToken: res.access_token,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      scopes: this.scopes,
    };
  }

  protected graph<T = any>(
    path: string,
    token: string,
    opts: {
      method?: string;
      form?: Record<string, string | undefined>;
      query?: Record<string, string>;
    } = {},
  ) {
    return request<T>(this.ctx, `${GRAPH}/${path}`, {
      method: opts.method ?? (opts.form ? 'POST' : 'GET'),
      form: opts.form ? { ...opts.form, access_token: token } : undefined,
      query: opts.form ? opts.query : { ...opts.query, access_token: token },
    });
  }

  async revoke(accessToken: string): Promise<void> {
    await this.graph('me/permissions', accessToken, { method: 'DELETE' });
  }
}

export class FacebookConnector extends MetaConnector implements PlatformConnector {
  readonly platform = 'facebook' as const;
  readonly scopes = [
    'pages_show_list',
    'pages_manage_posts',
    'pages_read_engagement',
    'business_management',
  ];

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const res = await this.graph('me/accounts', token.accessToken, {
      query: { fields: 'id,name,access_token,picture{url}', limit: '100' },
    });
    return (res.data ?? []).map((page: any) => ({
      externalId: page.id,
      displayName: page.name,
      avatarUrl: page.picture?.data?.url ?? null,
      // Page tokens from a long-lived user token do not expire.
      token: { accessToken: page.access_token, expiresAt: null, scopes: this.scopes },
    }));
  }

  private async uploadPhotoSource(
    pageId: string,
    token: string,
    img: MediaRef,
    caption?: string,
    published = true,
  ): Promise<any> {
    const buf = await img.read();
    const blob = new Blob([buf], { type: img.mimeType || 'image/jpeg' });
    const form = new FormData();
    form.append('source', blob, 'photo.jpg');
    if (caption) form.append('caption', caption);
    if (!published) form.append('published', 'false');
    form.append('access_token', token);

    const res: any = await (
      await this.ctx.fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form })
    ).json();
    if (res.error) {
      throw new PermanentError(res.error.message || 'Facebook photo upload failed');
    }
    return res;
  }

  private async uploadVideoSource(
    pageId: string,
    token: string,
    video: MediaRef,
    description?: string,
  ): Promise<any> {
    const buf = await video.read();
    const blob = new Blob([buf], { type: video.mimeType || 'video/mp4' });
    const form = new FormData();
    form.append('source', blob, 'video.mp4');
    if (description) form.append('description', description);
    form.append('access_token', token);

    const res: any = await (
      await this.ctx.fetch(`${GRAPH}/${pageId}/videos`, { method: 'POST', body: form })
    ).json();
    if (res.error) {
      throw new PermanentError(res.error.message || 'Facebook video upload failed');
    }
    return res;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const pageId = req.account.externalId;
    const images = req.media.filter((m) => m.kind === 'image');
    const video = req.media.find((m) => m.kind === 'video');
    const isLocal = (url: string) => url.includes('localhost') || url.includes('127.0.0.1');
    let postId: string;

    if (video) {
      if (isLocal(video.publicUrl)) {
        const res = await this.uploadVideoSource(pageId, req.accessToken, video, req.text);
        postId = res.post_id ?? res.id;
      } else {
        try {
          const res = await this.graph(`${pageId}/videos`, req.accessToken, {
            form: { file_url: video.publicUrl, description: req.text },
          });
          postId = res.post_id ?? res.id;
        } catch {
          const res = await this.uploadVideoSource(pageId, req.accessToken, video, req.text);
          postId = res.post_id ?? res.id;
        }
      }
    } else if (images.length === 1) {
      const img = images[0]!;
      if (isLocal(img.publicUrl)) {
        const res = await this.uploadPhotoSource(pageId, req.accessToken, img, req.text);
        postId = res.post_id ?? res.id;
      } else {
        try {
          const res = await this.graph(`${pageId}/photos`, req.accessToken, {
            form: { url: img.publicUrl, caption: req.text },
          });
          postId = res.post_id ?? res.id;
        } catch {
          const res = await this.uploadPhotoSource(pageId, req.accessToken, img, req.text);
          postId = res.post_id ?? res.id;
        }
      }
    } else if (images.length > 1) {
      const ids: string[] = [];
      for (const img of images) {
        if (isLocal(img.publicUrl)) {
          const res = await this.uploadPhotoSource(pageId, req.accessToken, img, undefined, false);
          ids.push(res.id);
        } else {
          try {
            const res = await this.graph(`${pageId}/photos`, req.accessToken, {
              form: { url: img.publicUrl, published: 'false' },
            });
            ids.push(res.id);
          } catch {
            const res = await this.uploadPhotoSource(
              pageId,
              req.accessToken,
              img,
              undefined,
              false,
            );
            ids.push(res.id);
          }
        }
      }
      const form: Record<string, string> = { message: req.text };
      ids.forEach((id, i) => (form[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
      postId = (await this.graph(`${pageId}/feed`, req.accessToken, { form })).id;
    } else {
      if (!req.text.trim()) throw new PermanentError('Facebook posts need text or media');
      postId = (
        await this.graph(`${pageId}/feed`, req.accessToken, { form: { message: req.text } })
      ).id;
    }

    if (req.firstComment) {
      await this.graph(`${postId}/comments`, req.accessToken, {
        form: { message: req.firstComment },
      });
    }
    return { externalId: postId, url: `https://www.facebook.com/${postId}` };
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const res = await this.graph(externalId, accessToken, {
      query: {
        fields:
          'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares',
      },
    });
    return {
      ...emptyMetrics(),
      likes: res.reactions?.summary?.total_count ?? 0,
      comments: res.comments?.summary?.total_count ?? 0,
      shares: res.shares?.count ?? 0,
    };
  }

  async fetchFollowers(
    accessToken: string,
    account: PublishRequest['account'],
  ): Promise<number | null> {
    const res = await this.graph(account.externalId, accessToken, {
      query: { fields: 'followers_count' },
    });
    return res.followers_count ?? null;
  }

  async getChannelDetails(pageId: string, accessToken: string) {
    const pageInfo = await this.graph(pageId, accessToken, {
      query: { fields: 'id,name,about,picture{url},followers_count,fan_count' },
    }).catch(() => ({}));

    let posts: Array<{
      id: string;
      title: string;
      description: string;
      publishedAt: string;
      thumbnailUrl: string;
      views: number;
      likes: number;
      comments: number;
      duration: string;
      isShort: boolean;
      url: string;
    }> = [];

    const mapPost = (p: any) => {
      const msg = p.message || p.story || '';
      return {
        id: p.id,
        title: msg ? (msg.split('\n')[0] || 'Facebook Post').slice(0, 100) : 'Facebook Post',
        description: msg,
        publishedAt: p.created_time ?? '',
        thumbnailUrl: p.full_picture ?? '',
        views: 0,
        likes: p.reactions?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        duration: '',
        isShort: false,
        url: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
      };
    };

    const endpoints = ['published_posts', 'feed', 'posts'];
    const fieldOptions = [
      'id,message,story,created_time,full_picture,permalink_url,shares,reactions.summary(true),comments.summary(true)',
      'id,message,story,created_time,full_picture,permalink_url,shares',
      'id,message,story,created_time,full_picture,permalink_url',
      'id,message,created_time',
    ];

    for (const endpoint of endpoints) {
      if (posts.length > 0) break;
      for (const fields of fieldOptions) {
        try {
          const res = await this.graph(`${pageId}/${endpoint}`, accessToken, {
            query: { fields, limit: '50' },
          });
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            posts = res.data.map(mapPost);
            break;
          }
        } catch {
          // Try next field list
        }
      }
    }

    let weeklyImpressions: number | null = null;
    let weeklyEngaged: number | null = null;
    try {
      const insightsRes = await this.graph(`${pageId}/insights`, accessToken, {
        query: { metric: 'page_impressions_week,page_engaged_users', period: 'week' },
      });
      for (const item of insightsRes.data ?? []) {
        const val = item.values?.[item.values.length - 1]?.value ?? 0;
        if (item.name === 'page_impressions_week') weeklyImpressions = val;
        if (item.name === 'page_engaged_users') weeklyEngaged = val;
      }
    } catch {
      // insights may not be available for all accounts
    }

    return {
      channelId: pageInfo.id ?? pageId,
      title: pageInfo.name ?? 'Facebook Page',
      description: pageInfo.about ?? 'Connected Facebook Page',
      customUrl: null,
      avatarUrl: pageInfo.picture?.data?.url ?? null,
      bannerUrl: null,
      subscriberCount: pageInfo.followers_count ?? pageInfo.fan_count ?? null,
      viewCount: weeklyImpressions,
      weeklyEngaged,
      videoCount: posts.length,
      videos: posts,
    };
  }

  async getVideoComments(postId: string, accessToken: string) {
    try {
      const res = await this.graph(`${postId}/comments`, accessToken, {
        query: {
          fields: 'id,from,message,created_time,comments{id,from,message,created_time}',
          limit: '50',
        },
      });
      return (res.data ?? []).map((c: any) => ({
        id: c.id,
        authorName: c.from?.name ?? 'Facebook User',
        authorAvatarUrl: null,
        text: c.message ?? '',
        publishedAt: c.created_time ?? '',
        likeCount: 0,
        replyCount: c.comments?.data?.length ?? 0,
        replies: (c.comments?.data ?? []).map((r: any) => ({
          id: r.id,
          authorName: r.from?.name ?? 'Facebook User',
          authorAvatarUrl: null,
          text: r.message ?? '',
          publishedAt: r.created_time ?? '',
          likeCount: 0,
        })),
      }));
    } catch {
      return [];
    }
  }

  async replyToComment(
    params: { videoId: string; parentId?: string; text: string },
    accessToken: string,
  ) {
    const targetId = params.parentId || params.videoId;
    const res = await this.graph(`${targetId}/comments`, accessToken, {
      form: { message: params.text },
    });
    return {
      id: res.id,
      authorName: 'You',
      authorAvatarUrl: null,
      text: params.text,
      publishedAt: new Date().toISOString(),
      likeCount: 0,
    };
  }

  async likePost(postId: string, accessToken: string): Promise<{ liked: boolean }> {
    await this.graph(`${postId}/likes`, accessToken, { method: 'POST' });
    return { liked: true };
  }

  async deleteComment(commentId: string, accessToken: string): Promise<void> {
    await this.graph(commentId, accessToken, { method: 'DELETE' });
  }
}

export class InstagramConnector extends MetaConnector implements PlatformConnector {
  readonly platform = 'instagram' as const;
  readonly scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ];

  /** Instagram professional accounts are discovered through the Facebook Pages they're linked to. */
  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const res = await this.graph('me/accounts', token.accessToken, {
      query: {
        fields:
          'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
        limit: '100',
      },
    });
    return (res.data ?? [])
      .filter((page: any) => page.instagram_business_account)
      .map((page: any) => {
        const ig = page.instagram_business_account;
        return {
          externalId: ig.id,
          displayName: ig.name ?? ig.username,
          username: ig.username,
          avatarUrl: ig.profile_picture_url ?? null,
          metadata: { pageId: page.id, pageName: page.name },
          token: { accessToken: page.access_token, expiresAt: null, scopes: this.scopes },
        };
      });
  }

  private async createContainer(
    igId: string,
    token: string,
    media: MediaRef,
    extra: Record<string, string | undefined>,
  ) {
    const form: Record<string, string | undefined> =
      media.kind === 'video'
        ? { media_type: extra.media_type ?? 'REELS', video_url: media.publicUrl, ...extra }
        : { image_url: media.publicUrl, ...extra };
    if (media.kind === 'image' && extra.media_type === 'REELS') delete form.media_type;
    return (await this.graph(`${igId}/media`, token, { form })).id as string;
  }

  private waitForContainer(containerId: string, token: string) {
    return poll(
      this.ctx,
      async () => {
        const res = await this.graph(containerId, token, {
          query: { fields: 'status_code,status' },
        });
        if (res.status_code === 'FINISHED') return true;
        if (res.status_code === 'ERROR' || res.status_code === 'EXPIRED') {
          throw new PermanentError(
            `Instagram could not process the media: ${res.status ?? res.status_code}`,
          );
        }
        return undefined;
      },
      { intervalMs: 3000, timeoutMs: 5 * 60_000, what: 'Instagram media processing' },
    );
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const igId = req.account.externalId;
    if (req.media.length === 0)
      throw new PermanentError('Instagram posts need at least one image or video');

    // NOTE: Instagram requires publicly reachable URLs (Meta servers pull the media).
    // In local dev, MinIO at localhost:9000 is NOT reachable by Meta's servers.
    // For production, ensure S3_PUBLIC_URL points to a public hostname.
    // We no longer throw here so that local testing can proceed; publishing to Instagram
    // from localhost will fail at Meta's side with a clear API error.

    const type = req.options.igMediaType;
    let containerId: string;

    if (req.media.length === 1) {
      const media = req.media[0]!;
      const mediaType =
        type === 'STORIES' ? 'STORIES' : media.kind === 'video' ? 'REELS' : undefined;
      containerId = await this.createContainer(igId, req.accessToken, media, {
        caption: type === 'STORIES' ? undefined : req.text,
        media_type: mediaType,
      });
    } else {
      const children: string[] = [];
      for (const media of req.media) {
        const child = await this.createContainer(igId, req.accessToken, media, {
          is_carousel_item: 'true',
          media_type: media.kind === 'video' ? 'VIDEO' : undefined,
        });
        children.push(child);
      }
      for (const child of children) await this.waitForContainer(child, req.accessToken);
      containerId = (
        await this.graph(`${igId}/media`, req.accessToken, {
          form: { media_type: 'CAROUSEL', children: children.join(','), caption: req.text },
        })
      ).id;
    }

    await this.waitForContainer(containerId, req.accessToken);
    const published = await this.graph(`${igId}/media_publish`, req.accessToken, {
      form: { creation_id: containerId },
    });
    const mediaId: string = published.id;

    if (req.firstComment && type !== 'STORIES') {
      await this.graph(`${mediaId}/comments`, req.accessToken, {
        form: { message: req.firstComment },
      });
    }
    const info = await this.graph(mediaId, req.accessToken, {
      query: { fields: 'permalink' },
    }).catch(() => ({}));
    return { externalId: mediaId, url: (info as any).permalink ?? null };
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const res = await this.graph(externalId, accessToken, {
      query: { fields: 'like_count,comments_count' },
    });
    const metrics = {
      ...emptyMetrics(),
      likes: res.like_count ?? 0,
      comments: res.comments_count ?? 0,
    };
    try {
      const insights = await this.graph(`${externalId}/insights`, accessToken, {
        query: { metric: 'views,reach,shares' },
      });
      for (const item of insights.data ?? []) {
        const value = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
        if (item.name === 'views') metrics.views = value;
        if (item.name === 'reach') metrics.impressions = value;
        if (item.name === 'shares') metrics.shares = value;
      }
    } catch {
      // Insights are unavailable for some media types (e.g. stories after 24h); basic counts still count.
    }
    return metrics;
  }

  async fetchFollowers(
    accessToken: string,
    account: PublishRequest['account'],
  ): Promise<number | null> {
    const res = await this.graph(account.externalId, accessToken, {
      query: { fields: 'followers_count' },
    });
    return res.followers_count ?? null;
  }

  async getChannelDetails(igId: string, accessToken: string) {
    const info = await this.graph(igId, accessToken, {
      query: { fields: 'id,username,name,profile_picture_url,followers_count,media_count' },
    }).catch(() => ({}));

    let posts: Array<{
      id: string;
      title: string;
      description: string;
      publishedAt: string;
      thumbnailUrl: string;
      views: number;
      likes: number;
      comments: number;
      duration: string;
      isShort: boolean;
      url: string;
    }> = [];

    try {
      const mediaRes = await this.graph(`${igId}/media`, accessToken, {
        query: {
          fields:
            'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
          limit: '50',
        },
      });

      posts = (mediaRes.data ?? []).map((m: any) => ({
        id: m.id,
        title: m.caption ? (m.caption.split('\n')[0] || 'Instagram Post').slice(0, 100) : 'Instagram Post',
        description: m.caption ?? '',
        publishedAt: m.timestamp ?? '',
        thumbnailUrl: m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url || '') : (m.media_url || ''),
        views: 0,
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        duration: '',
        isShort: m.media_type === 'VIDEO' || m.media_type === 'REELS',
        url: m.permalink ?? `https://www.instagram.com/p/${m.id}`,
      }));
    } catch {
      // Ignore
    }

    return {
      channelId: info.id ?? igId,
      title: info.name ?? info.username ?? 'Instagram Account',
      description: 'Connected Instagram Account',
      customUrl: info.username ? `@${info.username}` : null,
      avatarUrl: info.profile_picture_url ?? null,
      bannerUrl: null,
      subscriberCount: info.followers_count ?? null,
      viewCount: null,
      videoCount: info.media_count ?? posts.length,
      videos: posts,
    };
  }

  async getVideoComments(mediaId: string, accessToken: string) {
    try {
      const res = await this.graph(`${mediaId}/comments`, accessToken, {
        query: {
          fields:
            'id,username,text,timestamp,like_count,replies{id,username,text,timestamp,like_count}',
          limit: '50',
        },
      });
      return (res.data ?? []).map((c: any) => ({
        id: c.id,
        authorName: c.username ? `@${c.username}` : 'Instagram User',
        authorAvatarUrl: null,
        text: c.text ?? '',
        publishedAt: c.timestamp ?? '',
        likeCount: c.like_count ?? 0,
        replyCount: c.replies?.data?.length ?? 0,
        replies: (c.replies?.data ?? []).map((r: any) => ({
          id: r.id,
          authorName: r.username ? `@${r.username}` : 'Instagram User',
          authorAvatarUrl: null,
          text: r.text ?? '',
          publishedAt: r.timestamp ?? '',
          likeCount: r.like_count ?? 0,
        })),
      }));
    } catch {
      return [];
    }
  }

  async replyToComment(
    params: { videoId: string; parentId?: string; text: string },
    accessToken: string,
  ) {
    const targetId = params.parentId || params.videoId;
    const res = await this.graph(`${targetId}/replies`, accessToken, {
      form: { message: params.text },
    }).catch(() =>
      this.graph(`${targetId}/comments`, accessToken, {
        form: { message: params.text },
      }),
    );
    return {
      id: res.id,
      authorName: 'You',
      authorAvatarUrl: null,
      text: params.text,
      publishedAt: new Date().toISOString(),
      likeCount: 0,
    };
  }

  async likePost(_mediaId: string, _accessToken: string): Promise<{ liked: boolean }> {
    // Instagram does not support liking own posts via API — return graceful no-op
    return { liked: false };
  }

  async deleteComment(commentId: string, accessToken: string): Promise<void> {
    await this.graph(commentId, accessToken, { method: 'DELETE' });
  }
}

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

  async publish(req: PublishRequest): Promise<PublishResult> {
    const pageId = req.account.externalId;
    const images = req.media.filter((m) => m.kind === 'image');
    const video = req.media.find((m) => m.kind === 'video');
    let postId: string;

    if (video) {
      const res = await this.graph(`${pageId}/videos`, req.accessToken, {
        form: { file_url: video.publicUrl, description: req.text },
      });
      postId = res.post_id ?? res.id;
    } else if (images.length === 1) {
      const res = await this.graph(`${pageId}/photos`, req.accessToken, {
        form: { url: images[0]!.publicUrl, caption: req.text },
      });
      postId = res.post_id ?? res.id;
    } else if (images.length > 1) {
      const ids: string[] = [];
      for (const img of images) {
        const res = await this.graph(`${pageId}/photos`, req.accessToken, {
          form: { url: img.publicUrl, published: 'false' },
        });
        ids.push(res.id);
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
}

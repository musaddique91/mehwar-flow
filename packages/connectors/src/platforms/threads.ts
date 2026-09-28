import { PLATFORM_RULES, splitIntoThread } from '@mehwar/shared';
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

const GRAPH = 'https://graph.threads.net/v1.0';

/**
 * Threads API. Long-lived tokens (~60 days) are refreshed with `th_refresh_token` using the token
 * itself, so we store the access token as the "refresh token" too. Long updates are published as a
 * chain of replies (`reply_to_id`).
 */
export class ThreadsConnector implements PlatformConnector {
  readonly platform = 'threads' as const;
  readonly scopes = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];
  readonly usesPkce = false;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
  ) {}

  getAuthUrl({ state, redirectUri }: AuthUrlParams): string {
    const u = new URL('https://threads.net/oauth/authorize');
    u.search = new URLSearchParams({
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      scope: this.scopes.join(','),
      response_type: 'code',
      state,
    }).toString();
    return u.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const short = await request(this.ctx, 'https://graph.threads.net/oauth/access_token', {
      form: {
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      },
    });
    const long = await request(this.ctx, 'https://graph.threads.net/access_token', {
      query: {
        grant_type: 'th_exchange_token',
        client_secret: this.client.clientSecret,
        access_token: short.access_token,
      },
    });
    return this.toTokenSet(long);
  }

  private toTokenSet(res: any): TokenSet {
    return {
      accessToken: res.access_token,
      refreshToken: res.access_token,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      scopes: this.scopes,
    };
  }

  async refresh(token: string): Promise<TokenSet> {
    const res = await request(this.ctx, 'https://graph.threads.net/refresh_access_token', {
      query: { grant_type: 'th_refresh_token', access_token: token },
    });
    return this.toTokenSet(res);
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const me = await request(this.ctx, `${GRAPH}/me`, {
      query: {
        fields: 'id,username,name,threads_profile_picture_url',
        access_token: token.accessToken,
      },
    });
    return [
      {
        externalId: me.id,
        displayName: me.name || me.username,
        username: me.username,
        avatarUrl: me.threads_profile_picture_url ?? null,
      },
    ];
  }

  private post(path: string, token: string, form: Record<string, string | undefined>) {
    return request(this.ctx, `${GRAPH}/${path}`, { form: { ...form, access_token: token } });
  }

  private async waitReady(containerId: string, token: string) {
    await poll(
      this.ctx,
      async () => {
        const res = await request(this.ctx, `${GRAPH}/${containerId}`, {
          query: { fields: 'status,error_message', access_token: token },
        });
        if (res.status === 'FINISHED' || res.status === 'PUBLISHED') return true;
        if (res.status === 'ERROR' || res.status === 'EXPIRED') {
          throw new PermanentError(
            `Threads could not process the media: ${res.error_message ?? res.status}`,
          );
        }
        return undefined;
      },
      { intervalMs: 2000, what: 'Threads media processing' },
    );
  }

  private mediaFields(media: MediaRef): Record<string, string> {
    return media.kind === 'video'
      ? { media_type: 'VIDEO', video_url: media.publicUrl }
      : { media_type: 'IMAGE', image_url: media.publicUrl };
  }

  private async createContainer(
    userId: string,
    token: string,
    text: string,
    media: MediaRef[],
    replyTo?: string,
  ) {
    const base = { text: text || undefined, reply_to_id: replyTo };
    if (media.length === 0)
      return (await this.post(`${userId}/threads`, token, { ...base, media_type: 'TEXT' })).id;
    if (media.length === 1)
      return (
        await this.post(`${userId}/threads`, token, { ...base, ...this.mediaFields(media[0]!) })
      ).id;
    const children: string[] = [];
    for (const m of media) {
      children.push(
        (
          await this.post(`${userId}/threads`, token, {
            ...this.mediaFields(m),
            is_carousel_item: 'true',
          })
        ).id,
      );
    }
    for (const child of children) await this.waitReady(child, token);
    return (
      await this.post(`${userId}/threads`, token, {
        ...base,
        media_type: 'CAROUSEL',
        children: children.join(','),
      })
    ).id;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const userId = req.account.externalId;
    const blocks = req.options.threadBlocks?.length
      ? req.options.threadBlocks
      : splitIntoThread(req.text, PLATFORM_RULES.threads.maxTextLength);
    if (blocks.length === 0 && req.media.length === 0) throw new PermanentError('Nothing to post');

    let firstId: string | undefined;
    let previous: string | undefined;
    for (const [i, text] of (blocks.length ? blocks : ['']).entries()) {
      const container = await this.createContainer(
        userId,
        req.accessToken,
        text,
        i === 0 ? req.media : [],
        previous,
      );
      await this.waitReady(container, req.accessToken);
      const published = await this.post(`${userId}/threads_publish`, req.accessToken, {
        creation_id: container,
      });
      previous = published.id as string;
      firstId ??= previous;
    }

    const info = await request(this.ctx, `${GRAPH}/${firstId}`, {
      query: { fields: 'permalink', access_token: req.accessToken },
    }).catch(() => ({}));
    return { externalId: firstId!, url: (info as any).permalink ?? null };
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const res = await request(this.ctx, `${GRAPH}/${externalId}/insights`, {
      query: { metric: 'views,likes,replies,reposts,quotes', access_token: accessToken },
    });
    const m = emptyMetrics();
    for (const item of res.data ?? []) {
      const v = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
      if (item.name === 'views') m.views = m.impressions = v;
      if (item.name === 'likes') m.likes = v;
      if (item.name === 'replies') m.comments = v;
      if (item.name === 'reposts' || item.name === 'quotes') m.shares += v;
    }
    return m;
  }

  async fetchFollowers(
    accessToken: string,
    account: PublishRequest['account'],
  ): Promise<number | null> {
    const res = await request(this.ctx, `${GRAPH}/${account.externalId}/threads_insights`, {
      query: { metric: 'followers_count', access_token: accessToken },
    });
    return res.data?.[0]?.total_value?.value ?? null;
  }

  async revoke(): Promise<void> {
    // Threads has no token revocation endpoint; users remove the app from their Threads settings.
  }
}

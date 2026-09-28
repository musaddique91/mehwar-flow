import { maxTextLength, splitIntoThread } from '@mehwar/shared';
import { PermanentError } from '../errors';
import { expiresIn, poll, request } from '../http';
import {
  defaultContext,
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

const API = 'https://api.x.com/2';
const CHUNK = 4 * 1024 * 1024;

/**
 * X (Twitter) API v2 with OAuth 2.0 + PKCE. Media goes through the v2 chunked upload
 * (initialize → append → finalize → status), then the media ids are attached to the post.
 * Refresh tokens are single-use: every refresh returns a new one that must replace the old.
 */
export class XConnector implements PlatformConnector {
  readonly platform = 'x' as const;
  readonly scopes = ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'];
  readonly usesPkce = true;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
  ) {}

  getAuthUrl({ state, redirectUri, codeChallenge }: AuthUrlParams): string {
    const u = new URL('https://x.com/i/oauth2/authorize');
    u.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      scope: this.scopes.join(' '),
      state,
      code_challenge: codeChallenge ?? '',
      code_challenge_method: 'S256',
    }).toString();
    return u.toString();
  }

  private basicAuth() {
    return `Basic ${Buffer.from(`${this.client.clientId}:${this.client.clientSecret}`).toString('base64')}`;
  }

  private toTokenSet(res: any): TokenSet {
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? null,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      scopes: String(res.scope ?? '')
        .split(' ')
        .filter(Boolean),
    };
  }

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet> {
    const res = await request(this.ctx, `${API}/oauth2/token`, {
      headers: { Authorization: this.basicAuth() },
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: this.client.clientId,
      },
    });
    return this.toTokenSet(res);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const res = await request(this.ctx, `${API}/oauth2/token`, {
      headers: { Authorization: this.basicAuth() },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.client.clientId,
      },
    });
    return this.toTokenSet(res);
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const res = await request(this.ctx, `${API}/users/me`, {
      bearer: token.accessToken,
      query: { 'user.fields': 'profile_image_url' },
    });
    const u = res.data;
    return [
      {
        externalId: u.id,
        displayName: u.name,
        username: u.username,
        avatarUrl: u.profile_image_url ?? null,
      },
    ];
  }

  private async uploadMedia(media: MediaRef, token: string): Promise<string> {
    const category =
      media.kind === 'video'
        ? 'tweet_video'
        : media.mimeType === 'image/gif'
          ? 'tweet_gif'
          : 'tweet_image';
    const init = await request(this.ctx, `${API}/media/upload/initialize`, {
      bearer: token,
      json: { media_type: media.mimeType, total_bytes: media.sizeBytes, media_category: category },
    });
    const mediaId: string = init.data.id;

    for (let start = 0, segment = 0; start < media.sizeBytes; start += CHUNK, segment++) {
      const end = Math.min(start + CHUNK, media.sizeBytes) - 1;
      const form = new FormData();
      form.set('segment_index', String(segment));
      form.set('media', new Blob([await media.read({ start, end })]), 'chunk');
      await request(this.ctx, `${API}/media/upload/${mediaId}/append`, {
        bearer: token,
        method: 'POST',
        body: form,
      });
    }

    const fin = await request(this.ctx, `${API}/media/upload/${mediaId}/finalize`, {
      bearer: token,
      method: 'POST',
    });
    let processing = fin?.data?.processing_info;
    if (processing) {
      await poll(
        this.ctx,
        async () => {
          if (processing.state === 'succeeded') return true;
          if (processing.state === 'failed')
            throw new PermanentError(processing.error?.message ?? 'X could not process the media');
          await this.ctx.sleep((processing.check_after_secs ?? 2) * 1000);
          const status = await request(this.ctx, `${API}/media/upload`, {
            bearer: token,
            query: { command: 'STATUS', media_id: mediaId },
          });
          processing = status.data.processing_info ?? { state: 'succeeded' };
          return undefined;
        },
        { intervalMs: 1, what: 'X media processing' },
      );
    }
    return mediaId;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const limit = maxTextLength('x', req.extendedTextLimit);
    const blocks = req.options.threadBlocks?.length
      ? req.options.threadBlocks
      : splitIntoThread(req.text, limit);
    if (blocks.length === 0 && req.media.length === 0) throw new PermanentError('Nothing to post');

    const mediaIds: string[] = [];
    for (const m of req.media) mediaIds.push(await this.uploadMedia(m, req.accessToken));

    let firstId: string | undefined;
    let previous: string | undefined;
    for (const [i, text] of (blocks.length ? blocks : ['']).entries()) {
      const res = await request(this.ctx, `${API}/tweets`, {
        bearer: req.accessToken,
        json: {
          ...(text ? { text } : {}),
          ...(i === 0 && mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
          ...(previous ? { reply: { in_reply_to_tweet_id: previous } } : {}),
        },
      });
      previous = res.data.id as string;
      firstId ??= previous;
    }
    const handle = req.account.username ?? 'i';
    return { externalId: firstId!, url: `https://x.com/${handle}/status/${firstId}` };
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const res = await request(this.ctx, `${API}/tweets/${externalId}`, {
      bearer: accessToken,
      query: { 'tweet.fields': 'public_metrics' },
    });
    const m = res.data?.public_metrics ?? {};
    return {
      impressions: m.impression_count ?? 0,
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      views: m.impression_count ?? 0,
    };
  }

  async fetchFollowers(accessToken: string): Promise<number | null> {
    const res = await request(this.ctx, `${API}/users/me`, {
      bearer: accessToken,
      query: { 'user.fields': 'public_metrics' },
    });
    return res.data?.public_metrics?.followers_count ?? null;
  }

  async revoke(accessToken: string): Promise<void> {
    await request(this.ctx, `${API}/oauth2/revoke`, {
      headers: { Authorization: this.basicAuth() },
      form: {
        token: accessToken,
        token_type_hint: 'access_token',
        client_id: this.client.clientId,
      },
    });
  }
}

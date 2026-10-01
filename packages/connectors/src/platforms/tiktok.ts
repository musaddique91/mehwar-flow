import { PermanentError, RetryableError, AuthError } from '../errors';
import { expiresIn, poll, request } from '../http';
import {
  defaultContext,
  emptyMetrics,
  type AuthUrlParams,
  type ConnectedAccount,
  type ConnectorContext,
  type OAuthClientConfig,
  type PlatformConnector,
  type PostMetrics,
  type PublishRequest,
  type PublishResult,
  type TokenSet,
} from '../types';

const API = 'https://open.tiktokapis.com/v2';

/**
 * TikTok Content Posting API. Videos are pulled by TikTok from our public media URL
 * (PULL_FROM_URL; the domain must be verified in the TikTok developer portal). Until the app passes
 * TikTok's audit, only SELF_ONLY posts are allowed.
 */
export class TikTokConnector implements PlatformConnector {
  readonly platform = 'tiktok' as const;
  readonly scopes = [
    'user.info.basic',
    'user.info.stats',
    'video.publish',
    'video.upload',
    'video.list',
  ];
  readonly usesPkce = false;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
  ) {}

  getAuthUrl({ state, redirectUri }: AuthUrlParams): string {
    const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
    u.search = new URLSearchParams({
      client_key: this.client.clientId,
      scope: this.scopes.join(','),
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    }).toString();
    return u.toString();
  }

  private toTokenSet(res: any): TokenSet {
    if (res.error && res.error !== 'ok') throw new AuthError(res.error_description ?? res.error);
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? null,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      refreshExpiresAt: expiresIn(this.ctx, res.refresh_expires_in),
      scopes: String(res.scope ?? '')
        .split(',')
        .filter(Boolean),
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    return this.toTokenSet(
      await request(this.ctx, `${API}/oauth/token/`, {
        form: {
          client_key: this.client.clientId,
          client_secret: this.client.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        },
      }),
    );
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return this.toTokenSet(
      await request(this.ctx, `${API}/oauth/token/`, {
        form: {
          client_key: this.client.clientId,
          client_secret: this.client.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
      }),
    );
  }

  /** TikTok returns HTTP 200 with `error.code != "ok"` for many failures. */
  private async call(path: string, token: string, json?: unknown, query?: Record<string, string>) {
    const res = await request(this.ctx, `${API}${path}`, {
      bearer: token,
      json,
      query,
      method: json ? 'POST' : 'GET',
    });
    const code = res?.error?.code;
    if (code && code !== 'ok') {
      const message = `${res.error.message || code}`;
      if (code === 'access_token_invalid' || code === 'scope_not_authorized')
        throw new AuthError(message);
      if (code === 'rate_limit_exceeded' || code === 'spam_risk_too_many_pending_share')
        throw new RetryableError(message);
      throw new PermanentError(message);
    }
    return res.data;
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const data = await this.call('/user/info/', token.accessToken, undefined, {
      fields: 'open_id,union_id,display_name,avatar_url,username',
    });
    const u = data.user;
    return [
      {
        externalId: u.open_id,
        displayName: u.display_name,
        username: u.username ?? null,
        avatarUrl: u.avatar_url ?? null,
      },
    ];
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const video = req.media.find((m) => m.kind === 'video');
    if (!video) throw new PermanentError('TikTok requires a video');

    const creator = await this.call('/post/publish/creator_info/query/', req.accessToken, {});
    const privacy = req.options.privacy;
    if (!privacy)
      throw new PermanentError('Choose who can view this TikTok (no default is allowed)');
    if (!creator.privacy_level_options?.includes(privacy)) {
      throw new PermanentError(
        `This account can't post with privacy "${privacy}". Allowed: ${creator.privacy_level_options?.join(', ')}`,
      );
    }
    if (
      creator.max_video_post_duration_sec &&
      video.durationSec &&
      video.durationSec > creator.max_video_post_duration_sec
    ) {
      throw new PermanentError(
        `This account can post videos up to ${creator.max_video_post_duration_sec}s`,
      );
    }

    const isLocal = (url: string) => url.includes('localhost') || url.includes('127.0.0.1');

    let init: { publish_id: string; upload_url?: string };
    if (isLocal(video.publicUrl)) {
      // Local dev: TikTok can't pull from localhost → use binary FILE_UPLOAD
      const buffer = await video.read();
      const chunkSize = 10 * 1024 * 1024; // 10 MB chunks
      const totalChunkCount = Math.ceil(buffer.byteLength / chunkSize);
      init = await this.call('/post/publish/video/init/', req.accessToken, {
        post_info: {
          title: req.text.slice(0, 2200),
          privacy_level: privacy,
          disable_comment: req.options.disableComment ?? false,
          disable_duet: req.options.disableDuet ?? false,
          disable_stitch: req.options.disableStitch ?? false,
          brand_content_toggle: req.options.brandContent ?? false,
          brand_organic_toggle: req.options.brandOrganic ?? false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: buffer.byteLength,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      });
      // Upload chunks to the upload_url returned by TikTok
      const uploadUrl = init.upload_url;
      if (uploadUrl) {
        for (let i = 0; i < totalChunkCount; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, buffer.byteLength);
          const chunk = buffer.subarray(start, end);
          await this.ctx.fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end - 1}/${buffer.byteLength}`,
            },
            body: chunk,
          });
        }
      }
    } else {
      // Production: MinIO public URL is reachable — let TikTok pull it
      init = await this.call('/post/publish/video/init/', req.accessToken, {
        post_info: {
          title: req.text.slice(0, 2200),
          privacy_level: privacy,
          disable_comment: req.options.disableComment ?? false,
          disable_duet: req.options.disableDuet ?? false,
          disable_stitch: req.options.disableStitch ?? false,
          brand_content_toggle: req.options.brandContent ?? false,
          brand_organic_toggle: req.options.brandOrganic ?? false,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: video.publicUrl },
      });
    }

    const publishId: string = init.publish_id;

    const status = await poll(
      this.ctx,
      async () => {
        const s = await this.call('/post/publish/status/fetch/', req.accessToken, {
          publish_id: publishId,
        });
        if (s.status === 'PUBLISH_COMPLETE') return s;
        if (s.status === 'FAILED')
          throw new PermanentError(
            `TikTok rejected the video: ${s.fail_reason ?? 'unknown reason'}`,
          );
        return undefined;
      },
      { intervalMs: 5000, timeoutMs: 10 * 60_000, what: 'TikTok processing' },
    );
    const postId =
      status.publicaly_available_post_id?.[0] ?? status.publicly_available_post_id?.[0];
    const handle = req.account.username;
    return {
      externalId: postId ? String(postId) : publishId,
      url: postId && handle ? `https://www.tiktok.com/@${handle}/video/${postId}` : null,
    };
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const data = await this.call(
      '/video/query/',
      accessToken,
      { filters: { video_ids: [externalId] } },
      { fields: 'id,like_count,comment_count,share_count,view_count' },
    );
    const v = data?.videos?.[0];
    if (!v) return emptyMetrics();
    return {
      impressions: v.view_count ?? 0,
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
    };
  }

  async fetchFollowers(accessToken: string): Promise<number | null> {
    const data = await this.call('/user/info/', accessToken, undefined, {
      fields: 'follower_count',
    });
    return data?.user?.follower_count ?? null;
  }

  async revoke(accessToken: string): Promise<void> {
    await request(this.ctx, `${API}/oauth/revoke/`, {
      form: {
        client_key: this.client.clientId,
        client_secret: this.client.clientSecret,
        token: accessToken,
      },
    });
  }
}

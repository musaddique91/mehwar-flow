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

  /**
   * Returns profile info + recent tweets (last 10) shaped to match
   * the channel details contract the API service expects.
   */
  async getChannelDetails(accessToken: string) {
    // Fetch authenticated user with follower count
    const meRes = await request(this.ctx, `${API}/users/me`, {
      bearer: accessToken,
      query: {
        'user.fields': 'profile_image_url,public_metrics,description,username',
      },
    });
    const me = meRes.data;

    // Fetch recent tweets (up to 10)
    let videos: any[] = [];
    try {
      const tweetsRes = await request(this.ctx, `${API}/users/${me.id}/tweets`, {
        bearer: accessToken,
        query: {
          max_results: '10',
          'tweet.fields': 'created_at,public_metrics,entities,attachments',
          'media.fields': 'url,preview_image_url,type',
          expansions: 'attachments.media_keys',
        },
      });

      const mediaMap: Record<string, any> = {};
      for (const m of tweetsRes.includes?.media ?? []) {
        mediaMap[m.media_key] = m;
      }

      videos = (tweetsRes.data ?? []).map((t: any) => {
        const metrics = t.public_metrics ?? {};
        const mediaKey = t.attachments?.media_keys?.[0];
        const media = mediaKey ? mediaMap[mediaKey] : null;
        const thumbUrl = media?.url ?? media?.preview_image_url ?? null;

        return {
          id: t.id,
          title: t.text?.slice(0, 120) || '(tweet)',
          description: t.text ?? '',
          thumbnailUrl: thumbUrl,
          publishedAt: t.created_at ?? null,
          url: `https://x.com/i/web/status/${t.id}`,
          views: metrics.impression_count ?? 0,
          likes: metrics.like_count ?? 0,
          comments: metrics.reply_count ?? 0,
          shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
          isShort: false,
          duration: null,
        };
      });
    } catch (err) {
      console.warn(`X: could not fetch tweets: ${(err as Error).message}`);
    }

    const pub = me.public_metrics ?? {};
    return {
      channelId: me.id,
      title: me.name,
      description: me.description ?? '',
      customUrl: `@${me.username}`,
      avatarUrl: me.profile_image_url ?? null,
      bannerUrl: null,
      subscriberCount: pub.followers_count ?? 0,
      viewCount: pub.tweet_count ?? 0,   // total tweets as "total reach" proxy
      videoCount: videos.length,
      videos,
    };
  }

  /**
   * Fetches the conversation / replies for a given tweet id.
   */
  async getVideoComments(tweetId: string, accessToken: string) {
    try {
      // Search recent tweets that reply to this tweet
      const res = await request(this.ctx, `${API}/tweets/search/recent`, {
        bearer: accessToken,
        query: {
          query: `conversation_id:${tweetId}`,
          max_results: '20',
          'tweet.fields': 'created_at,public_metrics,author_id',
          'user.fields': 'name,profile_image_url,username',
          expansions: 'author_id',
        },
      });

      const userMap: Record<string, any> = {};
      for (const u of res.includes?.users ?? []) {
        userMap[u.id] = u;
      }

      return (res.data ?? []).map((t: any) => {
        const author = userMap[t.author_id] ?? {};
        return {
          id: t.id,
          text: t.text ?? '',
          authorName: author.name ?? author.username ?? 'Unknown',
          authorAvatarUrl: author.profile_image_url ?? null,
          likeCount: t.public_metrics?.like_count ?? 0,
          publishedAt: t.created_at ?? null,
          replies: [],
        };
      });
    } catch (err) {
      console.warn(`X: could not fetch replies: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Posts a reply tweet to a given tweet (parentId = tweet being replied to).
   */
  async replyToComment(
    { videoId: _videoId, parentId, text }: { videoId: string; parentId?: string; text: string },
    accessToken: string,
  ) {
    const replyToId = parentId ?? _videoId;
    const res = await request(this.ctx, `${API}/tweets`, {
      bearer: accessToken,
      json: {
        text,
        reply: { in_reply_to_tweet_id: replyToId },
      },
    });
    return { id: res.data.id as string };
  }

  async likePost(tweetId: string, accessToken: string): Promise<{ liked: boolean }> {
    // First get the authenticated user's id
    const meRes = await request(this.ctx, `${API}/users/me`, { bearer: accessToken });
    const userId = meRes.data?.id as string;
    await request(this.ctx, `${API}/users/${userId}/likes`, {
      bearer: accessToken,
      json: { tweet_id: tweetId },
    });
    return { liked: true };
  }

  async retweetPost(tweetId: string, accessToken: string): Promise<{ retweeted: boolean }> {
    const meRes = await request(this.ctx, `${API}/users/me`, { bearer: accessToken });
    const userId = meRes.data?.id as string;
    await request(this.ctx, `${API}/users/${userId}/retweets`, {
      bearer: accessToken,
      json: { tweet_id: tweetId },
    });
    return { retweeted: true };
  }

  async deleteComment(_commentId: string, _accessToken: string): Promise<void> {
    // X API: DELETE /2/tweets/:id — only own tweets
    await request(this.ctx, `${API}/tweets/${_commentId}`, {
      bearer: _accessToken,
      method: 'DELETE',
    });
  }
}

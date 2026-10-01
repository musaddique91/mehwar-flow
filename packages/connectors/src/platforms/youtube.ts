import { PermanentError, RetryableError } from '../errors';
import { expiresIn, request, toError } from '../http';
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

const API = 'https://www.googleapis.com/youtube/v3';
/** Must be a multiple of 256 KiB. */
export const YOUTUBE_CHUNK = 8 * 1024 * 1024;
const MAX_RESUMES = 5;

/**
 * YouTube Data API v3. Uploads use the resumable protocol: the file is sent in 8 MB chunks and a
 * dropped connection resumes from the last byte YouTube confirmed.
 */
export class YouTubeConnector implements PlatformConnector {
  readonly platform = 'youtube' as const;
  readonly scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ];
  readonly usesPkce = true;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
    private readonly chunkSize = YOUTUBE_CHUNK,
  ) {}

  getAuthUrl({ state, redirectUri, codeChallenge }: AuthUrlParams): string {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      // Both are required for Google to return a refresh token every time.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      ...(codeChallenge ? { code_challenge: codeChallenge, code_challenge_method: 'S256' } : {}),
    }).toString();
    return u.toString();
  }

  private toTokenSet(res: any, previousRefresh?: string): TokenSet {
    return {
      accessToken: res.access_token,
      // Google only returns a refresh token on the first consent; keep the old one otherwise.
      refreshToken: res.refresh_token ?? previousRefresh ?? null,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      scopes: String(res.scope ?? '')
        .split(' ')
        .filter(Boolean),
    };
  }

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet> {
    const res = await request(this.ctx, 'https://oauth2.googleapis.com/token', {
      form: {
        code,
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      },
    });
    return this.toTokenSet(res);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const res = await request(this.ctx, 'https://oauth2.googleapis.com/token', {
      form: {
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
    });
    return this.toTokenSet(res, refreshToken);
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const res = await request(this.ctx, `${API}/channels`, {
      bearer: token.accessToken,
      query: { part: 'snippet', mine: 'true' },
    });
    return (res.items ?? []).map((c: any) => ({
      externalId: c.id,
      displayName: c.snippet.title,
      username: c.snippet.customUrl ?? null,
      avatarUrl: c.snippet.thumbnails?.default?.url ?? null,
    }));
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const video = req.media.find((m) => m.kind === 'video');
    if (!video) throw new PermanentError('YouTube requires a video');
    if (req.options.madeForKids === undefined) {
      throw new PermanentError('Choose whether the video is made for kids (required by COPPA)');
    }
    const title = (req.options.title || req.text.split('\n')[0] || 'Untitled').slice(0, 100);

    const start = (await request(this.ctx, 'https://www.googleapis.com/upload/youtube/v3/videos', {
      bearer: req.accessToken,
      query: { uploadType: 'resumable', part: 'snippet,status' },
      headers: {
        'X-Upload-Content-Length': String(video.sizeBytes),
        'X-Upload-Content-Type': video.mimeType,
      },
      json: {
        snippet: {
          title,
          description: (req.options.description ?? req.text).slice(0, 5000),
          tags: req.options.tags,
          categoryId: '22',
        },
        status: {
          privacyStatus: req.options.privacy ?? 'private',
          selfDeclaredMadeForKids: req.options.madeForKids,
        },
      },
      raw: true,
    })) as Response;
    const sessionUrl = start.headers.get('location');
    if (!sessionUrl) throw new RetryableError('YouTube did not return an upload session');

    const result = await this.uploadChunks(sessionUrl, req.accessToken, video);
    const videoId = result.id;

    // Upload custom thumbnail if provided
    const thumbMedia = req.media.find((m) => m.kind === 'thumbnail');
    if (thumbMedia) {
      try {
        const thumbBytes = await thumbMedia.read();
        await this.ctx.fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${req.accessToken}`,
              'Content-Type': thumbMedia.mimeType,
              'Content-Length': String(thumbBytes.length),
            },
            body: new Uint8Array(thumbBytes),
          },
        );
      } catch {
        // Thumbnail upload failure is non-fatal — video already published
      }
    }

    return { externalId: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  private async uploadChunks(
    sessionUrl: string,
    token: string,
    video: PublishRequest['media'][number],
  ) {
    const total = video.sizeBytes;
    let offset = 0;
    let resumes = 0;

    while (offset < total) {
      const end = Math.min(offset + this.chunkSize, total) - 1;
      let res: Response;
      try {
        const chunk = await video.read({ start: offset, end });
        res = await this.ctx.fetch(sessionUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${offset}-${end}/${total}`,
          },
          body: new Uint8Array(chunk),
        });
      } catch (err) {
        if (++resumes > MAX_RESUMES)
          throw new RetryableError(`Upload interrupted: ${(err as Error).message}`);
        offset = await this.queryOffset(sessionUrl, token, total);
        continue;
      }

      if (res.status === 200 || res.status === 201) return (await res.json()) as { id: string };
      if (res.status === 308) {
        offset = nextOffset(res.headers.get('range'));
        continue;
      }
      if (res.status >= 500 && ++resumes <= MAX_RESUMES) {
        await this.ctx.sleep(1000 * 2 ** resumes);
        offset = await this.queryOffset(sessionUrl, token, total);
        continue;
      }
      throw await toError(res);
    }
    // All bytes sent but no final response: ask for the status once more.
    const res = await this.ctx.fetch(sessionUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Range': `bytes */${total}` },
    });
    if (res.status === 200 || res.status === 201) return (await res.json()) as { id: string };
    throw await toError(res);
  }

  /** Asks YouTube how many bytes it has, so the upload resumes after a dropped connection. */
  private async queryOffset(sessionUrl: string, token: string, total: number): Promise<number> {
    const res = await this.ctx.fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': '0',
        'Content-Range': `bytes */${total}`,
      },
    });
    if (res.status === 308) return nextOffset(res.headers.get('range'));
    throw await toError(res);
  }

  async fetchMetrics(externalId: string, accessToken: string): Promise<PostMetrics> {
    const res = await request(this.ctx, `${API}/videos`, {
      bearer: accessToken,
      query: { part: 'statistics', id: externalId },
    });
    const s = res.items?.[0]?.statistics ?? {};
    return {
      ...emptyMetrics(),
      views: Number(s.viewCount ?? 0),
      impressions: Number(s.viewCount ?? 0),
      likes: Number(s.likeCount ?? 0),
      comments: Number(s.commentCount ?? 0),
    };
  }

  async fetchFollowers(accessToken: string): Promise<number | null> {
    const res = await request(this.ctx, `${API}/channels`, {
      bearer: accessToken,
      query: { part: 'statistics', mine: 'true' },
    });
    const n = res.items?.[0]?.statistics?.subscriberCount;
    return n === undefined ? null : Number(n);
  }

  async getChannelDetails(accessToken: string) {
    const channelRes = await request(this.ctx, `${API}/channels`, {
      bearer: accessToken,
      query: { part: 'snippet,statistics,brandingSettings,contentDetails', mine: 'true' },
    });

    const item = channelRes.items?.[0];
    if (!item) {
      throw new PermanentError('YouTube channel not found');
    }

    const snippet = item.snippet ?? {};
    const stats = item.statistics ?? {};
    const branding = item.brandingSettings ?? {};
    const contentDetails = item.contentDetails ?? {};

    let videos: Array<{
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

    const uploadsPlaylistId =
      contentDetails.relatedPlaylists?.uploads ||
      (item.id?.startsWith('UC') ? `UU${item.id.slice(2)}` : null);

    let videoIds: string[] = [];

    if (uploadsPlaylistId) {
      try {
        const playlistRes = await request(this.ctx, `${API}/playlistItems`, {
          bearer: accessToken,
          query: { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: '50' },
        });

        videoIds = (playlistRes.items ?? [])
          .map((i: any) => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
          .filter(Boolean);
      } catch {
        // Fallback to search
      }
    }

    if (videoIds.length === 0) {
      try {
        const searchRes = await request(this.ctx, `${API}/search`, {
          bearer: accessToken,
          query: { part: 'id', forMine: 'true', maxResults: '50', type: 'video', order: 'date' },
        });

        videoIds = (searchRes.items ?? [])
          .map((i: any) => i.id?.videoId)
          .filter(Boolean);
      } catch {
        // Search unavailable or scope limited
      }
    }

    if (videoIds.length > 0) {
      try {
        const videosRes = await request(this.ctx, `${API}/videos`, {
          bearer: accessToken,
          query: { part: 'snippet,statistics,contentDetails', id: videoIds.join(',') },
        });

        videos = (videosRes.items ?? []).map((v: any) => {
          const vSnippet = v.snippet ?? {};
          const vStats = v.statistics ?? {};
          const vDetails = v.contentDetails ?? {};
          const durationSec = parseIsoDurationSeconds(vDetails.duration ?? '');
          const isShort = durationSec > 0 && durationSec <= 60;
          const thumbnails = vSnippet.thumbnails ?? {};
          const thumb =
            thumbnails.maxres?.url ||
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default?.url ||
            '';

          return {
            id: v.id,
            title: vSnippet.title ?? 'Untitled',
            description: vSnippet.description ?? '',
            publishedAt: vSnippet.publishedAt ?? '',
            thumbnailUrl: thumb,
            views: Number(vStats.viewCount ?? 0),
            likes: Number(vStats.likeCount ?? 0),
            comments: Number(vStats.commentCount ?? 0),
            duration: vDetails.duration ?? 'PT0S',
            isShort,
            url: isShort
              ? `https://www.youtube.com/shorts/${v.id}`
              : `https://www.youtube.com/watch?v=${v.id}`,
          };
        });
      } catch {
        // Ignore
      }
    }

    const thumbnails = snippet.thumbnails ?? {};
    const avatar = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null;

    return {
      channelId: item.id,
      title: snippet.title ?? '',
      description: snippet.description ?? '',
      customUrl: snippet.customUrl ?? null,
      avatarUrl: avatar,
      bannerUrl: branding.image?.bannerExternalUrl ?? null,
      subscriberCount: stats.subscriberCount !== undefined ? Number(stats.subscriberCount) : null,
      viewCount: stats.viewCount !== undefined ? Number(stats.viewCount) : null,
      videoCount: stats.videoCount !== undefined ? Number(stats.videoCount) : null,
      videos,
    };
  }

  async getVideoComments(videoId: string, accessToken: string) {
    try {
      const res = await request(this.ctx, `${API}/commentThreads`, {
        bearer: accessToken,
        query: { part: 'snippet,replies', videoId, maxResults: '50', order: 'relevance' },
      });

      return (res.items ?? []).map((item: any) => {
        const top = item.snippet?.topLevelComment?.snippet ?? {};
        const topId = item.snippet?.topLevelComment?.id ?? item.id;
        const repliesData = item.replies?.comments ?? [];

        return {
          id: topId,
          authorName: top.authorDisplayName ?? 'Anonymous',
          authorAvatarUrl: top.authorProfileImageUrl ?? null,
          authorChannelUrl: top.authorChannelUrl ?? null,
          text: top.textDisplay ?? top.textOriginal ?? '',
          publishedAt: top.publishedAt ?? '',
          likeCount: Number(top.likeCount ?? 0),
          replyCount: Number(item.snippet?.totalReplyCount ?? repliesData.length ?? 0),
          replies: repliesData.map((r: any) => {
            const rSnip = r.snippet ?? {};
            return {
              id: r.id,
              authorName: rSnip.authorDisplayName ?? 'Anonymous',
              authorAvatarUrl: rSnip.authorProfileImageUrl ?? null,
              authorChannelUrl: rSnip.authorChannelUrl ?? null,
              text: rSnip.textDisplay ?? rSnip.textOriginal ?? '',
              publishedAt: rSnip.publishedAt ?? '',
              likeCount: Number(rSnip.likeCount ?? 0),
            };
          }),
        };
      });
    } catch {
      return [];
    }
  }

  async replyToComment(
    params: { videoId: string; parentId?: string; text: string },
    accessToken: string,
  ) {
    if (params.parentId) {
      const res = await request(this.ctx, `${API}/comments`, {
        bearer: accessToken,
        query: { part: 'snippet' },
        json: {
          snippet: {
            parentId: params.parentId,
            textOriginal: params.text,
          },
        },
      });
      const snip = res.snippet ?? {};
      return {
        id: res.id,
        authorName: snip.authorDisplayName ?? 'You',
        authorAvatarUrl: snip.authorProfileImageUrl ?? null,
        text: snip.textDisplay ?? snip.textOriginal ?? params.text,
        publishedAt: snip.publishedAt ?? new Date().toISOString(),
        likeCount: 0,
      };
    } else {
      const res = await request(this.ctx, `${API}/commentThreads`, {
        bearer: accessToken,
        query: { part: 'snippet' },
        json: {
          snippet: {
            videoId: params.videoId,
            topLevelComment: {
              snippet: {
                textOriginal: params.text,
              },
            },
          },
        },
      });
      const top = res.snippet?.topLevelComment?.snippet ?? {};
      return {
        id: res.id,
        authorName: top.authorDisplayName ?? 'You',
        authorAvatarUrl: top.authorProfileImageUrl ?? null,
        text: top.textDisplay ?? top.textOriginal ?? params.text,
        publishedAt: top.publishedAt ?? new Date().toISOString(),
        likeCount: 0,
        replyCount: 0,
        replies: [],
      };
    }
  }

  async likePost(videoId: string, accessToken: string): Promise<{ liked: boolean }> {
    // YouTube Data API: rate a video (like)
    await request(this.ctx, `${API}/videos/rate`, {
      bearer: accessToken,
      query: { id: videoId, rating: 'like' },
      method: 'POST',
    });
    return { liked: true };
  }

  async deleteComment(commentId: string, accessToken: string): Promise<void> {
    await request(this.ctx, `${API}/comments`, {
      bearer: accessToken,
      query: { id: commentId },
      method: 'DELETE',
    });
  }

  async revoke(accessToken: string): Promise<void> {
    await request(this.ctx, 'https://oauth2.googleapis.com/revoke', {
      form: { token: accessToken },
    });
  }
}

function parseIsoDurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function nextOffset(range: string | null): number {
  // "bytes=0-524287" means bytes 0..524287 were received.
  const m = range?.match(/bytes=\d+-(\d+)/);
  return m ? Number(m[1]) + 1 : 0;
}

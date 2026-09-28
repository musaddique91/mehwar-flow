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
    return { externalId: result.id, url: `https://www.youtube.com/watch?v=${result.id}` };
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

  async revoke(accessToken: string): Promise<void> {
    await request(this.ctx, 'https://oauth2.googleapis.com/revoke', {
      form: { token: accessToken },
    });
  }
}

function nextOffset(range: string | null): number {
  // "bytes=0-524287" means bytes 0..524287 were received.
  const m = range?.match(/bytes=\d+-(\d+)/);
  return m ? Number(m[1]) + 1 : 0;
}

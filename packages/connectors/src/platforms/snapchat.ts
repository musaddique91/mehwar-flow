import { PermanentError } from '../errors';
import { expiresIn, request } from '../http';
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

/**
 * Snapchat (behind FEATURE_SNAPCHAT). Login Kit OAuth and account discovery work for any Snap Kit
 * app. Publishing to a Public Profile needs Snap's partner-only Public Profile API; until that access
 * is granted and its endpoint configured (SNAPCHAT_PUBLISH_URL), publishing fails with a clear
 * message instead of pretending to succeed.
 */
export class SnapchatConnector implements PlatformConnector {
  readonly platform = 'snapchat' as const;
  readonly scopes = [
    'https://auth.snapchat.com/oauth2/api/user.display_name',
    'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
    'https://auth.snapchat.com/oauth2/api/user.external_id',
  ];
  readonly usesPkce = true;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
    private readonly publishUrl?: string,
  ) {}

  getAuthUrl({ state, redirectUri, codeChallenge }: AuthUrlParams): string {
    const u = new URL('https://accounts.snapchat.com/login/oauth2/authorize');
    u.search = new URLSearchParams({
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
      ...(codeChallenge ? { code_challenge: codeChallenge, code_challenge_method: 'S256' } : {}),
    }).toString();
    return u.toString();
  }

  private basic() {
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
    return this.toTokenSet(
      await request(this.ctx, 'https://accounts.snapchat.com/login/oauth2/access_token', {
        headers: { Authorization: this.basic() },
        form: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        },
      }),
    );
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return this.toTokenSet(
      await request(this.ctx, 'https://accounts.snapchat.com/login/oauth2/access_token', {
        headers: { Authorization: this.basic() },
        form: { grant_type: 'refresh_token', refresh_token: refreshToken },
      }),
    );
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const res = await request(this.ctx, 'https://kit.snapchat.com/v1/me', {
      bearer: token.accessToken,
      json: { query: '{me{externalId displayName bitmoji{avatar}}}' },
    });
    const me = res.data.me;
    return [
      {
        externalId: me.externalId,
        displayName: me.displayName,
        avatarUrl: me.bitmoji?.avatar ?? null,
      },
    ];
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const media = req.media[0];
    if (!media) throw new PermanentError('Snapchat needs a vertical 9:16 image or video');
    if (media.kind === 'video' && (media.durationSec ?? 0) > 60)
      throw new PermanentError('Snapchat videos must be 60s or shorter');
    if (media.width && media.height && Math.abs(media.width / media.height - 9 / 16) > 0.02) {
      throw new PermanentError('Snapchat requires vertical 9:16 media');
    }
    if (!this.publishUrl) {
      throw new PermanentError(
        'Snapchat publishing needs Snap Public Profile API access. Ask Snap for partner access and set SNAPCHAT_PUBLISH_URL.',
      );
    }
    const res = await request(this.ctx, this.publishUrl, {
      bearer: req.accessToken,
      json: {
        profile_id: req.account.externalId,
        media_url: media.publicUrl,
        media_type: media.kind.toUpperCase(),
        caption: req.text,
      },
    });
    return { externalId: String(res.id ?? res.story_id ?? res.snap_id), url: null };
  }

  async fetchMetrics(): Promise<PostMetrics> {
    return emptyMetrics();
  }

  async fetchFollowers(): Promise<number | null> {
    return null;
  }

  async revoke(accessToken: string): Promise<void> {
    await request(this.ctx, 'https://accounts.snapchat.com/login/oauth2/revoke_token', {
      headers: { Authorization: this.basic() },
      form: { token: accessToken },
    }).catch(() => undefined);
  }
}

import type { Platform, TargetOptions } from '@mehwar/shared';

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
  scopes: string[];
}

/** An account/page/channel the user can publish to, discovered after OAuth. */
export interface ConnectedAccount {
  externalId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
  /** Account-specific token (e.g. a Facebook Page token). Falls back to the user token. */
  token?: TokenSet;
}

export interface MediaRef {
  kind: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  /** Publicly reachable URL, for platforms that pull media (Meta, Threads, TikTok). */
  publicUrl: string;
  /** Reads bytes [start, end] inclusive, for platforms that receive uploads (X, YouTube). */
  read(range?: { start: number; end: number }): Promise<Buffer>;
}

export interface PublishRequest {
  text: string;
  media: MediaRef[];
  options: TargetOptions;
  firstComment?: string | null;
  /** X Premium: allow up to 25,000 characters per post. */
  extendedTextLimit?: boolean;
  accessToken: string;
  account: { externalId: string; username?: string | null; metadata: Record<string, unknown> };
}

export interface PublishResult {
  externalId: string;
  url?: string | null;
}

export interface PostMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/** Side effects injected so tests run instantly and deterministically. */
export interface ConnectorContext {
  fetch: typeof fetch;
  sleep(ms: number): Promise<void>;
  now(): number;
}

export const defaultContext: ConnectorContext = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

export interface AuthUrlParams {
  state: string;
  redirectUri: string;
  /** Present when the connector uses PKCE. */
  codeChallenge?: string;
}

export interface PlatformConnector {
  readonly platform: Platform;
  readonly scopes: string[];
  readonly usesPkce: boolean;
  getAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet>;
  listAccounts(token: TokenSet): Promise<ConnectedAccount[]>;
  /** Exchanges a refresh token for fresh credentials. */
  refresh(refreshToken: string): Promise<TokenSet>;
  publish(req: PublishRequest): Promise<PublishResult>;
  fetchMetrics(
    externalId: string,
    accessToken: string,
    account: PublishRequest['account'],
  ): Promise<PostMetrics>;
  fetchFollowers(accessToken: string, account: PublishRequest['account']): Promise<number | null>;
  revoke(accessToken: string): Promise<void>;
}

export const emptyMetrics = (): PostMetrics => ({
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  views: 0,
});

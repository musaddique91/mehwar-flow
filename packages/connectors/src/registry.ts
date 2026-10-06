import type { Platform } from '@mehwar/shared';
import { NotConfiguredError } from './errors';
import { FacebookConnector, InstagramConnector } from './platforms/meta';
import { LinkedInConnector } from './platforms/linkedin';
import { SnapchatConnector } from './platforms/snapchat';
import { ThreadsConnector } from './platforms/threads';
import { TikTokConnector } from './platforms/tiktok';
import { XConnector } from './platforms/x';
import { YouTubeConnector } from './platforms/youtube';
import {
  defaultContext,
  type ConnectorContext,
  type OAuthClientConfig,
  type PlatformConnector,
} from './types';

/** Env var prefix holding each platform's OAuth client credentials. */
const ENV_PREFIX: Record<Platform, string> = {
  x: 'X',
  facebook: 'META',
  instagram: 'META',
  threads: 'THREADS',
  youtube: 'GOOGLE',
  tiktok: 'TIKTOK',
  snapchat: 'SNAPCHAT',
  linkedin: 'LINKEDIN',
  whatsapp: 'WHATSAPP',
};

export function clientConfigFromEnv(
  platform: Platform,
  env: NodeJS.ProcessEnv = process.env,
): OAuthClientConfig | null {
  const prefix = ENV_PREFIX[platform];
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  if (platform === 'snapchat' && env.FEATURE_SNAPCHAT !== 'true') return null;
  return { clientId, clientSecret };
}

export class ConnectorRegistry {
  private readonly connectors = new Map<Platform, PlatformConnector>();

  constructor(connectors: PlatformConnector[]) {
    for (const c of connectors) this.connectors.set(c.platform, c);
  }

  /** Builds connectors for every platform whose credentials are present in the environment. */
  static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
    ctx: ConnectorContext = defaultContext,
  ): ConnectorRegistry {
    const list: PlatformConnector[] = [];
    const cfg = (p: Platform) => clientConfigFromEnv(p, env);
    const x = cfg('x');
    if (x) list.push(new XConnector(x, ctx));
    const meta = cfg('facebook');
    if (meta) list.push(new FacebookConnector(meta, ctx), new InstagramConnector(meta, ctx));
    const threads = cfg('threads');
    if (threads) list.push(new ThreadsConnector(threads, ctx));
    const google = cfg('youtube');
    if (google) list.push(new YouTubeConnector(google, ctx));
    const tiktok = cfg('tiktok');
    if (tiktok) list.push(new TikTokConnector(tiktok, ctx));
    const snap = cfg('snapchat');
    if (snap) list.push(new SnapchatConnector(snap, ctx, env.SNAPCHAT_PUBLISH_URL));
    const linkedin = cfg('linkedin');
    if (linkedin) list.push(new LinkedInConnector(linkedin, ctx));
    return new ConnectorRegistry(list);
  }

  has(platform: Platform): boolean {
    return this.connectors.has(platform);
  }

  get(platform: Platform): PlatformConnector {
    const c = this.connectors.get(platform);
    if (!c) throw new NotConfiguredError(platform);
    return c;
  }

  available(): Platform[] {
    return [...this.connectors.keys()];
  }
}

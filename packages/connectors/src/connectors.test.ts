import { describe, expect, it } from 'vitest';
import { AuthError, PermanentError, RetryableError } from './errors';
import { FacebookConnector, InstagramConnector } from './platforms/meta';
import { LinkedInConnector } from './platforms/linkedin';
import { SnapchatConnector } from './platforms/snapchat';
import { ThreadsConnector } from './platforms/threads';
import { TikTokConnector } from './platforms/tiktok';
import { XConnector } from './platforms/x';
import { YouTubeConnector } from './platforms/youtube';
import { ConnectorRegistry } from './registry';
import { fakeContext, fakeMedia } from './testing';
import type { PublishRequest } from './types';

const client = { clientId: 'id', clientSecret: 'secret' };
const baseReq = (over: Partial<PublishRequest> = {}): PublishRequest => ({
  text: 'Hello world',
  media: [],
  options: {},
  accessToken: 'token',
  account: { externalId: 'acct', username: 'handle', metadata: {} },
  ...over,
});

describe('error classification', () => {
  it('maps HTTP errors to retryable / auth / permanent', async () => {
    const { ctx } = fakeContext({
      'POST https://api.x.com/2/tweets': [
        () => ({
          status: 429,
          json: { title: 'Too Many Requests' },
          headers: { 'retry-after': '30' },
        }),
        () => ({ status: 401, json: { title: 'Unauthorized' } }),
        () => ({ status: 403, json: { detail: 'You are not permitted to perform this action.' } }),
        () => new TypeError('socket hang up'),
      ],
    });
    const x = new XConnector(client, ctx);
    const err1 = await x.publish(baseReq()).catch((e) => e);
    expect(err1).toBeInstanceOf(RetryableError);
    expect(err1.retryAfterMs).toBe(30_000);
    await expect(x.publish(baseReq())).rejects.toBeInstanceOf(AuthError);
    await expect(x.publish(baseReq())).rejects.toThrow(PermanentError);
    await expect(x.publish(baseReq())).rejects.toBeInstanceOf(RetryableError);
  });

  it('treats Meta code 190 as auth and transient errors as retryable', async () => {
    const { ctx } = fakeContext({
      'POST https://graph.facebook.com/v23.0/page/feed': [
        () => ({ status: 400, json: { error: { message: 'Session expired', code: 190 } } }),
        () => ({
          status: 400,
          json: { error: { message: 'Try later', code: 2, is_transient: true } },
        }),
      ],
    });
    const fb = new FacebookConnector(client, ctx);
    const req = baseReq({ account: { externalId: 'page', metadata: {} } });
    await expect(fb.publish(req)).rejects.toBeInstanceOf(AuthError);
    await expect(fb.publish(req)).rejects.toBeInstanceOf(RetryableError);
  });
});

describe('X', () => {
  it('builds a PKCE auth URL with offline access', () => {
    const url = new URL(
      new XConnector(client).getAuthUrl({
        state: 's',
        redirectUri: 'https://app/cb',
        codeChallenge: 'c',
      }),
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('offline.access');
    expect(url.searchParams.get('scope')).toContain('media.write');
  });

  it('uploads media in chunks, waits for processing and posts a thread', async () => {
    const { ctx, calls } = fakeContext({
      'POST https://api.x.com/2/media/upload/initialize': () => ({ json: { data: { id: 'm1' } } }),
      'POST https://api.x.com/2/media/upload/m1/append': () => ({ status: 204 }),
      'POST https://api.x.com/2/media/upload/m1/finalize': () => ({
        json: { data: { id: 'm1', processing_info: { state: 'pending', check_after_secs: 1 } } },
      }),
      'GET https://api.x.com/2/media/upload?': [
        () => ({
          json: { data: { processing_info: { state: 'in_progress', check_after_secs: 1 } } },
        }),
        () => ({ json: { data: { processing_info: { state: 'succeeded' } } } }),
      ],
      'POST https://api.x.com/2/tweets': [
        () => ({ json: { data: { id: 't1' } } }),
        () => ({ json: { data: { id: 't2' } } }),
      ],
    });
    const x = new XConnector(client, ctx);
    const result = await x.publish(
      baseReq({
        media: [fakeMedia('video', 5 * 1024 * 1024)],
        options: { threadBlocks: ['first', 'second'] },
      }),
    );
    expect(result).toEqual({ externalId: 't1', url: 'https://x.com/handle/status/t1' });
    expect(calls.filter((c) => c.url.includes('/append'))).toHaveLength(2); // 5 MB in 4 MB chunks
    const tweets = calls.filter((c) => c.url.endsWith('/2/tweets'));
    expect(tweets[0]!.body).toEqual({ text: 'first', media: { media_ids: ['m1'] } });
    expect(tweets[1]!.body).toEqual({ text: 'second', reply: { in_reply_to_tweet_id: 't1' } });
  });

  it('auto-splits long text into a thread at 280 characters unless Premium', async () => {
    const posted: unknown[] = [];
    const { ctx } = fakeContext({
      'POST https://api.x.com/2/tweets': (c) => {
        posted.push(c.body);
        return { json: { data: { id: `t${posted.length}` } } };
      },
    });
    const text = 'This is a sentence. '.repeat(30).trim();
    await new XConnector(client, ctx).publish(baseReq({ text }));
    expect(posted.length).toBeGreaterThan(1);
    posted.length = 0;
    await new XConnector(client, ctx).publish(baseReq({ text, extendedTextLimit: true }));
    expect(posted).toHaveLength(1);
  });

  it('rotates refresh tokens', async () => {
    const { ctx, calls } = fakeContext({
      'POST https://api.x.com/2/oauth2/token': () => ({
        json: {
          access_token: 'new-a',
          refresh_token: 'new-r',
          expires_in: 7200,
          scope: 'tweet.read tweet.write',
        },
      }),
    });
    const tokens = await new XConnector(client, ctx).refresh('old-r');
    expect(tokens.refreshToken).toBe('new-r');
    expect(tokens.expiresAt?.getTime()).toBe(ctx.now() + 7200_000);
    expect(calls[0]!.headers.Authorization).toMatch(/^Basic /);
  });
});

describe('Facebook', () => {
  it('exchanges for a long-lived token and lists pages with page tokens', async () => {
    const { ctx } = fakeContext({
      'GET https://graph.facebook.com/v23.0/oauth/access_token?client_id': [
        () => ({ json: { access_token: 'short' } }),
      ],
      'GET https://graph.facebook.com/v23.0/oauth/access_token?grant_type': () => ({
        json: { access_token: 'long', expires_in: 5184000 },
      }),
      'GET https://graph.facebook.com/v23.0/me/accounts': () => ({
        json: {
          data: [
            {
              id: 'p1',
              name: 'My Page',
              access_token: 'page-token',
              picture: { data: { url: 'pic' } },
            },
          ],
        },
      }),
    });
    const fb = new FacebookConnector(client, ctx);
    const token = await fb.exchangeCode('code', 'https://app/cb');
    expect(token.accessToken).toBe('long');
    const [page] = await fb.listAccounts(token);
    expect(page).toMatchObject({
      externalId: 'p1',
      displayName: 'My Page',
      token: { accessToken: 'page-token', expiresAt: null },
    });
  });

  it('publishes multi-photo posts via unpublished photos + attached_media, then the first comment', async () => {
    let photo = 0;
    const { ctx, calls } = fakeContext({
      'POST https://graph.facebook.com/v23.0/page/photos': () => ({ json: { id: `ph${++photo}` } }),
      'POST https://graph.facebook.com/v23.0/page/feed': () => ({ json: { id: 'page_post' } }),
      'POST https://graph.facebook.com/v23.0/page_post/comments': () => ({ json: { id: 'c1' } }),
    });
    const result = await new FacebookConnector(client, ctx).publish(
      baseReq({
        account: { externalId: 'page', metadata: {} },
        media: [fakeMedia('image'), fakeMedia('image')],
        firstComment: 'Link in comments',
      }),
    );
    expect(result.externalId).toBe('page_post');
    expect(calls[0]!.body).toMatchObject({
      published: 'false',
      url: expect.stringContaining('/public/'),
    });
    const feed = calls.find((c) => c.url.endsWith('/page/feed'))!;
    expect(feed.body).toMatchObject({
      message: 'Hello world',
      'attached_media[0]': '{"media_fbid":"ph1"}',
      'attached_media[1]': '{"media_fbid":"ph2"}',
    });
    expect(calls.at(-1)!.body).toMatchObject({ message: 'Link in comments' });
  });
});

describe('Instagram', () => {
  it('only lists pages that have a linked Instagram professional account', async () => {
    const { ctx } = fakeContext({
      'GET https://graph.facebook.com/v23.0/me/accounts': () => ({
        json: {
          data: [
            { id: 'p1', name: 'No IG', access_token: 't1' },
            {
              id: 'p2',
              name: 'Brand',
              access_token: 't2',
              instagram_business_account: { id: 'ig2', username: 'brand' },
            },
          ],
        },
      }),
    });
    const accounts = await new InstagramConnector(client, ctx).listAccounts({
      accessToken: 'u',
      scopes: [],
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      externalId: 'ig2',
      username: 'brand',
      metadata: { pageId: 'p2' },
    });
  });

  it('creates a carousel, polls containers until FINISHED, publishes and comments', async () => {
    let child = 0;
    const { ctx, calls } = fakeContext({
      'POST https://graph.facebook.com/v23.0/ig/media_publish': () => ({ json: { id: 'media1' } }),
      'POST https://graph.facebook.com/v23.0/ig/media': (c) =>
        (c.body as any).media_type === 'CAROUSEL'
          ? { json: { id: 'parent' } }
          : { json: { id: `child${++child}` } },
      'GET https://graph.facebook.com/v23.0/child1?': () => ({ json: { status_code: 'FINISHED' } }),
      'GET https://graph.facebook.com/v23.0/child2?': [
        () => ({ json: { status_code: 'IN_PROGRESS' } }),
        () => ({ json: { status_code: 'FINISHED' } }),
      ],
      'GET https://graph.facebook.com/v23.0/parent?': () => ({ json: { status_code: 'FINISHED' } }),
      'POST https://graph.facebook.com/v23.0/media1/comments': () => ({ json: { id: 'c' } }),
      'GET https://graph.facebook.com/v23.0/media1?': () => ({
        json: { permalink: 'https://instagram.com/p/abc' },
      }),
    });
    const result = await new InstagramConnector(client, ctx).publish(
      baseReq({
        account: { externalId: 'ig', metadata: {} },
        media: [fakeMedia('image'), fakeMedia('video')],
        firstComment: '#tags',
      }),
    );
    expect(result).toEqual({ externalId: 'media1', url: 'https://instagram.com/p/abc' });
    const parent = calls.find((c) => (c.body as any)?.media_type === 'CAROUSEL')!;
    expect(parent.body).toMatchObject({ children: 'child1,child2', caption: 'Hello world' });
    expect(calls.find((c) => (c.body as any)?.video_url)!.body).toMatchObject({
      media_type: 'VIDEO',
      is_carousel_item: 'true',
    });
  });

  it('fails permanently when Instagram rejects the media', async () => {
    const { ctx } = fakeContext({
      'POST https://graph.facebook.com/v23.0/ig/media': () => ({ json: { id: 'c1' } }),
      'GET https://graph.facebook.com/v23.0/c1?': () => ({
        json: { status_code: 'ERROR', status: 'Unsupported format' },
      }),
    });
    await expect(
      new InstagramConnector(client, ctx).publish(
        baseReq({ account: { externalId: 'ig', metadata: {} }, media: [fakeMedia('image')] }),
      ),
    ).rejects.toThrow(/Unsupported format/);
  });

  it('refuses text-only posts', async () => {
    const { ctx } = fakeContext({});
    await expect(new InstagramConnector(client, ctx).publish(baseReq())).rejects.toBeInstanceOf(
      PermanentError,
    );
  });
});

describe('Threads', () => {
  it('publishes long text as a reply chain', async () => {
    let n = 0;
    const { ctx, calls } = fakeContext({
      'POST https://graph.threads.net/v1.0/acct/threads_publish': () => ({
        json: { id: `post${++n}` },
      }),
      'POST https://graph.threads.net/v1.0/acct/threads': () => ({
        json: { id: `container${n + 1}` },
      }),
      'GET https://graph.threads.net/v1.0/container': () => ({ json: { status: 'FINISHED' } }),
      'GET https://graph.threads.net/v1.0/post1?': () => ({
        json: { permalink: 'https://threads.net/@h/post/1' },
      }),
    });
    const text = 'A reasonably long sentence for the thread. '.repeat(20).trim();
    const result = await new ThreadsConnector(client, ctx).publish(baseReq({ text }));
    expect(result).toEqual({ externalId: 'post1', url: 'https://threads.net/@h/post/1' });
    const containers = calls.filter((c) => c.url.endsWith('/acct/threads'));
    expect(containers.length).toBeGreaterThan(1);
    expect((containers[0]!.body as any).reply_to_id).toBeUndefined();
    expect((containers[1]!.body as any).reply_to_id).toBe('post1');
    for (const c of containers)
      expect(((c.body as any).text as string).length).toBeLessThanOrEqual(500);
  });

  it('refreshes long-lived tokens with th_refresh_token', async () => {
    const { ctx, calls } = fakeContext({
      'GET https://graph.threads.net/refresh_access_token': () => ({
        json: { access_token: 'fresh', expires_in: 5184000 },
      }),
    });
    const t = await new ThreadsConnector(client, ctx).refresh('old');
    expect(t).toMatchObject({ accessToken: 'fresh', refreshToken: 'fresh' });
    expect(calls[0]!.url).toContain('grant_type=th_refresh_token');
  });
});

describe('YouTube', () => {
  it('requests offline access with forced consent', () => {
    const url = new URL(
      new YouTubeConnector(client).getAuthUrl({ state: 's', redirectUri: 'https://app/cb' }),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('uploads in chunks and resumes after a dropped connection', async () => {
    const chunk = 256 * 1024;
    const size = chunk * 3;
    let puts = 0;
    const { ctx, calls } = fakeContext({
      'POST https://www.googleapis.com/upload/youtube/v3/videos': () => ({
        headers: { location: 'https://upload.example/session' },
      }),
      'PUT https://upload.example/session': (c) => {
        puts++;
        const range = c.headers['Content-Range']!;
        if (range.startsWith('bytes */'))
          return { status: 308, headers: { range: `bytes=0-${chunk - 1}` } };
        if (puts === 2) return new TypeError('connection reset'); // second chunk drops
        if (range.startsWith(`bytes ${chunk * 2}-`)) return { status: 200, json: { id: 'vid123' } };
        const end = Number(range.match(/-(\d+)\//)![1]);
        return { status: 308, headers: { range: `bytes=0-${end}` } };
      },
    });
    const yt = new YouTubeConnector(client, ctx, chunk);
    const result = await yt.publish(
      baseReq({
        media: [fakeMedia('video', size)],
        options: { title: 'My video', madeForKids: false, privacy: 'unlisted' },
      }),
    );
    expect(result).toEqual({ externalId: 'vid123', url: 'https://www.youtube.com/watch?v=vid123' });
    const init = calls[0]!;
    expect(init.body).toMatchObject({
      snippet: { title: 'My video' },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
    });
    const ranges = calls.filter((c) => c.method === 'PUT').map((c) => c.headers['Content-Range']);
    expect(ranges).toEqual([
      `bytes 0-${chunk - 1}/${size}`,
      `bytes ${chunk}-${chunk * 2 - 1}/${size}`, // dropped
      `bytes */${size}`, // status query
      `bytes ${chunk}-${chunk * 2 - 1}/${size}`, // resumed
      `bytes ${chunk * 2}-${size - 1}/${size}`,
    ]);
  });

  it('requires the made-for-kids declaration', async () => {
    const { ctx } = fakeContext({});
    await expect(
      new YouTubeConnector(client, ctx).publish(baseReq({ media: [fakeMedia('video')] })),
    ).rejects.toThrow(/made for kids/);
  });

  it('keeps the old refresh token when Google does not return a new one', async () => {
    const { ctx } = fakeContext({
      'POST https://oauth2.googleapis.com/token': () => ({
        json: { access_token: 'a2', expires_in: 3599 },
      }),
    });
    expect((await new YouTubeConnector(client, ctx).refresh('r1')).refreshToken).toBe('r1');
  });
});

describe('TikTok', () => {
  const routes = (statuses: unknown[]) => ({
    'POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/': () => ({
      json: {
        data: {
          privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
          max_video_post_duration_sec: 600,
        },
        error: { code: 'ok' },
      },
    }),
    'POST https://open.tiktokapis.com/v2/post/publish/video/init/': () => ({
      json: { data: { publish_id: 'pub1' }, error: { code: 'ok' } },
    }),
    'POST https://open.tiktokapis.com/v2/post/publish/status/fetch/': statuses.map(
      (data) => () => ({ json: { data, error: { code: 'ok' } } }),
    ),
  });

  it('uses PULL_FROM_URL and polls until the post is complete', async () => {
    const { ctx, calls } = fakeContext(
      routes([
        { status: 'PROCESSING_DOWNLOAD' },
        { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [7123] },
      ]),
    );
    const result = await new TikTokConnector(client, ctx).publish(
      baseReq({ media: [fakeMedia('video')], options: { privacy: 'PUBLIC_TO_EVERYONE' } }),
    );
    expect(result).toEqual({
      externalId: '7123',
      url: 'https://www.tiktok.com/@handle/video/7123',
    });
    const init = calls.find((c) => c.url.includes('video/init'))!;
    expect(init.body).toMatchObject({
      post_info: { privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'PULL_FROM_URL', video_url: expect.stringContaining('/public/') },
    });
  });

  it('rejects missing or disallowed privacy levels and surfaces failures', async () => {
    const { ctx } = fakeContext(
      routes([{ status: 'FAILED', fail_reason: 'file_format_check_failed' }]),
    );
    const tt = new TikTokConnector(client, ctx);
    await expect(tt.publish(baseReq({ media: [fakeMedia('video')] }))).rejects.toThrow(
      /no default/,
    );
    await expect(
      tt.publish(
        baseReq({ media: [fakeMedia('video')], options: { privacy: 'FOLLOWER_OF_CREATOR' } }),
      ),
    ).rejects.toThrow(/can't post with privacy/);
    await expect(
      tt.publish(baseReq({ media: [fakeMedia('video')], options: { privacy: 'SELF_ONLY' } })),
    ).rejects.toThrow(/file_format_check_failed/);
  });

  it('maps TikTok error codes in 200 responses', async () => {
    const { ctx } = fakeContext({
      'POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/': () => ({
        json: { data: {}, error: { code: 'access_token_invalid', message: 'expired' } },
      }),
    });
    await expect(
      new TikTokConnector(client, ctx).publish(
        baseReq({ media: [fakeMedia('video')], options: { privacy: 'SELF_ONLY' } }),
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe('Snapchat', () => {
  it('validates 9:16 media and explains missing partner access', async () => {
    const { ctx } = fakeContext({});
    const snap = new SnapchatConnector(client, ctx);
    await expect(
      snap.publish(baseReq({ media: [fakeMedia('image', 10, { width: 1920, height: 1080 })] })),
    ).rejects.toThrow(/9:16/);
    await expect(snap.publish(baseReq({ media: [fakeMedia('image')] }))).rejects.toThrow(
      /Public Profile API/,
    );
  });
});

describe('LinkedIn', () => {
  it('generates proper OAuth authorization URL with required scopes', () => {
    const li = new LinkedInConnector(client);
    const url = li.getAuthUrl({ state: 'random-state', redirectUri: 'https://example.com/callback' });
    expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization');
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=id');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
    expect(url).toContain('state=random-state');
    expect(url).toContain('openid+profile+email+w_member_social');
  });

  it('exchanges authorization code for token set', async () => {
    const { ctx } = fakeContext({
      'POST https://www.linkedin.com/oauth/v2/accessToken': () => ({
        json: {
          access_token: 'li-token-123',
          expires_in: 5184000,
          refresh_token: 'li-refresh-456',
          refresh_token_expires_in: 31536000,
          scope: 'openid profile email w_member_social',
        },
      }),
    });
    const li = new LinkedInConnector(client, ctx);
    const tokens = await li.exchangeCode('test-auth-code', 'https://example.com/callback');
    expect(tokens.accessToken).toBe('li-token-123');
    expect(tokens.refreshToken).toBe('li-refresh-456');
    expect(tokens.scopes).toContain('w_member_social');
  });

  it('lists accounts from OpenID userinfo and maps person URN', async () => {
    const { ctx } = fakeContext({
      'GET https://api.linkedin.com/v2/userinfo': () => ({
        json: {
          sub: 'person-sub-789',
          name: 'Jane Doe',
          email: 'jane@example.com',
          picture: 'https://media.licdn.com/dms/image/avatar.jpg',
        },
      }),
      'GET https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&state=APPROVED': () => ({
        json: { elements: [] },
      }),
    });
    const li = new LinkedInConnector(client, ctx);
    const accounts = await li.listAccounts({ accessToken: 'li-token', scopes: [] });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].externalId).toBe('urn:li:person:person-sub-789');
    expect(accounts[0].displayName).toBe('Jane Doe');
    expect(accounts[0].username).toBe('jane');
    expect(accounts[0].avatarUrl).toBe('https://media.licdn.com/dms/image/avatar.jpg');
  });

  it('publishes text post to UGC Posts API', async () => {
    let capturedBody: any;
    const { ctx } = fakeContext({
      'POST https://api.linkedin.com/v2/ugcPosts': (call) => {
        capturedBody = call.body;
        return {
          json: { id: 'urn:li:ugcPost:1234567890' },
        };
      },
    });
    const li = new LinkedInConnector(client, ctx);
    const res = await li.publish(
      baseReq({
        text: 'Excited to announce our new platform launch! 🚀',
        account: { externalId: 'urn:li:person:person-sub-789', metadata: {} },
      }),
    );
    expect(res.externalId).toBe('urn:li:ugcPost:1234567890');
    expect(res.url).toBe(
      `https://www.linkedin.com/feed/update/${encodeURIComponent('urn:li:ugcPost:1234567890')}`,
    );
    expect(capturedBody.author).toBe('urn:li:person:person-sub-789');
    expect(capturedBody.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe(
      'Excited to announce our new platform launch! 🚀',
    );
  });
});

describe('ConnectorRegistry', () => {
  it('only enables platforms with credentials; Snapchat also needs the feature flag', () => {
    const env = {
      X_CLIENT_ID: 'a',
      X_CLIENT_SECRET: 'b',
      META_CLIENT_ID: 'c',
      META_CLIENT_SECRET: 'd',
      SNAPCHAT_CLIENT_ID: 'e',
      SNAPCHAT_CLIENT_SECRET: 'f',
      LINKEDIN_CLIENT_ID: 'g',
      LINKEDIN_CLIENT_SECRET: 'h',
    };
    expect(ConnectorRegistry.fromEnv(env).available().sort()).toEqual([
      'facebook',
      'instagram',
      'linkedin',
      'x',
    ]);
    expect(ConnectorRegistry.fromEnv({ ...env, FEATURE_SNAPCHAT: 'true' }).has('snapchat')).toBe(
      true,
    );
    expect(ConnectorRegistry.fromEnv(env).has('linkedin')).toBe(true);
    expect(() => ConnectorRegistry.fromEnv({}).get('tiktok')).toThrow(/not configured/);
  });
});

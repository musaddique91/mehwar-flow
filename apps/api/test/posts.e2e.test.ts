import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConnectorRegistry, type PlatformConnector } from '@mehwar/connectors';
import { PrismaClient, withSystemTransaction } from '@mehwar/db';
import { createTestApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { QueuesService } from '../src/infra/queues.service';
import { CONNECTORS, STORAGE } from '../src/infra/tokens';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
  MASTER_KEYS: `1:${randomBytes(32).toString('base64')}`,
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  WEB_ORIGIN: 'http://localhost:3000',
});

/** Fake X connector: OAuth works, one account per login. */
const fakeX: PlatformConnector = {
  platform: 'x',
  scopes: ['tweet.write'],
  usesPkce: true,
  getAuthUrl: ({ state, codeChallenge }) =>
    `https://x.example/authorize?state=${state}&cc=${codeChallenge}`,
  exchangeCode: async (code) => ({
    accessToken: `access-${code}`,
    refreshToken: `refresh-${code}`,
    expiresAt: new Date(Date.now() + 7200_000),
    scopes: ['tweet.write'],
  }),
  listAccounts: async (token) => [
    { externalId: `acct-${token.accessToken}`, displayName: 'My X', username: 'me' },
  ],
  refresh: async () => ({ accessToken: 'a', scopes: [] }),
  publish: async () => ({ externalId: '1' }),
  fetchMetrics: async () => ({ impressions: 0, likes: 0, comments: 0, shares: 0, views: 0 }),
  fetchFollowers: async () => null,
  revoke: async () => undefined,
};
/** Fake Facebook connector: returns two pages, so the account picker is used. */
const fakeFb: PlatformConnector = {
  ...fakeX,
  platform: 'facebook',
  usesPkce: false,
  listAccounts: async () => [
    { externalId: 'page-1', displayName: 'Page One', token: { accessToken: 'p1', scopes: [] } },
    { externalId: 'page-2', displayName: 'Page Two', token: { accessToken: 'p2', scopes: [] } },
  ],
};

const fakeStorage = {
  presignPut: async (key: string) => `https://s3.example/${key}?signed`,
  presignGet: async (key: string) => `https://s3.example/${key}?get`,
  publicUrl: (key: string) => `https://s3.example/${key}`,
  head: async () => ({ size: 2048 }),
  deleteMany: async () => undefined,
  getBuffer: async () => Buffer.alloc(0),
};

const prisma = new PrismaClient();
let app: INestApplication;
const emails: string[] = [];

async function signup() {
  const email = `posts-${randomUUID()}@test.local`;
  emails.push(email);
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'super-secret-password', name: 'Poster', timezone: 'Asia/Dubai' })
    .expect(201);
  const token = res.body.accessToken as string;
  const api = () => ({
    get: (p: string) => request(app.getHttpServer()).get(p).set('Authorization', `Bearer ${token}`),
    post: (p: string, body?: object) =>
      request(app.getHttpServer())
        .post(p)
        .set('Authorization', `Bearer ${token}`)
        .send(body ?? {}),
    patch: (p: string, body: object) =>
      request(app.getHttpServer()).patch(p).set('Authorization', `Bearer ${token}`).send(body),
    del: (p: string) =>
      request(app.getHttpServer()).delete(p).set('Authorization', `Bearer ${token}`),
  });
  return { email, token, api: api() };
}

async function connectX(api: Awaited<ReturnType<typeof signup>>['api'], code = randomUUID()) {
  const { body } = await api.post('/channels/connect/x').expect(201);
  const state = new URL(body.url).searchParams.get('state')!;
  const cb = await request(app.getHttpServer())
    .get(`/channels/callback/x?code=${code}&state=${state}`)
    .expect(302);
  expect(cb.headers.location).toBe('http://localhost:3000/channels?connected=x');
  const channels = await api.get('/channels').expect(200);
  return channels.body.find((c: { platform: string }) => c.platform === 'x');
}

beforeAll(async () => {
  app = await createTestApp(config, [
    { provide: CONNECTORS, useValue: new ConnectorRegistry([fakeX, fakeFb]) },
    { provide: STORAGE, useValue: fakeStorage },
  ]);
  await app.init();
});

afterAll(async () => {
  const queues = app.get(QueuesService);
  await queues.publish.obliterate({ force: true }).catch(() => undefined);
  await app.close();
  await withSystemTransaction(prisma, (tx) =>
    tx.user.deleteMany({ where: { email: { in: emails } } }),
  );
  await prisma.$disconnect();
});

describe('channels (OAuth)', () => {
  it('connects a single account and stores its tokens encrypted', async () => {
    const { api } = await signup();
    const channel = await connectX(api, 'code1');
    expect(channel).toMatchObject({ platform: 'x', displayName: 'My X', status: 'ACTIVE' });
    const cred = await withSystemTransaction(prisma, (tx) =>
      tx.channelCredential.findUniqueOrThrow({ where: { channelId: channel.id } }),
    );
    expect(cred.accessTokenEnc).not.toContain('access-code1');
    expect(cred.refreshTokenEnc).not.toContain('refresh-code1');
    const available = await api.get('/channels/available').expect(200);
    expect(available.body.find((a: { platform: string }) => a.platform === 'x').configured).toBe(
      true,
    );
    expect(
      available.body.find((a: { platform: string }) => a.platform === 'tiktok').configured,
    ).toBe(false);
  });

  it('rejects reused or unknown state', async () => {
    const { api } = await signup();
    const { body } = await api.post('/channels/connect/x').expect(201);
    const state = new URL(body.url).searchParams.get('state')!;
    await request(app.getHttpServer())
      .get(`/channels/callback/x?code=c&state=${state}`)
      .expect(302);
    const again = await request(app.getHttpServer())
      .get(`/channels/callback/x?code=c&state=${state}`)
      .expect(302);
    expect(again.headers.location).toContain('/channels?error=');
  });

  it('lets the user pick from multiple accounts, and only the owner can see the selection', async () => {
    const a = await signup();
    const b = await signup();
    const { body } = await a.api.post('/channels/connect/facebook').expect(201);
    const state = new URL(body.url).searchParams.get('state')!;
    const cb = await request(app.getHttpServer())
      .get(`/channels/callback/facebook?code=c&state=${state}`)
      .expect(302);
    const session = new URL(cb.headers.location).searchParams.get('session')!;

    await b.api.get(`/channels/pending/${session}`).expect(404);
    const pending = await a.api.get(`/channels/pending/${session}`).expect(200);
    expect(pending.body.accounts.map((x: { externalId: string }) => x.externalId)).toEqual([
      'page-1',
      'page-2',
    ]);
    expect(JSON.stringify(pending.body)).not.toContain('p1'); // no tokens leak to the browser
    await a.api.post(`/channels/pending/${session}`, { externalIds: ['page-2'] }).expect(201);
    const channels = await a.api.get('/channels').expect(200);
    expect(channels.body.map((c: { displayName: string }) => c.displayName)).toEqual(['Page Two']);
  });

  it('disconnects a channel', async () => {
    const { api } = await signup();
    const channel = await connectX(api);
    await api.del(`/channels/${channel.id}`).expect(204);
    expect((await api.get('/channels').expect(200)).body).toEqual([]);
  });
});

describe('media', () => {
  it('creates a presigned upload and moves the asset to processing', async () => {
    const { api } = await signup();
    const created = await api
      .post('/media/uploads', { fileName: 'photo 1.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 })
      .expect(201);
    expect(created.body.uploadUrl).toMatch(
      /^https:\/\/s3\.example\/org\/.+\/media\/.+\/photo_1\.jpg\?signed$/,
    );
    expect(created.body.media.status).toBe('UPLOADING');
    const done = await api.post(`/media/${created.body.media.id}/complete`).expect(201);
    expect(done.body.status).toBe('PROCESSING');
    await api
      .post('/media/uploads', {
        fileName: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
      })
      .expect(400);
  });
});

describe('posts', () => {
  it('creates a draft, validates, schedules in the user time zone and cancels', async () => {
    const { api } = await signup();
    const channel = await connectX(api);
    const draft = await api
      .post('/posts', { text: 'Hello from the scheduler', targets: [{ channelId: channel.id }] })
      .expect(201);
    expect(draft.body.status).toBe('DRAFT');

    const scheduled = await api
      .post(`/posts/${draft.body.id}/schedule`, {
        localDateTime: '2099-01-15T09:00',
        timezone: 'Asia/Dubai',
      })
      .expect(201);
    expect(scheduled.body.status).toBe('SCHEDULED');
    expect(scheduled.body.scheduledAt).toBe('2099-01-15T05:00:00.000Z');
    expect(scheduled.body.targets[0].status).toBe('QUEUED');

    const job = await app.get(QueuesService).publish.getJob(scheduled.body.targets[0].id);
    expect(job?.data).toMatchObject({ postTargetId: scheduled.body.targets[0].id });

    const canceled = await api.post(`/posts/${draft.body.id}/cancel`).expect(201);
    expect(canceled.body.status).toBe('DRAFT');
    expect(
      await app.get(QueuesService).publish.getJob(scheduled.body.targets[0].id),
    ).toBeUndefined();
  });

  it('blocks scheduling with validation issues and past times', async () => {
    const { api } = await signup();
    const channel = await connectX(api);
    const empty = await api
      .post('/posts', { text: '', targets: [{ channelId: channel.id }] })
      .expect(201);
    await api.post(`/posts/${empty.body.id}/publish-now`).expect(400);
    const post = await api
      .post('/posts', { text: 'ok', targets: [{ channelId: channel.id }] })
      .expect(201);
    await api
      .post(`/posts/${post.body.id}/schedule`, {
        localDateTime: '2020-01-01T09:00',
        timezone: 'UTC',
      })
      .expect(400);

    const noTargets = await api.post('/posts', { text: 'hello' }).expect(201);
    await api.post(`/posts/${noTargets.body.id}/publish-now`).expect(400);
  });

  it('requires media to be ready before publishing', async () => {
    const { api } = await signup();
    const channel = await connectX(api);
    const media = await api
      .post('/media/uploads', { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 100 })
      .expect(201);
    const post = await api
      .post('/posts', {
        text: 'pic',
        mediaIds: [media.body.media.id],
        targets: [{ channelId: channel.id }],
      })
      .expect(201);
    const res = await api.post(`/posts/${post.body.id}/publish-now`).expect(422);
    expect(res.body.issues.map((i: { code: string }) => i.code)).toContain('MEDIA_NOT_READY');
  });

  it('isolates posts between accounts', async () => {
    const a = await signup();
    const b = await signup();
    const channel = await connectX(a.api);
    const post = await a.api
      .post('/posts', { text: 'private', targets: [{ channelId: channel.id }] })
      .expect(201);
    await b.api.get(`/posts/${post.body.id}`).expect(404);
    await b.api.post('/posts', { text: 'steal', targets: [{ channelId: channel.id }] }).expect(400);
    expect((await b.api.get('/posts').expect(200)).body).toEqual([]);
  });

  it('imports posts from CSV', async () => {
    const { api } = await signup();
    await connectX(api);
    const csv =
      'text,date,channels\n"First, with comma",2099-02-01 10:30,x\nDraft only,,all\n,2099-01-01 10:00,x\nBad,2099-01-01 10:00,myspace';
    const res = await api.post('/posts/import', { csv }).expect(201);
    expect(res.body.imported).toBe(2);
    expect(
      res.body.results
        .filter((r: { error?: string }) => r.error)
        .map((r: { row: number }) => r.row),
    ).toEqual([4, 5]);
    const posts = (await api.get('/posts').expect(200)).body;
    expect(posts.map((p: { status: string }) => p.status).sort()).toEqual(['DRAFT', 'SCHEDULED']);
  });

  it('finds the next free posting slot', async () => {
    const { api } = await signup();
    expect((await api.get('/slots/next-free').expect(200)).body.localDateTime).toBeNull();
    await api.post('/slots', { weekday: 1, minuteOfDay: 540 }).expect(201);
    const next = await api.get('/slots/next-free').expect(200);
    expect(next.body.localDateTime).toMatch(/T09:00$/);
    expect(next.body.timezone).toBe('Asia/Dubai');
  });
});

describe('notifications, billing and AI status', () => {
  it('records a notification when a channel connects', async () => {
    const { api } = await signup();
    await connectX(api);
    const list = await api.get('/notifications').expect(200);
    expect(list.body.unread).toBe(1);
    expect(list.body.items[0].title).toBe('My X connected');
    await api.post('/notifications/read').expect(204);
    expect((await api.get('/notifications').expect(200)).body.unread).toBe(0);
  });

  it('reports the self-hosted plan when Stripe is not configured, and AI as disabled without a key', async () => {
    const { api } = await signup();
    const billing = await api.get('/billing').expect(200);
    expect(billing.body).toMatchObject({ billingEnabled: false, plan: 'unlimited' });
    expect((await api.get('/ai/status').expect(200)).body).toEqual({ enabled: false });
    await api.post('/ai/caption', { prompt: 'hi', platforms: ['x'] }).expect(503);
  });

  it('deletes the whole account, including posts with media', async () => {
    const { api, email } = await signup();
    const channel = await connectX(api);
    const media = await api
      .post('/media/uploads', { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 100 })
      .expect(201);
    await api
      .post('/posts', {
        text: 'pic',
        mediaIds: [media.body.media.id],
        targets: [{ channelId: channel.id }],
      })
      .expect(201);
    await api.del('/me').send({ password: 'wrong' }).expect(401);
    await api.del('/me').send({ password: 'super-secret-password' }).expect(204);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it('exports account data without credentials', async () => {
    const { api, email } = await signup();
    await connectX(api);
    const res = await api.get('/me/export').expect(200);
    const data = JSON.parse(res.text);
    expect(data.user.email).toBe(email);
    expect(res.text).not.toMatch(/accessTokenEnc|access-/);
  });
});

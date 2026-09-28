import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, withSystemTransaction } from '@mehwar/db';
import { createApp } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import { VaultService } from '../src/vault/vault.service';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
  MASTER_KEYS: `1:${randomBytes(32).toString('base64')}`,
  MASTER_KEY_CURRENT_VERSION: '1',
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
});

const prisma = new PrismaClient();
let app: INestApplication;
const emails: string[] = [];

function newEmail() {
  const e = `user-${randomUUID()}@test.local`;
  emails.push(e);
  return e;
}

function refreshCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('mf_refresh='));
  if (!cookie) throw new Error('refresh cookie missing');
  return cookie.split(';')[0]!;
}

async function register(email = newEmail(), password = 'super-secret-password') {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: 'Test User', timezone: 'Asia/Karachi' })
    .expect(201);
  return {
    res,
    email,
    password,
    token: res.body.accessToken as string,
    cookie: refreshCookie(res),
  };
}

beforeAll(async () => {
  app = await createApp(config);
  await app.init();
});

afterAll(async () => {
  await app.close();
  await withSystemTransaction(prisma, (tx) =>
    tx.user.deleteMany({ where: { email: { in: emails } } }),
  );
  await prisma.$disconnect();
});

describe('auth', () => {
  it('registers a user with a personal organization and an httpOnly refresh cookie', async () => {
    const { res, email } = await register();
    expect(res.body.user).toMatchObject({ email, name: 'Test User', timezone: 'Asia/Karachi' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/auth/);

    const org = await withSystemTransaction(prisma, (tx) =>
      tx.organization.findFirst({ where: { owner: { email } } }),
    );
    expect(org?.wrappedDataKey).toMatch(/^v1\./);
  });

  it('validates input and rejects duplicate emails', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' })
      .expect(400);
    const { email } = await register();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: 'another-long-password', name: 'X' })
      .expect(409);
  });

  it('logs in and protects routes with the access token', async () => {
    const { email, password } = await register();
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(email);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage')
      .expect(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { cookie } = await register();
    const first = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const rotated = refreshCookie(first);
    expect(rotated).not.toBe(cookie);

    // Replaying the old token is treated as theft: the rotated token dies too.
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const { cookie } = await register();
    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('updates the profile and changes the password (revoking sessions)', async () => {
    const { token, cookie, email, password } = await register();
    const patched = await request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Europe/London', xPremium: true })
      .expect(200);
    expect(patched.body).toMatchObject({ timezone: 'Europe/London', xPremium: true });
    await request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Nowhere/City' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'a-brand-new-password' })
      .expect(204);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'a-brand-new-password' })
      .expect(200);
  });
});

describe('tenant isolation', () => {
  it('only lists the caller’s own channels', async () => {
    const a = await register();
    const b = await register();
    const orgB = await withSystemTransaction(prisma, (tx) =>
      tx.organization.findFirstOrThrow({ where: { owner: { email: b.email } } }),
    );
    await withSystemTransaction(prisma, (tx) =>
      tx.channel.create({
        data: {
          organizationId: orgB.id,
          platform: 'x',
          externalId: randomUUID(),
          displayName: 'B only',
        },
      }),
    );

    const listA = await request(app.getHttpServer())
      .get('/channels')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(listA.body).toEqual([]);
    const listB = await request(app.getHttpServer())
      .get('/channels')
      .set('Authorization', `Bearer ${b.token}`)
      .expect(200);
    expect(listB.body.map((c: { displayName: string }) => c.displayName)).toEqual(['B only']);
  });
});

describe('token vault', () => {
  it('encrypts per organization and refuses cross-tenant decryption', async () => {
    const a = await register();
    const b = await register();
    const [orgA, orgB] = await withSystemTransaction(prisma, (tx) =>
      Promise.all(
        [a.email, b.email].map((email) =>
          tx.organization.findFirstOrThrow({ where: { owner: { email } } }),
        ),
      ),
    );
    const vault = app.get(VaultService);
    const sealed = await vault.encrypt(orgA!.id, 'refresh-token-value', 'channel:1:refresh');
    expect(sealed).not.toContain('refresh-token-value');
    expect(await vault.decrypt(orgA!.id, sealed, 'channel:1:refresh')).toBe('refresh-token-value');
    await expect(vault.decrypt(orgB!.id, sealed, 'channel:1:refresh')).rejects.toThrow();
    await expect(vault.decrypt(orgA!.id, sealed, 'channel:2:refresh')).rejects.toThrow();
  });
});

describe('rate limiting', () => {
  it('limits credential attempts per IP', async () => {
    const limited = await createApp({ ...config, AUTH_RATE_LIMIT_PER_MINUTE: 3 });
    await limited.init();
    try {
      const attempt = () =>
        request(limited.getHttpServer())
          .post('/auth/login')
          .send({ email: 'nobody@test.local', password: 'x' });
      for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe('health', () => {
  it('reports database status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up', redis: 'up' });
  });
});

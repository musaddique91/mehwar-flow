import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type IORedis from 'ioredis';
import { randomToken } from '@mehwar/crypto';
import {
  createPkcePair,
  type ConnectedAccount,
  type ConnectorRegistry,
  type TokenSet,
} from '@mehwar/connectors';
import { credentialContext, TokenVault, withSystemTransaction, type Channel } from '@mehwar/db';
import { PLATFORMS, type ChannelDto, type Platform } from '@mehwar/shared';
import { EntitlementsService } from '../billing/entitlements.service';
import { APP_CONFIG, type AppConfig } from '../config';
import { QueuesService } from '../infra/queues.service';
import { CONNECTORS, REDIS } from '../infra/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const STATE_TTL = 600;

interface OAuthState {
  organizationId: string;
  userId: string;
  platform: Platform;
  verifier?: string;
}

interface PendingAccounts {
  organizationId: string;
  platform: Platform;
  userToken: TokenSet;
  accounts: ConnectedAccount[];
}

export function toChannelDto(
  c: Channel & { credential?: { accessTokenExpiresAt: Date | null } | null },
): ChannelDto {
  return {
    id: c.id,
    platform: c.platform,
    displayName: c.displayName,
    username: c.username,
    avatarUrl: c.avatarUrl,
    status: c.status,
    tokenExpiresAt: c.credential?.accessTokenExpiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: TokenVault,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly queues: QueuesService,
    @Inject(CONNECTORS) private readonly connectors: ConnectorRegistry,
    @Inject(REDIS) private readonly redis: IORedis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get webOrigin(): string {
    return this.config.WEB_ORIGIN.split(',')[0]!.trim().replace(/\/$/, '');
  }

  redirectUri(platform: Platform): string {
    return `${this.webOrigin}/api/channels/callback/${platform}`;
  }

  available() {
    return PLATFORMS.map((platform) => ({ platform, configured: this.connectors.has(platform) }));
  }

  async list(organizationId: string): Promise<ChannelDto[]> {
    const channels = await this.prisma.tenant(organizationId).channel.findMany({
      where: { status: { not: 'DISCONNECTED' } },
      include: { credential: { select: { accessTokenExpiresAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return channels.map(toChannelDto);
  }

  async startConnect(organizationId: string, userId: string, platform: Platform): Promise<string> {
    const connector = this.connectors.get(platform);
    const state = randomToken(24);
    const pkce = connector.usesPkce ? createPkcePair() : undefined;
    const data: OAuthState = { organizationId, userId, platform, verifier: pkce?.verifier };
    await this.redis.set(`oauth:state:${state}`, JSON.stringify(data), 'EX', STATE_TTL);
    return connector.getAuthUrl({
      state,
      redirectUri: this.redirectUri(platform),
      codeChallenge: pkce?.challenge,
    });
  }

  /** Returns the path in the web app to redirect the browser to. */
  async handleCallback(
    platform: Platform,
    query: Record<string, string | undefined>,
  ): Promise<string> {
    const fail = (msg: string) => `/channels?error=${encodeURIComponent(msg)}`;
    if (!query.state) return fail('Missing state');
    const raw = await this.redis.getdel(`oauth:state:${query.state}`);
    if (!raw) return fail('This connection link expired. Please try again.');
    const state = JSON.parse(raw) as OAuthState;
    if (state.platform !== platform) return fail('Platform mismatch');
    if (query.error || !query.code)
      return fail(query.error_description ?? query.error ?? 'Connection was cancelled');

    try {
      const connector = this.connectors.get(platform);
      const userToken = await connector.exchangeCode(
        query.code,
        this.redirectUri(platform),
        state.verifier,
      );
      const accounts = await connector.listAccounts(userToken);
      if (accounts.length === 0) {
        return fail(
          platform === 'instagram'
            ? 'No Instagram professional account is linked to your Facebook Pages.'
            : 'No accounts were found to connect.',
        );
      }
      if (accounts.length === 1) {
        await this.saveAccount(
          state.organizationId,
          state.userId,
          platform,
          accounts[0]!,
          userToken,
        );
        return `/channels?connected=${platform}`;
      }
      const session = randomToken(24);
      const pending: PendingAccounts = {
        organizationId: state.organizationId,
        platform,
        userToken,
        accounts,
      };
      const sealed = await this.vault.encrypt(
        state.organizationId,
        JSON.stringify(pending),
        `oauth-pending:${session}`,
      );
      await this.redis.set(
        `oauth:pending:${session}`,
        JSON.stringify({ organizationId: state.organizationId, sealed }),
        'EX',
        STATE_TTL,
      );
      return `/channels/select?session=${session}&platform=${platform}`;
    } catch (err) {
      this.logger.warn(`OAuth callback for ${platform} failed: ${(err as Error).message}`);
      return fail((err as Error).message || 'Could not connect the account');
    }
  }

  private async loadPending(organizationId: string, session: string): Promise<PendingAccounts> {
    const raw = await this.redis.get(`oauth:pending:${session}`);
    if (!raw) throw new NotFoundException('This selection expired. Please connect again.');
    const { organizationId: owner, sealed } = JSON.parse(raw);
    if (owner !== organizationId)
      throw new NotFoundException('This selection expired. Please connect again.');
    return JSON.parse(
      await this.vault.decrypt(organizationId, sealed, `oauth-pending:${session}`),
    ) as PendingAccounts;
  }

  async pendingAccounts(organizationId: string, session: string) {
    const pending = await this.loadPending(organizationId, session);
    return {
      platform: pending.platform,
      accounts: pending.accounts.map((a) => ({
        externalId: a.externalId,
        displayName: a.displayName,
        username: a.username ?? null,
        avatarUrl: a.avatarUrl ?? null,
      })),
    };
  }

  async selectPending(
    organizationId: string,
    userId: string,
    session: string,
    externalIds: string[],
  ): Promise<ChannelDto[]> {
    const pending = await this.loadPending(organizationId, session);
    const chosen = pending.accounts.filter((a) => externalIds.includes(a.externalId));
    if (chosen.length === 0) throw new BadRequestException('Select at least one account');
    const saved: ChannelDto[] = [];
    for (const account of chosen)
      saved.push(
        await this.saveAccount(
          organizationId,
          userId,
          pending.platform,
          account,
          pending.userToken,
        ),
      );
    await this.redis.del(`oauth:pending:${session}`);
    return saved;
  }

  async saveAccount(
    organizationId: string,
    userId: string,
    platform: Platform,
    account: ConnectedAccount,
    userToken: TokenSet,
  ) {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.channel.findFirst({
      where: { platform, externalId: account.externalId, status: { not: 'DISCONNECTED' } },
    });
    if (!existing) await this.entitlements.assertWithin(organizationId, 'channels');

    const token = account.token ?? userToken;
    const channel = await db.channel.upsert({
      where: {
        organizationId_platform_externalId: {
          organizationId,
          platform,
          externalId: account.externalId,
        },
      },
      create: {
        organizationId,
        platform,
        externalId: account.externalId,
        displayName: account.displayName,
        username: account.username ?? null,
        avatarUrl: account.avatarUrl ?? null,
        metadata: (account.metadata ?? {}) as object,
      },
      update: {
        displayName: account.displayName,
        username: account.username ?? null,
        avatarUrl: account.avatarUrl ?? null,
        metadata: (account.metadata ?? {}) as object,
        status: 'ACTIVE',
      },
    });

    const data = {
      accessTokenEnc: await this.vault.encrypt(
        organizationId,
        token.accessToken,
        credentialContext.access(channel.id),
      ),
      refreshTokenEnc: token.refreshToken
        ? await this.vault.encrypt(
            organizationId,
            token.refreshToken,
            credentialContext.refresh(channel.id),
          )
        : null,
      accessTokenExpiresAt: token.expiresAt ?? null,
      refreshTokenExpiresAt: token.refreshExpiresAt ?? null,
      scopes: token.scopes,
      refreshFailures: 0,
      lastError: null,
      lastRefreshedAt: new Date(),
    };
    await db.channelCredential.upsert({
      where: { channelId: channel.id },
      create: { organizationId, channelId: channel.id, ...data },
      update: data,
    });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'channel.connected',
        targetType: 'channel',
        targetId: channel.id,
        metadata: { platform },
      },
    });
    await this.notifications.notify(
      organizationId,
      'CHANNEL_CONNECTED',
      `${account.displayName} connected`,
      undefined,
      '/channels',
    );
    return toChannelDto(channel);
  }

  async disconnect(organizationId: string, userId: string, channelId: string): Promise<void> {
    const db = this.prisma.tenant(organizationId);
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: { credential: true },
    });
    if (!channel) throw new NotFoundException();

    if (channel.credential && this.connectors.has(channel.platform)) {
      try {
        const token = await this.vault.decrypt(
          organizationId,
          channel.credential.accessTokenEnc,
          credentialContext.access(channel.id),
        );
        await this.connectors.get(channel.platform).revoke(token);
      } catch (err) {
        this.logger.warn(
          `Token revoke for channel ${channel.id} failed: ${(err as Error).message}`,
        );
      }
    }

    const pending = await db.postTarget.findMany({
      where: { channelId, status: { in: ['PENDING', 'QUEUED'] } },
      select: { id: true },
    });
    for (const t of pending) await this.queues.cancelPublish(t.id);
    await db.postTarget.updateMany({
      where: { channelId, status: { in: ['PENDING', 'QUEUED'] } },
      data: { status: 'CANCELED', lastError: 'Channel disconnected' },
    });
    await db.channelCredential.deleteMany({ where: { channelId } });
    await db.channel.update({ where: { id: channelId }, data: { status: 'DISCONNECTED' } });
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'channel.disconnected',
        targetType: 'channel',
        targetId: channelId,
      },
    });
  }

  /** Used by account deletion: revoke every token of the organization. */
  async revokeAll(organizationId: string): Promise<void> {
    const channels = await withSystemTransaction(this.prisma, (tx) =>
      tx.channel.findMany({ where: { organizationId }, include: { credential: true } }),
    );
    for (const c of channels) {
      if (!c.credential || !this.connectors.has(c.platform)) continue;
      try {
        const token = await this.vault.decrypt(
          organizationId,
          c.credential.accessTokenEnc,
          credentialContext.access(c.id),
        );
        await this.connectors.get(c.platform).revoke(token);
      } catch {
        /* best effort */
      }
    }
  }
}

import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { hashPassword, randomToken, sha256, verifyPassword } from '@mehwar/crypto';
import { Prisma, withSystemTransaction, type User } from '@mehwar/db';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@mehwar/shared';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import type { AccessTokenPayload } from './auth.types';

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

// A real hash so that login timing is the same whether or not the email exists.
const DUMMY_HASH_PROMISE = hashPassword('timing-equalizer-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly vault: VaultService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput, client: ClientInfo): Promise<IssuedTokens> {
    const passwordHash = await hashPassword(input.password);
    const organizationId = randomUUID();
    const dataKey = this.vault.newOrganizationKey(organizationId);

    try {
      const { user } = await withSystemTransaction(this.prisma, async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, passwordHash, name: input.name, timezone: input.timezone },
        });
        // Every account gets a personal organization: the tenant boundary for all its data.
        await tx.organization.create({
          data: {
            id: organizationId,
            name: `${input.name}'s account`,
            ownerId: user.id,
            wrappedDataKey: dataKey.wrappedKey,
            dataKeyVersion: dataKey.keyVersion,
          },
        });
        await tx.auditLog.create({
          data: { organizationId, userId: user.id, action: 'user.registered', ip: client.ip },
        });
        return { user };
      });
      return this.issueTokens(user, organizationId, randomUUID(), client);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  async login(input: LoginInput, client: ClientInfo): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? (await DUMMY_HASH_PROMISE),
    );
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');

    const organizationId = await this.organizationIdOf(user.id);
    await this.audit(organizationId, user.id, 'user.login', client.ip);
    return this.issueTokens(user, organizationId, randomUUID(), client);
  }

  /**
   * Rotates a refresh token. Presenting an already-rotated token means it leaked: the whole
   * session family is revoked and the user must log in again.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<IssuedTokens> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    if (session.revokedAt) {
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected; please log in again');
    }
    if (session.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');

    // Atomically claim the token so two concurrent refreshes cannot both succeed.
    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException('Invalid refresh token');

    const organizationId = await this.organizationIdOf(session.userId);
    const tokens = await this.issueTokens(session.user, organizationId, session.familyId, client);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { replacedById: tokens.sessionId },
    });
    return tokens;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!session) return;
    await this.prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  toDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      xPremium: user.xPremium,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async audit(organizationId: string, userId: string, action: string, ip?: string) {
    await this.prisma.tenant(organizationId).auditLog.create({
      data: { organizationId, userId, action, ip },
    });
  }

  private async organizationIdOf(userId: string): Promise<string> {
    const org = await withSystemTransaction(this.prisma, (tx) =>
      tx.organization.findUnique({ where: { ownerId: userId }, select: { id: true } }),
    );
    if (!org) throw new UnauthorizedException('Account has no organization');
    return org.id;
  }

  private async issueTokens(
    user: User,
    organizationId: string,
    familyId: string,
    client: ClientInfo,
  ): Promise<IssuedTokens & { sessionId: string }> {
    const payload: AccessTokenPayload = { sub: user.id, org: organizationId };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        userAgent: client.userAgent?.slice(0, 500),
        ip: client.ip,
        expiresAt: refreshExpiresAt,
      },
    });
    return {
      accessToken,
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
      user: this.toDto(user),
      refreshToken,
      refreshExpiresAt,
      sessionId: session.id,
    };
  }
}

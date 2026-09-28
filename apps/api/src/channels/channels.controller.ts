import { Controller, Get } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Connected social channels. OAuth connect flows arrive in Phase 2. */
@Controller('channels')
export class ChannelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    // Credentials are never selected here: tokens must not reach the browser.
    return this.prisma.tenant(auth.organizationId).channel.findMany({
      select: {
        id: true,
        platform: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        credential: { select: { accessTokenExpiresAt: true, scopes: true, lastRefreshedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

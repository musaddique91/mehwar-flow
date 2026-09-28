import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { verifyPassword } from '@mehwar/crypto';
import { withSystemTransaction } from '@mehwar/db';
import type { Storage } from '@mehwar/storage';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ChannelsService } from '../channels/channels.service';
import { ZodPipe } from '../common/zod.pipe';
import { STORAGE } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';

const deleteSchema = z.object({ password: z.string().min(1) });

/** GDPR: data export and full account deletion. */
@Controller('me')
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    @Inject(STORAGE) private readonly storage: Storage | null,
  ) {}

  @Get('export')
  async export(@CurrentAuth() auth: AuthContext, @Res() res: Response) {
    const db = this.prisma.tenant(auth.organizationId);
    const [user, channels, posts, media, notifications, auditLogs, slots] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: {
          id: true,
          email: true,
          name: true,
          timezone: true,
          xPremium: true,
          brandVoice: true,
          createdAt: true,
        },
      }),
      // Credentials are deliberately excluded: they are secrets, not personal data.
      db.channel.findMany({
        select: {
          id: true,
          platform: true,
          displayName: true,
          username: true,
          status: true,
          createdAt: true,
        },
      }),
      db.post.findMany({ include: { targets: true, media: true } }),
      db.mediaAsset.findMany(),
      db.notification.findMany(),
      db.auditLog.findMany(),
      db.postingSlot.findMany(),
    ]);
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        user,
        channels,
        posts,
        media,
        notifications,
        auditLogs,
        slots,
      },
      (_k, v) => (typeof v === 'bigint' ? Number(v) : v),
      2,
    );
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="mehwar-export.json"',
    });
    res.send(body);
  }

  /** Revokes every platform token and permanently deletes the account and all its data. */
  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(deleteSchema)) body: z.infer<typeof deleteSchema>,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await verifyPassword(body.password, user.passwordHash)))
      throw new UnauthorizedException('Password is incorrect');
    await this.channels.revokeAll(auth.organizationId);
    const media = await this.prisma.tenant(auth.organizationId).mediaAsset.findMany({
      select: { storageKey: true, thumbnailKey: true, publicKey: true },
    });
    const keys = media
      .flatMap((m) => [m.storageKey, m.thumbnailKey ?? '', m.publicKey ?? ''])
      .filter(Boolean);
    for (let i = 0; i < keys.length; i += 1000)
      await this.storage?.deleteMany(keys.slice(i, i + 1000)).catch(() => undefined);
    await withSystemTransaction(this.prisma, (tx) =>
      tx.user.delete({ where: { id: auth.userId } }),
    );
  }
}

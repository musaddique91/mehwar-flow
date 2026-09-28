import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  postInputSchema,
  scheduleSchema,
  slotSchema,
  type PostInput,
  type ScheduleInput,
} from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';
import { nextFreeSlot } from './slots';

const importSchema = z.object({ csv: z.string().min(1).max(2_000_000) });

@Controller()
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly prisma: PrismaService,
  ) {}

  private async user(auth: AuthContext) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { timezone: true, xPremium: true },
    });
  }

  @Get('posts')
  list(
    @CurrentAuth() auth: AuthContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posts.list(auth.organizationId, {
      from,
      to,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('posts')
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(postInputSchema)) body: PostInput,
  ) {
    const user = await this.user(auth);
    return this.posts.create(auth.organizationId, body, user.timezone);
  }

  @Get('posts/:id')
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.dto(auth.organizationId, id);
  }

  @Patch('posts/:id')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(postInputSchema)) body: PostInput,
  ) {
    return this.posts.update(auth.organizationId, id, body, (await this.user(auth)).xPremium);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.posts.remove(auth.organizationId, id);
  }

  @Post('posts/:id/schedule')
  async schedule(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(scheduleSchema)) body: ScheduleInput,
  ) {
    return this.posts.schedule(auth.organizationId, id, body, (await this.user(auth)).xPremium);
  }

  @Post('posts/:id/publish-now')
  async publishNow(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.publishNow(auth.organizationId, id, (await this.user(auth)).xPremium);
  }

  @Post('posts/:id/cancel')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.cancel(auth.organizationId, id);
  }

  @Post('posts/:id/retry')
  retry(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.retry(auth.organizationId, id);
  }

  @Post('posts/import')
  async importCsv(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(importSchema)) body: z.infer<typeof importSchema>,
  ) {
    const user = await this.user(auth);
    return this.posts.importCsv(auth.organizationId, body.csv, user.timezone, user.xPremium);
  }

  // ---------- Posting slots ----------

  @Get('slots')
  slots(@CurrentAuth() auth: AuthContext) {
    return this.prisma
      .tenant(auth.organizationId)
      .postingSlot.findMany({ orderBy: [{ weekday: 'asc' }, { minuteOfDay: 'asc' }] });
  }

  @Post('slots')
  addSlot(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(slotSchema)) body: z.infer<typeof slotSchema>,
  ) {
    return this.prisma.tenant(auth.organizationId).postingSlot.upsert({
      where: {
        organizationId_weekday_minuteOfDay: { organizationId: auth.organizationId, ...body },
      },
      create: { organizationId: auth.organizationId, ...body },
      update: {},
    });
  }

  @Delete('slots/:id')
  @HttpCode(204)
  async removeSlot(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.tenant(auth.organizationId).postingSlot.deleteMany({ where: { id } });
  }

  @Get('slots/next-free')
  async nextFree(@CurrentAuth() auth: AuthContext) {
    const db = this.prisma.tenant(auth.organizationId);
    const user = await this.user(auth);
    const [slots, scheduled] = await Promise.all([
      db.postingSlot.findMany(),
      db.post.findMany({
        where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
        select: { scheduledAt: true },
      }),
    ]);
    return {
      localDateTime: nextFreeSlot(
        slots,
        user.timezone,
        scheduled.map((p) => p.scheduledAt!),
      ),
      timezone: user.timezone,
    };
  }
}

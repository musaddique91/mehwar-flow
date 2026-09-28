import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { PLATFORMS, type Platform } from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth, Public } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ChannelsService } from './channels.service';

const platformPipe = new ZodPipe(z.enum(PLATFORMS));
const selectSchema = z.object({ externalIds: z.array(z.string().min(1)).min(1).max(50) });

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.channels.list(auth.organizationId);
  }

  /** Which networks this server has developer credentials for. */
  @Get('available')
  available() {
    return this.channels.available();
  }

  @Post('connect/:platform')
  async connect(
    @CurrentAuth() auth: AuthContext,
    @Param('platform', platformPipe) platform: Platform,
  ) {
    return { url: await this.channels.startConnect(auth.organizationId, auth.userId, platform) };
  }

  /** OAuth redirect target. Public: identity comes from the one-time `state` stored in Redis. */
  @Public()
  @Get('callback/:platform')
  async callback(
    @Param('platform', platformPipe) platform: Platform,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const path = await this.channels.handleCallback(platform, query);
    res.redirect(302, `${this.channels.webOrigin}${path}`);
  }

  @Get('pending/:session')
  pending(@CurrentAuth() auth: AuthContext, @Param('session') session: string) {
    return this.channels.pendingAccounts(auth.organizationId, session);
  }

  @Post('pending/:session')
  select(
    @CurrentAuth() auth: AuthContext,
    @Param('session') session: string,
    @Body(new ZodPipe(selectSchema)) body: z.infer<typeof selectSchema>,
  ) {
    return this.channels.selectPending(auth.organizationId, auth.userId, session, body.externalIds);
  }

  @Delete(':id')
  @HttpCode(204)
  async disconnect(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.channels.disconnect(auth.organizationId, auth.userId, id);
  }
}

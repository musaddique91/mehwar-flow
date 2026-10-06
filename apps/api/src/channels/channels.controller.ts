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
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PLATFORMS, type Platform } from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth, Public } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ChannelsService } from './channels.service';

const platformPipe = new ZodPipe(z.enum(PLATFORMS));
const selectSchema = z.object({ externalIds: z.array(z.string().min(1)).min(1).max(50) });

@Controller(['channels', 'api/channels'])
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  /** Public endpoint to serve or stream permanent channel avatars (with cache headers). */
  @Public()
  @Get(':id/avatar')
  async getAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('refresh') refresh: string,
    @Res() res: Response,
  ) {
    const avatar = await this.channels.getChannelAvatarStream(id, refresh === 'true');
    if (!avatar) {
      return res.status(404).send('Avatar not found');
    }
    if ('redirectUrl' in avatar) {
      return res.redirect(302, avatar.redirectUrl);
    }
    res.setHeader('Content-Type', avatar.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return (avatar.stream as any).pipe(res);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.channels.list(auth.organizationId);
  }

  /** Which networks this server has developer credentials for. */
  @Get('available')
  available() {
    return this.channels.available();
  }

  @Get('all-comments')
  getAllComments(
    @CurrentAuth() auth: AuthContext,
    @Query('channelId') channelId?: string,
    @Query('sampleIfEmpty') sampleIfEmpty?: string,
  ) {
    return this.channels.getAllComments(
      auth.organizationId,
      channelId,
      sampleIfEmpty === 'true',
    );
  }

  @Get(':id/details')
  getDetails(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.channels.getDetails(auth.organizationId, id);
  }

  @Get(':id/videos/:videoId/comments')
  getVideoComments(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.channels.getVideoComments(auth.organizationId, id, videoId);
  }

  @Post(':id/videos/:videoId/comments')
  replyToComment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId') videoId: string,
    @Body() body: { text: string; parentId?: string },
  ) {
    return this.channels.replyToComment(auth.organizationId, id, videoId, body);
  }

  @Post(':id/videos/:videoId/like')
  @HttpCode(200)
  likePost(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.channels.likePost(auth.organizationId, id, videoId);
  }

  @Post(':id/videos/:videoId/retweet')
  @HttpCode(200)
  retweetPost(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.channels.retweetPost(auth.organizationId, id, videoId);
  }

  @Delete(':id/videos/:videoId/comments/:commentId')
  @HttpCode(204)
  async deleteComment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
  ) {
    await this.channels.deleteComment(auth.organizationId, id, videoId, commentId);
  }

  @Post('connect/:platform')
  async connect(
    @CurrentAuth() auth: AuthContext,
    @Param('platform', platformPipe) platform: Platform,
    @Req() req: Request,
  ) {
    const clientOrigin =
      (req.headers.origin as string) ||
      (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    return {
      url: await this.channels.startConnect(
        auth.organizationId,
        auth.userId,
        platform,
        clientOrigin,
      ),
    };
  }

  /** OAuth redirect target. Public: identity comes from the one-time `state` stored in Redis. */
  @Public()
  @Get('callback/:platform')
  async callback(
    @Param('platform', platformPipe) platform: Platform,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const result = await this.channels.handleCallback(platform, query);
    const origin = result.origin || this.channels.webOrigin;
    res.redirect(302, `${origin}${result.path}`);
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

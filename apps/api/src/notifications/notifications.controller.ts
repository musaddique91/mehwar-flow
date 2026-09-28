import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { EventsService } from '../infra/events.service';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
  ) {}

  @Get('notifications')
  list(@CurrentAuth() auth: AuthContext) {
    return this.notifications.list(auth.organizationId);
  }

  @Post('notifications/read')
  @HttpCode(204)
  async read(@CurrentAuth() auth: AuthContext) {
    await this.notifications.markAllRead(auth.organizationId);
  }

  /** Server-sent events: live post/media/channel updates and notifications for this account. */
  @SkipThrottle()
  @Get('events')
  async stream(@CurrentAuth() auth: AuthContext, @Req() req: Request, @Res() res: Response) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');
    const unsubscribe = await this.events.subscribe(auth.organizationId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}

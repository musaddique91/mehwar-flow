import { createHash, timingSafeEqual } from 'node:crypto';
import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post } from '@nestjs/common';
import type { WhatsAppStatusDto } from '@mehwar/shared';
import { CurrentAuth, Public } from '../auth/decorators';
import type { AuthContext } from '../auth/auth.types';
import { WhatsAppService } from './whatsapp.service';

@Controller(['whatsapp', 'api/whatsapp'])
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('status')
  async getStatus(@CurrentAuth() auth: AuthContext): Promise<WhatsAppStatusDto> {
    return this.whatsapp.getStatus(auth.organizationId);
  }

  @Post('connect')
  @HttpCode(200)
  async connect(@CurrentAuth() auth: AuthContext): Promise<WhatsAppStatusDto> {
    return this.whatsapp.connect(auth.organizationId);
  }

  @Post('disconnect')
  @HttpCode(204)
  async disconnect(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.whatsapp.disconnect(auth.organizationId);
  }

  @Post('status/profile')
  @HttpCode(200)
  async setProfileStatus(
    @CurrentAuth() _auth: AuthContext,
    @Body() body: { status: string },
  ): Promise<{ success: boolean; status: string; delivered: 'STATUS' | 'SELF_MESSAGE' }> {
    const res = await this.whatsapp.setStatus(body.status);
    return { success: true, status: body.status, delivered: res.delivered };
  }

  @Public()
  @Post('internal-publish')
  @HttpCode(200)
  async internalPublish(
    @Headers('x-internal-token') token: string | undefined,
    @Body() body: { text: string; postType?: 'MESSAGE' | 'STATUS'; recipient?: string },
  ): Promise<{ externalId: string; url?: string }> {
    // No user session here (the worker calls it), so require the secret the worker derives from
    // the shared master keys. Without this check anyone could send from the connected number.
    const secret = process.env.MASTER_KEYS;
    const expected = createHash('sha256').update(`wa-internal:${secret ?? ''}`).digest();
    const supplied = Buffer.from(token ?? '', 'hex');
    if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ForbiddenException();
    }
    return this.whatsapp.publishPostTarget(body.text, {
      postType: body.postType,
      recipient: body.recipient,
    });
  }
}

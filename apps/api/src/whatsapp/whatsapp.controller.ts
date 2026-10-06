import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
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
  ): Promise<{ success: boolean; status: string }> {
    await this.whatsapp.setStatus(body.status);
    return { success: true, status: body.status };
  }

  @Public()
  @Post('internal-publish')
  @HttpCode(200)
  async internalPublish(
    @Body() body: { text: string; postType?: 'MESSAGE' | 'STATUS'; recipient?: string },
  ): Promise<{ externalId: string; url?: string }> {
    return this.whatsapp.publishPostTarget(body.text, {
      postType: body.postType,
      recipient: body.recipient,
    });
  }
}

import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { WhatsAppStatusDto } from '@mehwar/shared';
import { CurrentAuth } from '../auth/decorators';
import type { AuthContext } from '../auth/auth.types';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
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
}

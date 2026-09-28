import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { aiCaptionSchema, aiRewriteSchema } from '@mehwar/shared';
import type { Storage } from '@mehwar/storage';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { STORAGE } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

const altTextSchema = z.object({ mediaId: z.string().uuid() });
const ALT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage | null,
  ) {}

  @Get('status')
  status() {
    return { enabled: this.ai.enabled };
  }

  @Post('caption')
  captions(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiCaptionSchema)) body: z.infer<typeof aiCaptionSchema>,
  ) {
    return this.ai.captions(auth.organizationId, body.prompt, body.platforms, body.tone);
  }

  @Post('rewrite')
  rewrite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiRewriteSchema)) body: z.infer<typeof aiRewriteSchema>,
  ) {
    return this.ai.rewrite(auth.organizationId, body.text, body.platform, body.instruction);
  }

  @Post('alt-text')
  async altText(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(altTextSchema)) body: z.infer<typeof altTextSchema>,
  ) {
    const media = await this.prisma
      .tenant(auth.organizationId)
      .mediaAsset.findUnique({ where: { id: body.mediaId } });
    if (!media || !this.storage) throw new NotFoundException();
    // Prefer the processed JPEG thumbnail: small and always a supported type.
    const key = media.thumbnailKey ?? media.storageKey;
    const type = media.thumbnailKey ? 'image/jpeg' : media.mimeType;
    if (!(ALT_TYPES as readonly string[]).includes(type))
      throw new BadRequestException('Alt text needs a JPEG, PNG, WebP or GIF image');
    const data = (await this.storage.getBuffer(key)).toString('base64');
    return this.ai.altText(auth.organizationId, {
      data,
      mediaType: type as (typeof ALT_TYPES)[number],
    });
  }
}

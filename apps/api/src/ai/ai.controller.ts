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
import {
  aiCaptionSchema,
  aiHashtagsSchema,
  aiHooksSchema,
  aiPostIdeasSchema,
  aiRewriteSchema,
  updateAiSettingsSchema,
} from '@mehwar/shared';
import type { Storage } from '@mehwar/storage';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { STORAGE } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

const altTextSchema = z.object({ mediaId: z.string().uuid() });
const ALT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const testConnectionSchema = z
  .object({
    provider: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

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

  @Get('settings')
  getSettings(@CurrentAuth() auth: AuthContext) {
    return this.ai.getUserAiConfig(auth.userId);
  }

  @Post('settings')
  updateSettings(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(updateAiSettingsSchema)) body: z.infer<typeof updateAiSettingsSchema>,
  ) {
    return this.ai.updateAiSettings(auth.userId, auth.organizationId, body);
  }

  @Post('test-connection')
  testConnection(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(testConnectionSchema))
    body?: { provider?: string; baseUrl?: string; apiKey?: string; model?: string },
  ) {
    return this.ai.testAiConnection(auth.userId, auth.organizationId, body);
  }

  @Post('caption')
  captions(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiCaptionSchema)) body: z.infer<typeof aiCaptionSchema>,
  ) {
    return this.ai.captions(
      auth.userId,
      auth.organizationId,
      body.prompt,
      body.platforms,
      body.tone,
    );
  }

  @Post('rewrite')
  rewrite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiRewriteSchema)) body: z.infer<typeof aiRewriteSchema>,
  ) {
    return this.ai.rewrite(
      auth.userId,
      auth.organizationId,
      body.text,
      body.platform,
      body.instruction,
    );
  }

  @Post('hashtags')
  hashtags(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiHashtagsSchema)) body: z.infer<typeof aiHashtagsSchema>,
  ) {
    return this.ai.generateHashtags(auth.userId, auth.organizationId, body);
  }

  @Post('ideas')
  ideas(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiPostIdeasSchema)) body: z.infer<typeof aiPostIdeasSchema>,
  ) {
    return this.ai.generatePostIdeas(auth.userId, auth.organizationId, body);
  }

  @Post('hooks')
  hooks(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(aiHooksSchema)) body: z.infer<typeof aiHooksSchema>,
  ) {
    return this.ai.generateHooks(auth.userId, auth.organizationId, body);
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

  @Post('analyze-comments')
  analyzeComments(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      comments?: Array<{ id?: string; authorName?: string; text: string; publishedAt?: string }>;
      sampleIfEmpty?: boolean;
      videoTitle?: string;
      videoDescription?: string;
    },
  ) {
    return this.ai.analyzeComments(
      auth.organizationId,
      body.comments ?? [],
      body.sampleIfEmpty ?? false,
      { title: body.videoTitle, description: body.videoDescription },
      auth.userId,
    );
  }
}

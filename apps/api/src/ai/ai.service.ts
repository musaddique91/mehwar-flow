import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { maxTextLength, PLATFORM_RULES, type Platform } from '@mehwar/shared';
import { EntitlementsService } from '../billing/entitlements.service';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

const CaptionsSchema = z.object({
  captions: z.array(
    z.object({
      platform: z.string(),
      text: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

const RewriteSchema = z.object({ text: z.string() });
const AltTextSchema = z.object({ altText: z.string() });

const SYSTEM = `You are the writing assistant inside Mehwar Flow, a tool people use to publish to their own social media accounts.
Write in the user's voice, not as a brand spokesperson for Mehwar Flow. Match each network's culture and limits:
- X: punchy, conversational; respect the character limit given.
- Instagram: visual storytelling, line breaks, hashtags at the end (max 30).
- Facebook: warm and informative; a clear call to action when it fits.
- Threads: casual and conversational.
- TikTok: a short hook that makes people watch; trending-style hashtags.
- YouTube: the text is the video title; make it clear and searchable.
- Snapchat: a very short caption.
Never invent facts, prices, dates or links that the user didn't give you. Keep hashtags relevant and without spaces.`;

/**
 * AI assistant backed by Claude. Every call is metered in `AiUsage` against the plan's monthly
 * credits. Disabled (503) when ANTHROPIC_API_KEY is not set.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {
    this.client = config.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private async run<T>(
    organizationId: string,
    feature: string,
    schema: z.ZodType<T>,
    content: Anthropic.Beta.BetaContentBlockParam[] | string,
  ): Promise<T> {
    if (!this.client)
      throw new ServiceUnavailableException(
        'The AI assistant is not configured (ANTHROPIC_API_KEY)',
      );
    await this.entitlements.assertWithin(organizationId, 'aiCreditsPerMonth');
    const user = await this.brandVoice(organizationId);

    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.config.AI_MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: user ? `${SYSTEM}\n\nThe user's brand voice guidance:\n${user}` : SYSTEM,
        messages: [{ role: 'user', content }],
        output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        throw new HttpException(
          'The AI assistant is busy; try again in a moment',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Claude API error ${err.status}: ${err.message}`);
        throw new ServiceUnavailableException('The AI assistant is temporarily unavailable');
      }
      throw err;
    }

    await this.prisma.tenant(organizationId).aiUsage.create({
      data: {
        organizationId,
        feature,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new HttpException(
        "The AI assistant can't help with this request",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!response.parsed_output)
      throw new ServiceUnavailableException('The AI assistant returned an unexpected answer');
    return response.parsed_output;
  }

  private async brandVoice(organizationId: string): Promise<string | null> {
    const org = await this.prisma.tenant(organizationId).organization.findUnique({
      where: { id: organizationId },
      select: { owner: { select: { brandVoice: true } } },
    });
    return org?.owner.brandVoice ?? null;
  }

  async captions(organizationId: string, prompt: string, platforms: Platform[], tone?: string) {
    const limits = platforms
      .map((p) => `- ${p}: ${PLATFORM_RULES[p].label}, max ${maxTextLength(p)} characters`)
      .join('\n');
    const result = await this.run(
      organizationId,
      'caption',
      CaptionsSchema,
      `Write one post for each of these networks (use the platform ids exactly):\n${limits}\n\n` +
        `${tone ? `Tone: ${tone}\n` : ''}What the post is about:\n${prompt}\n\n` +
        'Put hashtags only in the hashtags array (without the # sign), not in the text.',
    );
    return result.captions
      .filter((c) => platforms.includes(c.platform as Platform))
      .map((c) => ({
        platform: c.platform as Platform,
        text: c.text.slice(0, maxTextLength(c.platform as Platform)),
        hashtags: c.hashtags.map((h) => h.replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean),
      }));
  }

  async rewrite(organizationId: string, text: string, platform: Platform, instruction?: string) {
    const result = await this.run(
      organizationId,
      'rewrite',
      RewriteSchema,
      `Rewrite this post for ${PLATFORM_RULES[platform].label} (max ${maxTextLength(platform)} characters).` +
        `${instruction ? ` Extra instruction: ${instruction}.` : ''}\n\nPost:\n${text}`,
    );
    return { text: result.text.slice(0, maxTextLength(platform)) };
  }

  async altText(
    organizationId: string,
    image: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' },
  ) {
    return this.run(organizationId, 'alt-text', AltTextSchema, [
      { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
      {
        type: 'text',
        text: 'Write concise alt text (max 250 characters) describing this image for screen-reader users.',
      },
    ]);
  }
}

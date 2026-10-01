import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import {
  AI_PROVIDERS,
  CommentAnalysisResultDto,
  maxTextLength,
  PLATFORM_RULES,
  type AiHashtagsInput,
  type AiHooksInput,
  type AiPostIdeasInput,
  type Platform,
  type UpdateAiSettingsInput,
  type VideoSuggestionDto,
} from '@mehwar/shared';
import { EntitlementsService } from '../billing/entitlements.service';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';

const CaptionsSchema = z.object({
  captions: z.array(
    z.object({
      platform: z.string(),
      text: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

const AltTextSchema = z.object({ altText: z.string() });

const SYSTEM = `You are the writing assistant inside Mehwar Flow, a tool people use to publish to their own social media accounts.
Write in the user's voice, not as a brand spokesperson for Mehwar Flow. Match each network's culture and limits:
- X: punchy, conversational; respect the character limit given.
- LinkedIn: professional, thought-leadership, structured with whitespace, actionable takeaways.
- Instagram: visual storytelling, line breaks, hashtags at the end (max 30).
- Facebook: warm and informative; a clear call to action when it fits.
- Threads: casual and conversational.
- TikTok: a short hook that makes people watch; trending-style hashtags.
- YouTube: the text is the video title; make it clear and searchable.
- Snapchat: a very short caption.
Never invent facts, prices, dates or links that the user didn't give you. Keep hashtags relevant and without spaces.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly vault: VaultService,
  ) {
    this.client = config.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
      : null;
  }

  get enabled(): boolean {
    return true;
  }

  /**
   * Retrieves the user's configured AI settings.
   */
  async getUserAiConfig(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProvider: true,
        aiBaseUrl: true,
        aiModel: true,
        aiDefaultModel: true,
        aiApiKeyEnc: true,
        aiApiKeyPrefix: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const providerKey = user.aiProvider || 'nvidia';
    const providerMeta = AI_PROVIDERS[providerKey] || AI_PROVIDERS.nvidia;

    const hasUserKey = Boolean(user.aiApiKeyEnc);
    const isNvidia = providerKey === 'nvidia';
    const hasEnvKey = Boolean(this.config.NVIDIA_API_KEY);
    const isUsingEnvDefaultKey = !hasUserKey && isNvidia && hasEnvKey;

    let maskedKey = user.aiApiKeyPrefix || null;
    if (!maskedKey && isUsingEnvDefaultKey && this.config.NVIDIA_API_KEY) {
      const k = this.config.NVIDIA_API_KEY;
      maskedKey = k.length > 8 ? `${k.slice(0, 5)}...${k.slice(-4)}` : '••••••••';
    }

    return {
      aiProvider: user.aiProvider || 'nvidia',
      aiBaseUrl: user.aiBaseUrl || providerMeta.defaultBaseUrl,
      aiModel: user.aiModel || this.config.NVIDIA_MODEL || providerMeta.defaultModel,
      aiDefaultModel: user.aiDefaultModel || user.aiModel || this.config.NVIDIA_MODEL || providerMeta.defaultModel,
      hasAiApiKey: hasUserKey || (isNvidia && hasEnvKey),
      aiApiKeyMasked: maskedKey,
      isEnvDefaultKey: isUsingEnvDefaultKey,
    };
  }

  /**
   * Updates user-level AI configuration.
   * API key is encrypted using TokenVault and never exposed in plaintext again.
   */
  async updateAiSettings(userId: string, organizationId: string, input: UpdateAiSettingsInput) {
    const updateData: any = {};
    if (input.provider !== undefined) updateData.aiProvider = input.provider;
    if (input.baseUrl !== undefined) updateData.aiBaseUrl = input.baseUrl;
    if (input.model !== undefined) updateData.aiModel = input.model;
    if (input.defaultModel !== undefined) updateData.aiDefaultModel = input.defaultModel;

    if (typeof input.apiKey === 'string') {
      const trimmed = input.apiKey.trim();
      if (trimmed.length > 0) {
        const encrypted = await this.vault.encrypt(organizationId, trimmed, 'user:ai_key');
        updateData.aiApiKeyEnc = encrypted;
        if (trimmed.length <= 8) {
          updateData.aiApiKeyPrefix = '••••••••';
        } else if (trimmed.startsWith('sk-')) {
          updateData.aiApiKeyPrefix = `sk-...${trimmed.slice(-4)}`;
        } else if (trimmed.startsWith('AIzaSy')) {
          updateData.aiApiKeyPrefix = `AIza...${trimmed.slice(-4)}`;
        } else if (trimmed.startsWith('nvapi-')) {
          updateData.aiApiKeyPrefix = `nvapi...${trimmed.slice(-4)}`;
        } else {
          updateData.aiApiKeyPrefix = `${trimmed.slice(0, 3)}...${trimmed.slice(-4)}`;
        }
      } else {
        // Empty string clears the key
        updateData.aiApiKeyEnc = null;
        updateData.aiApiKeyPrefix = null;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        aiProvider: true,
        aiBaseUrl: true,
        aiModel: true,
        aiDefaultModel: true,
        aiApiKeyEnc: true,
        aiApiKeyPrefix: true,
      },
    });

    const providerKey = updated.aiProvider || 'nvidia';
    const providerMeta = AI_PROVIDERS[providerKey] || AI_PROVIDERS.nvidia;

    const hasUserKey = Boolean(updated.aiApiKeyEnc);
    const isNvidia = providerKey === 'nvidia';
    const hasEnvKey = Boolean(this.config.NVIDIA_API_KEY);
    const isUsingEnvDefaultKey = !hasUserKey && isNvidia && hasEnvKey;

    let maskedKey = updated.aiApiKeyPrefix || null;
    if (!maskedKey && isUsingEnvDefaultKey && this.config.NVIDIA_API_KEY) {
      const k = this.config.NVIDIA_API_KEY;
      maskedKey = k.length > 8 ? `${k.slice(0, 5)}...${k.slice(-4)}` : '••••••••';
    }

    return {
      aiProvider: updated.aiProvider || providerMeta.id,
      aiBaseUrl: updated.aiBaseUrl || providerMeta.defaultBaseUrl,
      aiModel: updated.aiModel || (providerKey === 'nvidia' ? this.config.NVIDIA_MODEL : undefined) || providerMeta.defaultModel,
      aiDefaultModel: updated.aiDefaultModel || updated.aiModel || (providerKey === 'nvidia' ? this.config.NVIDIA_MODEL : undefined) || providerMeta.defaultModel,
      hasAiApiKey: hasUserKey || (isNvidia && hasEnvKey),
      aiApiKeyMasked: maskedKey,
      isEnvDefaultKey: isUsingEnvDefaultKey,
    };
  }

  /**
   * Tests connection with user's saved or provided credentials.
   */
  async testAiConnection(
    userId: string,
    organizationId: string,
    custom?: { provider?: string; baseUrl?: string; apiKey?: string; model?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProvider: true,
        aiBaseUrl: true,
        aiModel: true,
        aiDefaultModel: true,
        aiApiKeyEnc: true,
      },
    });

    const provider = custom?.provider || user?.aiProvider || 'nvidia';
    const providerMeta = AI_PROVIDERS[provider] || AI_PROVIDERS.nvidia;
    const baseUrl = custom?.baseUrl || user?.aiBaseUrl || providerMeta.defaultBaseUrl;
    const model = custom?.model || user?.aiDefaultModel || user?.aiModel || (provider === 'nvidia' ? this.config.NVIDIA_MODEL : undefined) || providerMeta.defaultModel;

    let apiKey = custom?.apiKey?.trim();
    if (!apiKey && user?.aiApiKeyEnc) {
      try {
        apiKey = await this.vault.decrypt(organizationId, user.aiApiKeyEnc, 'user:ai_key');
      } catch (err) {
        return {
          success: false,
          error: `Failed to decrypt saved API key: ${(err as Error).message}`,
        };
      }
    } else if (!apiKey && provider === 'nvidia' && this.config.NVIDIA_API_KEY) {
      // Use system default key from .env for NVIDIA NIM
      apiKey = this.config.NVIDIA_API_KEY;
    }

    if (!apiKey && provider !== 'ollama') {
      return {
        success: false,
        error: 'No API key provided or saved for this user.',
      };
    }

    try {
      const response = await this.executeProviderCall({
        provider,
        baseUrl,
        model,
        apiKey: apiKey || '',
        messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
        maxTokens: 15,
        temperature: 0.1,
      });

      return {
        success: true,
        message: `Successfully connected to ${model} via ${providerMeta.name}! Response: "${response.trim().slice(0, 30)}"`,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message || 'Connection test failed',
      };
    }
  }

  /**
   * Universal provider caller supporting OpenAI-compatible and Anthropic endpoints.
   */
  async executeProviderCall(params: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<string> {
    const { provider, baseUrl, model, apiKey, messages, maxTokens = 1200, temperature = 0.7, jsonMode } = params;

    if (provider === 'anthropic') {
      const cleanUrl = `${baseUrl.replace(/\/+$/, '')}/messages`;
      const systemMsg = messages.find((m) => m.role === 'system')?.content;
      const userMsgs = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemMsg,
          messages: userMsgs,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic error (${res.status}): ${errText}`);
      }
      const data = (await res.json()) as any;
      return data.content?.[0]?.text || '';
    }

    // OpenAI-compatible endpoint
    let cleanUrl = baseUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/chat/completions')) {
      cleanUrl = `${cleanUrl}/chat/completions`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'http://localhost:3000';
      headers['X-Title'] = 'Mehwar Flow';
    }

    const payload: any = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (jsonMode && (provider === 'openai' || provider === 'groq' || provider === 'gemini')) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${provider} error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Calls the user's preferred LLM if configured; otherwise gracefully falls back to system providers.
   */
  async callLlm(
    userId: string,
    organizationId: string,
    messages: Array<{ role: string; content: string }>,
    options: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {},
  ): Promise<{ text: string; modelUsed: string }> {
    // 1. Check user-level settings
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProvider: true,
        aiBaseUrl: true,
        aiModel: true,
        aiDefaultModel: true,
        aiApiKeyEnc: true,
      },
    });

    const provider = user?.aiProvider || 'nvidia';
    const providerMeta = AI_PROVIDERS[provider] || AI_PROVIDERS.nvidia;
    const model = user?.aiDefaultModel || user?.aiModel || (provider === 'nvidia' ? this.config.NVIDIA_MODEL : undefined) || providerMeta.defaultModel;
    const baseUrl = user?.aiBaseUrl || providerMeta.defaultBaseUrl;

    let apiKey = '';
    if (user?.aiApiKeyEnc) {
      try {
        apiKey = await this.vault.decrypt(organizationId, user.aiApiKeyEnc, 'user:ai_key');
      } catch (err) {
        this.logger.warn(`Could not decrypt user AI key: ${(err as Error).message}`);
      }
    } else if (provider === 'nvidia' && this.config.NVIDIA_API_KEY) {
      // Default to system NVIDIA NIM key
      apiKey = this.config.NVIDIA_API_KEY;
    }

    if (apiKey || provider === 'ollama') {
      try {
        const text = await this.executeProviderCall({
          provider,
          baseUrl,
          model,
          apiKey,
          messages,
          maxTokens: options.maxTokens ?? 1200,
          temperature: options.temperature ?? 0.7,
          jsonMode: options.jsonMode,
        });
        return { text, modelUsed: `${provider}:${model}` };
      } catch (err) {
        this.logger.warn(
          `User-configured LLM call failed (${provider}:${model}): ${(err as Error).message}. Attempting system fallback...`,
        );
      }
    }

    // 2. Primary fallback: system NVIDIA NIM from .env
    if (this.config.NVIDIA_API_KEY) {
      try {
        const text = await this.callNvidia(messages, options.maxTokens ?? 1200);
        return { text, modelUsed: `nvidia:${this.config.NVIDIA_MODEL}` };
      } catch (err) {
        this.logger.warn(`System NVIDIA fallback failed: ${(err as Error).message}`);
      }
    }

    // 3. Secondary fallback: system Anthropic
    if (this.client) {
      try {
        const systemMsg = messages.find((m) => m.role === 'system')?.content;
        const userMsgs = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content,
          }));

        const resp = await this.client.messages.create({
          model: this.config.AI_MODEL,
          max_tokens: options.maxTokens ?? 1200,
          system: systemMsg,
          messages: userMsgs,
        });
        const first = resp.content[0];
        const text = first && 'text' in first ? first.text : '';
        return { text, modelUsed: `anthropic:${this.config.AI_MODEL}` };
      } catch (err) {
        this.logger.warn(`System Anthropic fallback failed: ${(err as Error).message}`);
      }
    }

    throw new ServiceUnavailableException(
      'No AI model available. Please configure your LLM provider and API key in Settings -> AI Configuration.',
    );
  }

  async callNvidia(
    messages: Array<{ role: string; content: string }>,
    maxTokens = 800,
    timeoutMs = 30000,
  ): Promise<string> {
    if (!this.config.NVIDIA_API_KEY) {
      throw new ServiceUnavailableException('NVIDIA_API_KEY is not configured');
    }
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: this.config.NVIDIA_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`NVIDIA API error ${res.status}: ${errBody}`);
    }
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
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

  async captions(
    userId: string,
    organizationId: string,
    prompt: string,
    platforms: Platform[],
    tone?: string,
  ) {
    const limits = platforms
      .map((p) => `- ${p}: ${PLATFORM_RULES[p].label}, max ${maxTextLength(p)} characters`)
      .join('\n');

    const promptText =
      `Generate engaging social media captions for these platforms:\n${limits}\n\n` +
      `Topic/Draft: ${prompt}\n` +
      `${tone ? `Tone of voice: ${tone}\n` : ''}` +
      `Instructions: Return ONLY a valid JSON array of objects with keys "platform", "text", and "hashtags".\n` +
      `Do not include '#' in the hashtags array. Do not put markdown code fences. Example:\n` +
      `[{"platform": "x", "text": "...", "hashtags": ["tag1", "tag2"]}]`;

    try {
      const { text } = await this.callLlm(
        userId,
        organizationId,
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: promptText },
        ],
        { maxTokens: 1500, temperature: 0.7 },
      );

      const parsed = extractJson(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.captions || [];
      return arr
        .filter((c: any) => platforms.includes(c.platform as Platform))
        .map((c: any) => ({
          platform: c.platform as Platform,
          text: String(c.text || '').slice(0, maxTextLength(c.platform as Platform)),
          hashtags: (c.hashtags || [])
            .map((h: string) => String(h).replace(/^#/, '').replace(/\s+/g, ''))
            .filter(Boolean),
        }));
    } catch (err) {
      this.logger.warn(`AI captions error: ${(err as Error).message}`);
      if (this.client) {
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
      throw err;
    }
  }

  async rewrite(
    userId: string,
    organizationId: string,
    text: string,
    platform: Platform,
    instruction?: string,
  ) {
    const promptText =
      `Rewrite this post for ${PLATFORM_RULES[platform].label} (max ${maxTextLength(platform)} characters).` +
      `${instruction ? ` Extra instruction: ${instruction}.` : ''}\n\n` +
      `Original content:\n${text}\n\n` +
      `Output ONLY the rewritten text, formatted naturally for ${PLATFORM_RULES[platform].label} without conversational filler or quotation marks.`;

    const { text: resultText, modelUsed } = await this.callLlm(
      userId,
      organizationId,
      [
        { role: 'system', content: 'You are a social media writing assistant. Output ONLY the rewritten post text.' },
        { role: 'user', content: promptText },
      ],
      { maxTokens: 1000, temperature: 0.6 },
    );

    return {
      text: resultText.trim().slice(0, maxTextLength(platform)),
      modelUsed,
    };
  }

  async generateHashtags(
    userId: string,
    organizationId: string,
    input: AiHashtagsInput,
  ) {
    const count = input.count ?? 15;
    const platformLabel = input.platform ? input.platform : 'social media';
    const promptText =
      `Generate ${count} high-performing, targeted hashtags for this post on ${platformLabel}.\n` +
      `Post content:\n"${input.text}"\n\n` +
      `Provide a strategic blend of:\n` +
      `- Broad/high-traffic hashtags\n` +
      `- Specific niche community tags\n` +
      `- Trending industry tags\n\n` +
      `Return pure JSON only in this format: {"hashtags": ["#marketing", "#growth", ...]}`;

    const { text, modelUsed } = await this.callLlm(
      userId,
      organizationId,
      [
        { role: 'system', content: 'You are an elite social media hashtag strategist. Output valid JSON only.' },
        { role: 'user', content: promptText },
      ],
      { maxTokens: 600, temperature: 0.5 },
    );

    try {
      const parsed = extractJson(text);
      const rawList: string[] = Array.isArray(parsed) ? parsed : parsed.hashtags || [];
      const cleanHashtags = rawList
        .map((h) => {
          const s = String(h).trim();
          return s.startsWith('#') ? s : `#${s}`;
        })
        .filter((h) => h.length > 1);

      return {
        hashtags: cleanHashtags.slice(0, count),
        rawText: cleanHashtags.join(' '),
        modelUsed,
      };
    } catch {
      const matches = text.match(/#[\p{L}\p{N}_]+/gu) || [];
      return {
        hashtags: matches.slice(0, count),
        rawText: matches.slice(0, count).join(' '),
        modelUsed,
      };
    }
  }

  async generatePostIdeas(
    userId: string,
    organizationId: string,
    input: AiPostIdeasInput,
  ) {
    const count = input.count ?? 4;
    const platformStr = input.platform
      ? `specifically tailored for ${input.platform}`
      : 'across top platforms (LinkedIn, X, Instagram, YouTube)';
    const promptText =
      `Brainstorm ${count} viral, high-converting social media post angles based on this topic or niche:\n"${input.topic}"\n\n` +
      `Target: ${platformStr}\n\n` +
      `For each idea, create a compelling angle, a high-converting hook, a post body outline, call to action, and platform recommendation.\n` +
      `Return ONLY valid JSON matching this schema:\n` +
      `{\n` +
      `  "ideas": [\n` +
      `    {\n` +
      `      "id": "idea-1",\n` +
      `      "title": "Angle / Post Concept Title",\n` +
      `      "hook": "Attention-grabbing opening line",\n` +
      `      "angle": "Educational / Contrarian / Story / Case Study / Framework",\n` +
      `      "body": "Draft outline or key bullet points for the post",\n` +
      `      "callToAction": "Clear CTA for engagement or clicks",\n` +
      `      "suggestedPlatform": "x | linkedin | instagram | youtube | threads",\n` +
      `      "hashtags": ["tag1", "tag2"]\n` +
      `    }\n` +
      `  ]\n` +
      `}`;

    const { text, modelUsed } = await this.callLlm(
      userId,
      organizationId,
      [
        { role: 'system', content: 'You are an elite viral content strategist and ghostwriter. Output valid JSON only.' },
        { role: 'user', content: promptText },
      ],
      { maxTokens: 2000, temperature: 0.8 },
    );

    const parsed = extractJson(text);
    const ideas = Array.isArray(parsed) ? parsed : parsed.ideas || [];
    return {
      ideas: ideas.map((item: any, idx: number) => ({
        id: item.id || `idea-${idx + 1}`,
        title: item.title || `Concept ${idx + 1}`,
        hook: item.hook || '',
        angle: item.angle || 'Strategy',
        body: item.body || '',
        callToAction: item.callToAction || '',
        suggestedPlatform: item.suggestedPlatform || input.platform || 'x',
        hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
      })),
      modelUsed,
    };
  }

  async generateHooks(
    userId: string,
    organizationId: string,
    input: AiHooksInput,
  ) {
    const count = input.count ?? 5;
    const promptText =
      `Generate ${count} magnetic, scroll-stopping opening hooks for this post or video concept:\n"${input.text}"\n\n` +
      `Include diverse viral styles:\n` +
      `1. Curiosity Gap\n` +
      `2. Contrarian / Hot Take\n` +
      `3. Actionable / Step-by-Step\n` +
      `4. Personal Story / Transformation\n` +
      `5. High-Stakes / FOMO\n\n` +
      `Return pure JSON only:\n` +
      `{\n` +
      `  "hooks": [\n` +
      `    {\n` +
      `      "id": "h-1",\n` +
      `      "style": "Curiosity Gap",\n` +
      `      "text": "The exact hook sentence to copy-paste",\n` +
      `      "whyItWorks": "1-sentence explanation of psychological trigger"\n` +
      `    }\n` +
      `  ]\n` +
      `}`;

    try {
      const { text, modelUsed } = await this.callLlm(
        userId,
        organizationId,
        [
          { role: 'system', content: 'You are a master of video & post hooks with 10M+ impressions. Output pure JSON.' },
          { role: 'user', content: promptText },
        ],
        { maxTokens: 1200, temperature: 0.85 },
      );

      const parsed = extractJson(text);
      const hooks = Array.isArray(parsed) ? parsed : parsed.hooks || [];
      return {
        hooks: hooks.map((h: any, idx: number) => ({
          id: h.id || `h-${idx + 1}`,
          style: h.style || 'Viral Hook',
          text: h.text || '',
          whyItWorks: h.whyItWorks || '',
        })),
        modelUsed,
      };
    } catch (err) {
      this.logger.warn(`AI hooks error: ${(err as Error).message}. Returning curated templates.`);
      return {
        hooks: generateFallbackHooks(input.text, count),
        modelUsed: 'template-engine',
      };
    }
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

  /**
   * Analyzes comments for YouTube/Social videos and categorizes them into emotions:
   * happy, excited, angry, sad, question, neutral.
   * Also analyzes viewer/fan requests, questions, struggles, and suggestions to generate
   * high-demand next video ideas for the creator.
   */
  async analyzeComments(
    organizationId: string,
    rawComments: Array<{ id?: string; authorName?: string; text: string; publishedAt?: string }>,
    sampleIfEmpty = false,
    videoContext?: { title?: string; description?: string },
    userId?: string,
  ): Promise<CommentAnalysisResultDto> {
    const list = rawComments.length > 0 ? rawComments : (sampleIfEmpty ? SAMPLE_COMMENTS : []);
    if (list.length === 0) {
      return {
        summary: 'No comments to analyze. Load sample comments or check a video with active comments.',
        dominantEmotion: 'neutral',
        counts: { happy: 0, excited: 0, angry: 0, sad: 0, question: 0, neutral: 0, total: 0 },
        comments: [],
        videoSuggestions: [],
        modelUsed: this.config.NVIDIA_MODEL,
      };
    }

    const commentsPrompt = list.slice(0, 15).map((c, i) => {
      const cid = c.id || `c${i + 1}`;
      return `[ID: ${cid}] (Author: ${c.authorName || 'User'}) "${c.text.replace(/\n+/g, ' ')}"`;
    }).join('\n');

    const videoInfo = videoContext?.title
      ? `CURRENT VIDEO TITLE: "${videoContext.title}"\n${videoContext.description ? `VIDEO DESCRIPTION: "${videoContext.description.slice(0, 300)}"\n` : ''}\n`
      : '';

    let aiResult: any = null;
    let modelUsed = this.config.NVIDIA_MODEL || 'ai-model';

    const systemPrompt = `You are an expert social media emotion and sentiment classifier, and a viral YouTube content strategist.
Given comments from a YouTube video (and optionally current video context):
1. Classify each comment into one of: happy, excited, angry, sad, question, neutral. Provide an appropriate emoji and a concise reason.
2. Calculate emotion counts and identify the dominantEmotion.
3. Read the comments carefully to identify what fans/viewers are asking for, struggling with, curious about, or requesting.
4. Suggest 2 to 4 high-potential NEXT VIDEO TOPICS based directly on audience questions, problems, or requests found in the comments.

Return ONLY pure, valid JSON with this exact schema:
{
  "summary": "1-2 sentence summary of overall sentiment and audience requests",
  "dominantEmotion": "happy|excited|angry|sad|question|neutral",
  "counts": { "happy": 0, "excited": 0, "angry": 0, "sad": 0, "question": 0, "neutral": 0 },
  "categorized": [
    { "id": "comment_id", "emotion": "happy|excited|angry|sad|question|neutral", "emoji": "emoji_char", "reason": "concise explanation" }
  ],
  "videoSuggestions": [
    {
      "id": "sug-1",
      "title": "Catchy YouTube Video Title",
      "hook": "1-2 sentence compelling hook for the video",
      "reason": "Why to make this video based on audience demand",
      "fanRequests": ["Name: Quote or question from comment"],
      "suggestedFormat": "Tutorial|Deep Dive|Shorts / Quick Tip|Q&A / FAQ|Troubleshooting Guide|Comparison",
      "demandLevel": "High|Medium|Trending",
      "outline": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"]
    }
  ]
}
Do not wrap in markdown or backticks. Return raw JSON only.`;

    const userPrompt = `${videoInfo}Comments to analyze:\n${commentsPrompt}`;

    // Try user's LLM if userId is available, otherwise try NVIDIA/Anthropic
    if (userId) {
      try {
        const res = await this.callLlm(
          userId,
          organizationId,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { maxTokens: 1600, temperature: 0.3 },
        );
        aiResult = extractJson(res.text);
        modelUsed = res.modelUsed;
      } catch (err) {
        this.logger.warn(`User LLM analyzeComments failed: ${(err as Error).message}`);
      }
    }

    if (!aiResult && this.config.NVIDIA_API_KEY) {
      try {
        const responseText = await this.callNvidia([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], 1200, 18000);

        aiResult = extractJson(responseText);
        modelUsed = this.config.NVIDIA_MODEL;
      } catch (err) {
        this.logger.warn(`NVIDIA AI analyzeComments failed: ${(err as Error).message}`);
      }
    }

    const emotionMap = new Map<string, { emotion: string; emoji: string; reason: string }>();
    if (aiResult?.categorized && Array.isArray(aiResult.categorized)) {
      for (const item of aiResult.categorized) {
        if (item.id) {
          emotionMap.set(String(item.id), {
            emotion: normalizeEmotion(item.emotion),
            emoji: item.emoji || emotionEmoji(item.emotion),
            reason: item.reason || '',
          });
        }
      }
    }

    const counts = { happy: 0, excited: 0, angry: 0, sad: 0, question: 0, neutral: 0, total: list.length };
    const categorized = list.map((c, i) => {
      const cid = c.id || `c${i + 1}`;
      const found = emotionMap.get(cid) || fallbackClassify(c.text);
      const emotion = normalizeEmotion(found.emotion);
      counts[emotion as keyof typeof counts] = (counts[emotion as keyof typeof counts] || 0) + 1;
      return {
        id: cid,
        authorName: c.authorName || 'Anonymous',
        text: c.text,
        publishedAt: c.publishedAt,
        emotion,
        emoji: found.emoji || emotionEmoji(emotion),
        reason: found.reason,
      };
    });

    const dominant = (Object.entries(counts) as [string, number][])
      .filter(([k]) => k !== 'total')
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    let videoSuggestions: VideoSuggestionDto[] = [];
    if (aiResult?.videoSuggestions && Array.isArray(aiResult.videoSuggestions) && aiResult.videoSuggestions.length > 0) {
      videoSuggestions = aiResult.videoSuggestions.map((s: any, idx: number) => ({
        id: s.id || `sug-${idx + 1}`,
        title: s.title || `Suggested Video ${idx + 1}`,
        hook: s.hook || 'Explore this highly-requested topic based on viewer feedback.',
        reason: s.reason || 'Requested by viewers in the comment section.',
        fanRequests: Array.isArray(s.fanRequests) ? s.fanRequests : [],
        suggestedFormat: normalizeFormat(s.suggestedFormat),
        demandLevel: normalizeDemand(s.demandLevel),
        outline: Array.isArray(s.outline) && s.outline.length > 0
          ? s.outline
          : ['Introduction & Context', 'Step-by-step Execution', 'Viewer FAQ & Best Practices'],
      }));
    } else {
      videoSuggestions = generateFallbackVideoSuggestions(list, videoContext);
    }

    return {
      summary: aiResult?.summary || `Analyzed ${list.length} comments. The dominant emotion is ${dominant}. Fans are asking for tutorials and deeper explanations.`,
      dominantEmotion: dominant,
      counts,
      comments: categorized,
      videoSuggestions,
      modelUsed,
    };
  }
}

export const SAMPLE_COMMENTS = [
  {
    id: 'sample-1',
    authorName: 'Sarah Jenkins',
    text: 'This video made my entire day! 😍 The explanation is so clear and beautiful. Thank you so much for sharing your talent!',
    publishedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
  },
  {
    id: 'sample-2',
    authorName: 'Alex Rodriguez',
    text: 'OMG I have been waiting for this tutorial all week! Absolutely blown away by the result! 🔥🙌',
    publishedAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
  },
  {
    id: 'sample-3',
    authorName: 'David K.',
    text: 'Completely unwatchable. You skipped the most important step at 4:20 and the camera was totally blurry. Waste of time.',
    publishedAt: new Date(Date.now() - 3600_000 * 12).toISOString(),
  },
  {
    id: 'sample-4',
    authorName: 'Emily Watson',
    text: 'I tried following along but my project completely tore apart and fell over. Feeling so defeated and sad right now 😢',
    publishedAt: new Date(Date.now() - 3600_000 * 18).toISOString(),
  },
  {
    id: 'sample-5',
    authorName: 'CreativeSoul99',
    text: 'Could you please link the exact tools and colors you used in the description? Would love to buy the same set!',
    publishedAt: new Date(Date.now() - 3600_000 * 24).toISOString(),
  },
  {
    id: 'sample-6',
    authorName: 'Marcus Chen',
    text: 'Good tips overall. The intro was a bit long compared to your previous tutorials, but the second half was informative.',
    publishedAt: new Date(Date.now() - 3600_000 * 36).toISOString(),
  },
  {
    id: 'sample-7',
    authorName: 'Hannah Lee',
    text: 'I am so inspired by this! Going to try it this weekend with my daughter. Much love from Canada ❤️',
    publishedAt: new Date(Date.now() - 3600_000 * 48).toISOString(),
  },
  {
    id: 'sample-8',
    authorName: 'Rob T.',
    text: 'Why do you keep changing the schedule without telling your subscribers? Super frustrating.',
    publishedAt: new Date(Date.now() - 3600_000 * 60).toISOString(),
  },
  {
    id: 'sample-9',
    authorName: 'DevPioneer',
    text: 'Can you please make a follow-up video showing how to deploy this with Docker and CI/CD? That would be super helpful!',
    publishedAt: new Date(Date.now() - 3600_000 * 72).toISOString(),
  },
  {
    id: 'sample-10',
    authorName: 'Chloe Bennet',
    text: 'Could you make a video on the top beginner mistakes and how to fix them? Would love to see that!',
    publishedAt: new Date(Date.now() - 3600_000 * 84).toISOString(),
  },
];

function extractJson(raw: string): any {
  const trimmed = raw.trim();
  const withoutMarkdown = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutMarkdown);
  } catch {
    const start = withoutMarkdown.indexOf('{');
    const end = withoutMarkdown.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(withoutMarkdown.substring(start, end + 1));
    }
    const arrStart = withoutMarkdown.indexOf('[');
    const arrEnd = withoutMarkdown.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      return JSON.parse(withoutMarkdown.substring(arrStart, arrEnd + 1));
    }
    throw new Error('No valid JSON block found in AI response');
  }
}

function normalizeFormat(f?: string): VideoSuggestionDto['suggestedFormat'] {
  const s = String(f || '').toLowerCase();
  if (s.includes('troubleshoot') || s.includes('mistake') || s.includes('fix')) return 'Troubleshooting Guide';
  if (s.includes('short') || s.includes('reel') || s.includes('quick')) return 'Shorts / Quick Tip';
  if (s.includes('deep') || s.includes('masterclass')) return 'Deep Dive';
  if (s.includes('q&a') || s.includes('faq') || s.includes('question')) return 'Q&A / FAQ';
  if (s.includes('compar') || s.includes('vs')) return 'Comparison';
  return 'Tutorial';
}

function normalizeDemand(d?: string): VideoSuggestionDto['demandLevel'] {
  const s = String(d || '').toLowerCase();
  if (s.includes('high') || s.includes('urgent') || s.includes('viral')) return 'High';
  if (s.includes('trend') || s.includes('hot')) return 'Trending';
  return 'Medium';
}

function normalizeEmotion(e?: string): 'happy' | 'excited' | 'angry' | 'sad' | 'question' | 'neutral' {
  const s = String(e || '').toLowerCase();
  if (s.includes('happy') || s.includes('love') || s.includes('positive') || s.includes('praise')) return 'happy';
  if (s.includes('excit') || s.includes('hype') || s.includes('fire')) return 'excited';
  if (s.includes('angr') || s.includes('critic') || s.includes('hate') || s.includes('frustrat') || s.includes('bad')) return 'angry';
  if (s.includes('sad') || s.includes('disappoint') || s.includes('defeat') || s.includes('cry')) return 'sad';
  if (s.includes('question') || s.includes('inquir') || s.includes('curious') || s.includes('ask')) return 'question';
  return 'neutral';
}

function emotionEmoji(e?: string): string {
  const norm = normalizeEmotion(e);
  switch (norm) {
    case 'happy': return '😊';
    case 'excited': return '🤩';
    case 'angry': return '😡';
    case 'sad': return '😢';
    case 'question': return '❓';
    default: return '😐';
  }
}

function fallbackClassify(text: string): { emotion: 'happy' | 'excited' | 'angry' | 'sad' | 'question' | 'neutral'; emoji: string; reason: string } {
  const lower = text.toLowerCase();
  if (lower.includes('?') || lower.includes('how ') || lower.includes('where ') || lower.includes('what ') || lower.includes('can you') || lower.includes('link') || lower.includes('could you')) {
    return { emotion: 'question', emoji: '❓', reason: 'Asking for advice, tools, or follow-up details' };
  }
  if (lower.includes('terrible') || lower.includes('waste') || lower.includes('awful') || lower.includes('worst') || lower.includes('hate') || lower.includes('frustrat') || lower.includes('annoy')) {
    return { emotion: 'angry', emoji: '😡', reason: 'Critical or dissatisfied with pacing or details' };
  }
  if (lower.includes('sad') || lower.includes('failed') || lower.includes('crying') || lower.includes('defeat') || lower.includes('tear') || lower.includes('fell') || lower.includes('😢') || lower.includes('😭')) {
    return { emotion: 'sad', emoji: '😢', reason: 'Struggling with execution or project failure' };
  }
  if (lower.includes('omg') || lower.includes('hyped') || lower.includes('blown away') || lower.includes('fire') || lower.includes('🔥') || lower.includes('wait')) {
    return { emotion: 'excited', emoji: '🤩', reason: 'Enthusiastic and eager anticipation' };
  }
  if (lower.includes('love') || lower.includes('amazing') || lower.includes('great') || lower.includes('thank') || lower.includes('beautiful') || lower.includes('😍') || lower.includes('❤️')) {
    return { emotion: 'happy', emoji: '😊', reason: 'Praising the creator and enjoying the content' };
  }
  return { emotion: 'neutral', emoji: '😐', reason: 'Observational or constructive comment' };
}

function generateFallbackVideoSuggestions(
  comments: Array<{ authorName?: string; text: string }>,
  videoContext?: { title?: string },
): VideoSuggestionDto[] {
  const suggestions: VideoSuggestionDto[] = [];
  const baseTitle = videoContext?.title || 'Your Content';

  const toolQuestions = comments.filter((c) => {
    const l = c.text.toLowerCase();
    return l.includes('tool') || l.includes('link') || l.includes('color') || l.includes('buy') || l.includes('set') || l.includes('where');
  });

  if (toolQuestions.length > 0) {
    const fanQuotes = toolQuestions.slice(0, 2).map((c) => `${c.authorName || 'Viewer'}: "${c.text}"`);
    suggestions.push({
      id: 'sug-tools',
      title: `The Exact Tools, Materials & Color Palette Breakdown for ${baseTitle}`,
      hook: 'Viewers keep asking in the comments where to get the tools: here is the complete, unfiltered inventory and setup guide.',
      reason: 'Multiple fans specifically asked for exact product links, equipment lists, and color palettes used in the video.',
      fanRequests: fanQuotes,
      suggestedFormat: 'Tutorial',
      demandLevel: 'High',
      outline: [
        'Complete hardware & tools inventory list with purchase links',
        'Color palette hex codes, swatches, and material choices',
        'Budget-friendly alternatives for beginners',
        'Pro maintenance and setup calibration tips',
      ],
    });
  }

  const struggleComments = comments.filter((c) => {
    const l = c.text.toLowerCase();
    return l.includes('tear') || l.includes('fell') || l.includes('fail') || l.includes('skip') || l.includes('sad') || l.includes('defeat') || l.includes('mistake');
  });

  if (struggleComments.length > 0) {
    const fanQuotes = struggleComments.slice(0, 2).map((c) => `${c.authorName || 'Viewer'}: "${c.text}"`);
    suggestions.push({
      id: 'sug-troubleshoot',
      title: `Top 5 Mistakes That Ruin Your Build (And How to Fix Them Step-by-Step)`,
      hook: 'Did your project fall apart or fail on your first try? You are not alone! Here is the breakdown of why it happens and how to easily fix it.',
      reason: 'Viewers in the comments experienced project failures, structural tearing, or missed critical steps.',
      fanRequests: fanQuotes,
      suggestedFormat: 'Troubleshooting Guide',
      demandLevel: 'High',
      outline: [
        'Diagnosing why structural failures and tearing happen',
        'Re-visiting the most commonly skipped or rushed steps in detail',
        'Live demonstration: how to salvage a damaged or failed build',
        'Foolproof checklist before finishing',
      ],
    });
  }

  const followUpComments = comments.filter((c) => {
    const l = c.text.toLowerCase();
    return l.includes('part 2') || l.includes('follow') || l.includes('deploy') || l.includes('docker') || l.includes('advanced') || l.includes('next');
  });

  if (followUpComments.length > 0) {
    const fanQuotes = followUpComments.slice(0, 2).map((c) => `${c.authorName || 'Viewer'}: "${c.text}"`);
    suggestions.push({
      id: 'sug-followup',
      title: `Advanced Masterclass: Taking ${baseTitle} to Production (Part 2)`,
      hook: 'You loved the first part! Now let us take this concept into full production with advanced optimizations and workflow secrets.',
      reason: 'Fans directly asked for a part 2 tutorial exploring advanced configuration, performance, and deployment.',
      fanRequests: fanQuotes,
      suggestedFormat: 'Deep Dive',
      demandLevel: 'High',
      outline: [
        'Quick recap of core fundamentals from video 1',
        'Advanced configuration & architectural patterns',
        'Production deployment, automation, and CI/CD pipelines',
        'Viewer Q&A addressing top questions from the first video',
      ],
    });
  } else {
    suggestions.push({
      id: 'sug-qa',
      title: `Viewer Q&A: Answering Your Top Questions & Community Showcase`,
      hook: 'Going through the top comments, ideas, and questions from our community to give direct answers and tips.',
      reason: 'Enthusiastic audience engagement and questions requiring dedicated explanations.',
      fanRequests: comments.slice(0, 2).map((c) => `${c.authorName || 'Viewer'}: "${c.text}"`),
      suggestedFormat: 'Q&A / FAQ',
      demandLevel: 'Medium',
      outline: [
        'Top 3 community questions answered in depth',
        'Creator tips you will not find in the official documentation',
        'Community spotlight: viewer builds and experiments',
        'Sneak peek at upcoming channel projects',
      ],
    });
  }

  return suggestions;
}

function generateFallbackHooks(text: string, count = 5) {
  const clean = text.replace(/^[#\s]+/, '').slice(0, 80);
  const templates = [
    {
      id: 'h-1',
      style: 'Curiosity Gap',
      text: `Most people get ${clean} completely wrong. Here is the framework that actually works:`,
      whyItWorks: 'Challenges common assumptions to provoke instant curiosity.',
    },
    {
      id: 'h-2',
      style: 'Contrarian / Hot Take',
      text: `Unpopular opinion: Stop overcomplicating ${clean}. You only need these 3 simple rules:`,
      whyItWorks: 'Positions the creator as an authentic authority with a contrarian angle.',
    },
    {
      id: 'h-3',
      style: 'Actionable / Quick Win',
      text: `If I had to start from scratch with ${clean}, here is exactly what I would do in week 1:`,
      whyItWorks: 'High-value blueprint promise drives bookmarks and shares.',
    },
    {
      id: 'h-4',
      style: 'Story / Transformation',
      text: `6 months ago I was stuck on ${clean}. Here is the one shift that changed everything:`,
      whyItWorks: 'Emotional transformation creates high reader empathy and retention.',
    },
    {
      id: 'h-5',
      style: 'High-Stakes / FOMO',
      text: `The biggest mistake I see creators make with ${clean} (and how to avoid it today):`,
      whyItWorks: 'Fear of making avoidable mistakes compels readers to stop scrolling.',
    },
  ];
  return templates.slice(0, count);
}


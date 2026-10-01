import { z } from 'zod';
import { isValidTimeZone } from './time';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password is too long');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
    xPremium: z.boolean(),
    brandVoice: z.string().max(1000).nullable(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateAiSettingsSchema = z.object({
  provider: z.string().trim().min(1).max(50).nullable().optional(),
  baseUrl: z.string().trim().nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  defaultModel: z.string().trim().max(100).nullable().optional(),
  apiKey: z.string().trim().max(500).optional(),
});
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;

export const aiHashtagsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  platform: z.string().optional(),
  count: z.number().int().min(1).max(30).optional(),
});
export type AiHashtagsInput = z.infer<typeof aiHashtagsSchema>;

export const aiPostIdeasSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  platform: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
});
export type AiPostIdeasInput = z.infer<typeof aiPostIdeasSchema>;

export const aiHooksSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  count: z.number().int().min(1).max(10).optional(),
});
export type AiHooksInput = z.infer<typeof aiHooksSchema>;

export interface AiProviderConfig {
  id: string;
  name: string;
  defaultBaseUrl: string;
  models: string[];
  defaultModel: string;
  keyPlaceholder: string;
  description: string;
}

export const DEFAULT_AI_PROVIDER = 'nvidia';
export const DEFAULT_AI_MODEL = 'meta/llama-3.2-11b-vision-instruct';

export const AI_PROVIDERS: Record<string, AiProviderConfig> = {
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM (Default)',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      'meta/llama-3.2-11b-vision-instruct',
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-large-2-instruct',
      'qwen/qwen2.5-72b-instruct',
    ],
    defaultModel: 'meta/llama-3.2-11b-vision-instruct',
    keyPlaceholder: 'nvapi-... (Default loaded from .env)',
    description: 'High-speed NVIDIA NIM cloud inference engine (Default from .env).',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-proj-...',
    description: 'Industry-standard GPT models with high reliability and reasoning.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-api03-...',
    description: 'High-intelligence Claude models for nuanced copy and storytelling.',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
    keyPlaceholder: 'AIzaSy...',
    description: 'Fast, high-context reasoning from Google DeepMind.',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    description: 'Ultra-fast LPU inference for open weights models.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    defaultModel: 'openai/gpt-4o-mini',
    keyPlaceholder: 'sk-or-v1-...',
    description: 'Unified gateway to 100+ models with pay-as-you-go pricing.',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'deepseek-r1', 'qwen2.5'],
    defaultModel: 'llama3.2',
    keyPlaceholder: 'Optional (e.g. ollama)',
    description: 'Run open LLMs locally on your own machine with zero cloud fees.',
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI-Compatible)',
    defaultBaseUrl: 'https://your-endpoint/v1',
    models: ['custom-model'],
    defaultModel: 'custom-model',
    keyPlaceholder: 'Your custom API key',
    description: 'Connect any OpenAI-compatible proxy, vLLM, or self-hosted endpoint.',
  },
};

export interface UserDto {
  id: string;
  email: string;
  name: string;
  timezone: string;
  xPremium: boolean;
  brandVoice: string | null;
  aiProvider?: string | null;
  aiBaseUrl?: string | null;
  aiModel?: string | null;
  aiDefaultModel?: string | null;
  aiApiKeyMasked?: string | null;
  hasAiApiKey?: boolean;
  isEnvDefaultKey?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

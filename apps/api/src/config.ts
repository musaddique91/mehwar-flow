import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  /** Browser origin(s) allowed to call the API with credentials, comma separated. */
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Max login/register attempts per IP per minute. */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Versioned AES-256 master keys: "1:<base64 32 bytes>,2:<base64 32 bytes>". */
  MASTER_KEYS: z.string().min(1),
  MASTER_KEY_CURRENT_VERSION: z.coerce.number().int().positive().default(1),
  /** Path of the refresh cookie as seen by the browser ("/api/auth" when proxied by the web app). */
  REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/auth'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type AppConfig = z.infer<typeof envSchema> & { cookieSecure: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return {
    ...parsed.data,
    cookieSecure: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

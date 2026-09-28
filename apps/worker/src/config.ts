import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  MASTER_KEYS: z.string().min(1),
  MASTER_KEY_CURRENT_VERSION: z.coerce.number().int().positive().default(1),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  /** e.g. smtp://mailpit:1025 — failure emails are skipped when unset. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Mehwar Flow <no-reply@mehwar.local>'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  PUBLISH_CONCURRENCY: z.coerce.number().int().positive().default(5),
  TOKEN_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60_000),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid worker configuration:\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return parsed.data;
}

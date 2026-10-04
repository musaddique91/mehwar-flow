import { INestApplication, type ModuleMetadata } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { mountQueueDashboard } from './admin/queues-dashboard';
import { AppModule } from './app.module';
import type { AppConfig } from './config';

/** Secrets that must never reach the logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.query.code',
  'req.query.state',
];

export function configureApp(app: NestExpressApplication, config: AppConfig) {
  app.set('trust proxy', 1);
  if (config.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: { paths: REDACT, censor: '[redacted]' },
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/events' },
        transport:
          config.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      }),
    );
  }
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  const configuredOrigins = config.WEB_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (configuredOrigins.includes(cleanOrigin)) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, true);
      }
      const originHost = cleanOrigin.replace(/^https?:\/\//, '');
      if (configuredOrigins.some((co) => co.replace(/^https?:\/\//, '') === originHost)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });
  app.useBodyParser('json', { limit: '5mb' });
  mountQueueDashboard(app, config);
  app.enableShutdownHooks();
  return app;
}

export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: config.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
    // Stripe webhooks need the exact raw body to verify signatures.
    rawBody: true,
  });
  return configureApp(app, config);
}

/** Test helper: same app with providers swapped for fakes. */
export async function createTestApp(
  config: AppConfig,
  overrides: { provide: unknown; useValue: unknown }[] = [],
  extra: Pick<ModuleMetadata, 'providers'> = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule.forRoot(config)], ...extra });
  for (const o of overrides) builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
    logger: false,
  });
  return configureApp(app, config);
}

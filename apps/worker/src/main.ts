import { Queue, UnrecoverableError, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ConnectorRegistry } from '@mehwar/connectors';
import { PrismaClient, TokenVault } from '@mehwar/db';
import {
  MAINTENANCE_JOBS,
  QUEUES,
  type MediaJob,
  type PublishJob,
  type TokenRefreshJob,
} from '@mehwar/shared';
import { Storage, storageConfigFromEnv } from '@mehwar/storage';
import { loadConfig } from './config';
import type { WorkerDeps } from './deps';
import { processMedia } from './jobs/media';
import { collectMetrics } from './jobs/metrics';
import { publishTarget } from './jobs/publish';
import { findDueTargets } from './jobs/schedule-sweep';
import { findCredentialsDueForRefresh, refreshChannelToken } from './jobs/token-refresh';
import { DefaultNotifier } from './notifier';

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }));
}

async function main() {
  const config = loadConfig();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  await prisma.$connect();

  const storageConfig = storageConfigFromEnv();
  const deps: WorkerDeps = {
    prisma,
    vault: TokenVault.fromEnv(prisma, config.MASTER_KEYS, config.MASTER_KEY_CURRENT_VERSION),
    storage: storageConfig ? new Storage(storageConfig) : null,
    connectors: ConnectorRegistry.fromEnv(),
    redis: connection,
    notifier: new DefaultNotifier(prisma, connection, {
      smtp: config.SMTP_HOST
        ? {
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_SECURE ? config.SMTP_SECURE === 'true' : config.SMTP_PORT === 465,
            auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
          }
        : config.SMTP_URL,
      from: config.MAIL_FROM,
      webOrigin: config.WEB_ORIGIN,
    }),
    log,
  };
  log('connectors enabled', { platforms: deps.connectors.available() });

  const publishQueue = new Queue<PublishJob>(QUEUES.publish, { connection });
  const tokensQueue = new Queue<TokenRefreshJob>(QUEUES.tokens, { connection });
  const maintenance = new Queue(QUEUES.maintenance, { connection });

  // Repeatable jobs are keyed by id, so restarting the worker does not duplicate them.
  await maintenance.upsertJobScheduler(MAINTENANCE_JOBS.tokenRefreshScan, {
    every: config.TOKEN_REFRESH_INTERVAL_MS,
  });
  await maintenance.upsertJobScheduler(MAINTENANCE_JOBS.scheduleSweep, { pattern: '* * * * *' });
  await maintenance.upsertJobScheduler(MAINTENANCE_JOBS.metrics, { pattern: '17 3 * * *' });

  const workers = [
    new Worker<PublishJob>(
      QUEUES.publish,
      async (job) => {
        const outcome = await publishTarget(deps, job.data, {
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? 1,
        });
        if (outcome === 'retry') throw new Error('Temporary failure; will retry');
        return outcome;
      },
      { connection, concurrency: config.PUBLISH_CONCURRENCY },
    ),

    new Worker<MediaJob>(
      QUEUES.media,
      (job) =>
        processMedia(
          deps,
          { ffmpegPath: config.FFMPEG_PATH, ffprobePath: config.FFPROBE_PATH },
          job.data,
        ),
      { connection, concurrency: 2 },
    ),

    new Worker<TokenRefreshJob>(
      QUEUES.tokens,
      async (job) => {
        try {
          await refreshChannelToken(deps, job.data.organizationId, job.data.channelId);
        } catch (err) {
          if ((err as Error).name === 'AuthError')
            throw new UnrecoverableError((err as Error).message);
          throw err;
        }
      },
      { connection, concurrency: 5 },
    ),

    new Worker(
      QUEUES.maintenance,
      async (job) => {
        switch (job.name) {
          case MAINTENANCE_JOBS.tokenRefreshScan: {
            const due = await findCredentialsDueForRefresh(prisma);
            const bucket = Math.floor(Date.now() / config.TOKEN_REFRESH_INTERVAL_MS);
            for (const c of due) {
              if (!deps.connectors.has(c.channel.platform)) continue;
              await tokensQueue.add(
                'refresh',
                { organizationId: c.organizationId, channelId: c.channelId },
                {
                  jobId: `${c.channelId}-${bucket}`,
                  attempts: 3,
                  backoff: { type: 'exponential', delay: 30_000 },
                  removeOnComplete: 100,
                  removeOnFail: 500,
                },
              );
            }
            return { due: due.length };
          }
          case MAINTENANCE_JOBS.scheduleSweep: {
            const due = await findDueTargets(prisma);
            let requeued = 0;
            for (const t of due) {
              if (await publishQueue.getJob(t.id)) continue;
              await publishQueue.add(
                'publish',
                { organizationId: t.organizationId, postTargetId: t.id },
                { jobId: t.id, attempts: 5, backoff: { type: 'exponential', delay: 60_000 } },
              );
              requeued++;
            }
            return { due: due.length, requeued };
          }
          case MAINTENANCE_JOBS.metrics:
            return collectMetrics(deps);
          default:
            throw new Error(`Unknown maintenance job ${job.name}`);
        }
      },
      { connection, concurrency: 1 },
    ),
  ];

  for (const w of workers) {
    w.on('failed', (job, err) =>
      log('job failed', {
        queue: w.name,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: err.message,
      }),
    );
    w.on('error', (err) => log('worker error', { queue: w.name, error: err.message }));
  }
  log('Mehwar Flow worker started');

  const shutdown = async () => {
    log('shutting down');
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([publishQueue.close(), tokensQueue.close(), maintenance.close()]);
    await prisma.$disconnect();
    connection.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

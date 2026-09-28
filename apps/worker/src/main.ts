import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@mehwar/db';
import { loadConfig } from './config';
import { findDueTargets } from './jobs/schedule-sweep';
import { findCredentialsDueForRefresh } from './jobs/token-refresh';
import { MAINTENANCE_JOBS, QUEUES } from './queues';

async function main() {
  const config = loadConfig();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  await prisma.$connect();

  const maintenance = new Queue(QUEUES.maintenance, { connection });
  // Repeatable jobs are keyed by name + pattern, so restarting the worker does not duplicate them.
  await maintenance.upsertJobScheduler(MAINTENANCE_JOBS.tokenRefreshScan, {
    every: config.TOKEN_REFRESH_INTERVAL_MS,
  });
  await maintenance.upsertJobScheduler(MAINTENANCE_JOBS.scheduleSweep, { pattern: '* * * * *' });

  const worker = new Worker(
    QUEUES.maintenance,
    async (job) => {
      switch (job.name) {
        case MAINTENANCE_JOBS.tokenRefreshScan: {
          const due = await findCredentialsDueForRefresh(prisma);
          // Phase 2: enqueue a per-channel refresh job handled by the platform connector.
          return { due: due.length };
        }
        case MAINTENANCE_JOBS.scheduleSweep: {
          const due = await findDueTargets(prisma);
          // Phase 2: enqueue publish jobs (jobId = post target id, so re-enqueueing is idempotent).
          return { due: due.length };
        }
        default:
          throw new Error(`Unknown maintenance job ${job.name}`);
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('completed', (job, result) => {
    if (result && (result as { due: number }).due > 0) console.log(`[${job.name}]`, result);
  });
  worker.on('failed', (job, err) => console.error(`[${job?.name}] failed:`, err.message));
  console.log('Mehwar Flow worker started');

  const shutdown = async () => {
    await worker.close();
    await maintenance.close();
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

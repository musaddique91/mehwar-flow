import { withSystemTransaction, type PrismaClient } from '@mehwar/db';

/**
 * Safety net for the scheduler: publish jobs are BullMQ delayed jobs, but if Redis lost them
 * (restart without persistence, eviction) this finds due targets still waiting in the database.
 * Re-enqueueing is idempotent because the job id is the target id.
 */
export async function findDueTargets(prisma: PrismaClient, now = new Date()) {
  return withSystemTransaction(prisma, (tx) =>
    tx.postTarget.findMany({
      where: { status: 'QUEUED', scheduledAt: { lte: new Date(now.getTime() - 60_000) } },
      select: { id: true, organizationId: true, scheduledAt: true },
      take: 500,
      orderBy: { scheduledAt: 'asc' },
    }),
  );
}

import { PrismaClient, withSystemTransaction } from '@mehwar/db';

/**
 * Safety net for the scheduler: publish jobs are enqueued as BullMQ delayed jobs, but if Redis
 * lost them (restart, eviction) this sweep finds due targets still waiting in the database.
 */
export async function findDueTargets(prisma: PrismaClient, now = new Date()) {
  return withSystemTransaction(prisma, (tx) =>
    tx.postTarget.findMany({
      where: { status: { in: ['PENDING', 'QUEUED'] }, scheduledAt: { lte: now } },
      select: { id: true, organizationId: true, scheduledAt: true },
      take: 500,
      orderBy: { scheduledAt: 'asc' },
    }),
  );
}

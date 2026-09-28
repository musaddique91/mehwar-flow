import { Prisma, PrismaClient } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Prisma client whose every query is scoped to one organization via Postgres RLS. */
export type TenantClient = ReturnType<typeof forTenant>;

/**
 * Returns a client bound to `organizationId`. Each operation runs in a short transaction that
 * first sets `app.current_org_id`, so RLS policies only expose that organization's rows.
 *
 * Note: do not call `$transaction` on the returned client; use `withTenantTransaction` instead.
 */
export function forTenant(prisma: PrismaClient, organizationId: string) {
  if (!UUID_RE.test(organizationId)) throw new Error('Invalid organization id');
  return prisma.$extends({
    name: 'tenant-rls',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/** Runs an interactive transaction scoped to one organization. */
export function withTenantTransaction<T>(
  prisma: PrismaClient,
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(organizationId)) throw new Error('Invalid organization id');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return fn(tx);
  });
}

/**
 * Runs a transaction that bypasses tenant RLS. Only for trusted system paths: sign-up (creating a
 * new organization), background workers that scan all tenants, and admin tooling.
 */
export function withSystemTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    return fn(tx);
  });
}

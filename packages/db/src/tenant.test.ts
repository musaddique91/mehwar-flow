import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { forTenant, withSystemTransaction, withTenantTransaction } from './tenant';

// Requires a migrated database; DATABASE_URL must point at the unprivileged runtime role.
const prisma = new PrismaClient();

async function createOrg(label: string) {
  return withSystemTransaction(prisma, async (tx) => {
    const user = await tx.user.create({
      data: { email: `${label}-${randomUUID()}@test.local`, passwordHash: 'x', name: label },
    });
    const org = await tx.organization.create({
      data: { name: label, ownerId: user.id, wrappedDataKey: 'test', dataKeyVersion: 1 },
    });
    await tx.channel.create({
      data: {
        organizationId: org.id,
        platform: 'x',
        externalId: randomUUID(),
        displayName: `${label} channel`,
      },
    });
    return org;
  });
}

describe('row-level security', () => {
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    orgA = await createOrg('a');
    orgB = await createOrg('b');
  });

  afterAll(async () => {
    await withSystemTransaction(prisma, (tx) =>
      tx.user.deleteMany({ where: { organization: { id: { in: [orgA.id, orgB.id] } } } }),
    );
    await prisma.$disconnect();
  });

  it('hides every tenant row when no organization is set', async () => {
    expect(await prisma.channel.count()).toBe(0);
    expect(await prisma.organization.count()).toBe(0);
  });

  it('only exposes the current organization rows, even without a WHERE clause', async () => {
    const a = forTenant(prisma, orgA.id);
    const channels = await a.channel.findMany();
    expect(channels.length).toBe(1);
    expect(channels.every((c) => c.organizationId === orgA.id)).toBe(true);
    expect(await a.channel.findMany({ where: { organizationId: orgB.id } })).toEqual([]);
    expect(await a.organization.findUnique({ where: { id: orgB.id } })).toBeNull();
  });

  it('blocks writes into another organization', async () => {
    const a = forTenant(prisma, orgA.id);
    await expect(
      a.channel.create({
        data: {
          organizationId: orgB.id,
          platform: 'x',
          externalId: randomUUID(),
          displayName: 'evil',
        },
      }),
    ).rejects.toThrow();
    const updated = await a.channel.updateMany({
      where: { organizationId: orgB.id },
      data: { displayName: 'hijacked' },
    });
    expect(updated.count).toBe(0);
  });

  it('scopes interactive transactions too', async () => {
    const count = await withTenantTransaction(prisma, orgB.id, (tx) => tx.channel.count());
    expect(count).toBe(1);
  });
});

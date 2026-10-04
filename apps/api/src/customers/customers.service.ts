import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateCustomerInput,
  CreateGroupInput,
  CustomerDto,
  CustomerGroupDto,
  UpdateCustomerInput,
  UpdateGroupInput,
} from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(organizationId: string, query?: string): Promise<CustomerDto[]> {
    const db = this.prisma.tenant(organizationId);
    const q = query?.trim().toLowerCase();

    const customers = await db.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { mobileNumber: { contains: q } },
              { whatsappNumber: { contains: q } },
            ],
          }
        : undefined,
      include: {
        groupMembers: {
          include: {
            group: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      mobileNumber: c.mobileNumber,
      whatsappNumber: c.whatsappNumber,
      email: c.email,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      groups: c.groupMembers.map((gm) => ({
        id: gm.group.id,
        name: gm.group.name,
      })),
    }));
  }

  async createCustomer(organizationId: string, input: CreateCustomerInput): Promise<CustomerDto> {
    const db = this.prisma.tenant(organizationId);
    const whatsapp = input.whatsappNumber?.trim() || input.mobileNumber.trim();

    const customer = await db.customer.create({
      data: {
        organizationId,
        name: input.name.trim(),
        mobileNumber: input.mobileNumber.trim(),
        whatsappNumber: whatsapp,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return {
      id: customer.id,
      name: customer.name,
      mobileNumber: customer.mobileNumber,
      whatsappNumber: customer.whatsappNumber,
      email: customer.email,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      groups: [],
    };
  }

  async updateCustomer(
    organizationId: string,
    id: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Customer not found');

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.mobileNumber !== undefined && { mobileNumber: input.mobileNumber.trim() }),
        ...(input.whatsappNumber !== undefined && {
          whatsappNumber: input.whatsappNumber.trim() || existing.mobileNumber,
        }),
        ...(input.email !== undefined && { email: input.email?.trim() || null }),
        ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
      },
      include: {
        groupMembers: {
          include: {
            group: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      id: customer.id,
      name: customer.name,
      mobileNumber: customer.mobileNumber,
      whatsappNumber: customer.whatsappNumber,
      email: customer.email,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      groups: customer.groupMembers.map((gm) => ({
        id: gm.group.id,
        name: gm.group.name,
      })),
    };
  }

  async deleteCustomer(organizationId: string, id: string): Promise<void> {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Customer not found');
    await db.customer.delete({ where: { id } });
  }

  // ---------- Groups ----------

  async listGroups(organizationId: string): Promise<CustomerGroupDto[]> {
    const db = this.prisma.tenant(organizationId);
    const groups = await db.customerGroup.findMany({
      include: {
        members: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                mobileNumber: true,
                whatsappNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      memberCount: g.members.length,
      members: g.members.map((m) => ({
        id: m.id,
        customerId: m.customerId,
        customer: m.customer,
      })),
    }));
  }

  async createGroup(organizationId: string, input: CreateGroupInput): Promise<CustomerGroupDto> {
    const db = this.prisma.tenant(organizationId);

    const group = await db.customerGroup.create({
      data: {
        organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        ...(input.customerIds && input.customerIds.length > 0
          ? {
              members: {
                create: input.customerIds.map((cid) => ({ customerId: cid })),
              },
            }
          : {}),
      },
      include: {
        members: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                mobileNumber: true,
                whatsappNumber: true,
              },
            },
          },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberCount: group.members.length,
      members: group.members.map((m) => ({
        id: m.id,
        customerId: m.customerId,
        customer: m.customer,
      })),
    };
  }

  async updateGroup(
    organizationId: string,
    id: string,
    input: UpdateGroupInput,
  ): Promise<CustomerGroupDto> {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.customerGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Group not found');

    if (input.customerIds !== undefined) {
      await db.customerGroupMember.deleteMany({ where: { groupId: id } });
      if (input.customerIds.length > 0) {
        await db.customerGroupMember.createMany({
          data: input.customerIds.map((cid) => ({ groupId: id, customerId: cid })),
        });
      }
    }

    const group = await db.customerGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
      },
      include: {
        members: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                mobileNumber: true,
                whatsappNumber: true,
              },
            },
          },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberCount: group.members.length,
      members: group.members.map((m) => ({
        id: m.id,
        customerId: m.customerId,
        customer: m.customer,
      })),
    };
  }

  async deleteGroup(organizationId: string, id: string): Promise<void> {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.customerGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Group not found');
    await db.customerGroup.delete({ where: { id } });
  }
}

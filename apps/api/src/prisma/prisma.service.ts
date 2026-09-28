import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { forTenant, PrismaClient, type TenantClient } from '@mehwar/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Client scoped to one organization through Postgres RLS. Use this for all tenant data. */
  tenant(organizationId: string): TenantClient {
    return forTenant(this, organizationId);
  }
}

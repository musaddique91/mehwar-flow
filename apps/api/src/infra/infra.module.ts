import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { ConnectorRegistry } from '@mehwar/connectors';
import { TokenVault } from '@mehwar/db';
import { Storage, storageConfigFromEnv } from '@mehwar/storage';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { QueuesService } from './queues.service';
import { CONNECTORS, REDIS, STORAGE } from './tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false }),
    },
    {
      provide: STORAGE,
      useFactory: () => {
        const cfg = storageConfigFromEnv();
        return cfg ? new Storage(cfg) : null;
      },
    },
    { provide: CONNECTORS, useFactory: () => ConnectorRegistry.fromEnv() },
    {
      provide: TokenVault,
      inject: [PrismaService, APP_CONFIG],
      useFactory: (prisma: PrismaService, config: AppConfig) =>
        TokenVault.fromEnv(prisma, config.MASTER_KEYS, config.MASTER_KEY_CURRENT_VERSION),
    },
    QueuesService,
    EventsService,
  ],
  exports: [REDIS, STORAGE, CONNECTORS, TokenVault, QueuesService, EventsService],
})
export class InfraModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: IORedis) {}

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}

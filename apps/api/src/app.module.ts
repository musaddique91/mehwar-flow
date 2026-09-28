import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ChannelsController } from './channels/channels.controller';
import { APP_CONFIG, type AppConfig } from './config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersController } from './users/users.controller';
import { VaultModule } from './vault/vault.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        {
          module: ConfigHolder,
          global: true,
          providers: [{ provide: APP_CONFIG, useValue: config }],
          exports: [APP_CONFIG],
        },
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
        PrismaModule,
        VaultModule,
        AuthModule,
      ],
      controllers: [HealthController, UsersController, ChannelsController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}

@Module({})
class ConfigHolder {}

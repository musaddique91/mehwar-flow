import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountController } from './account/account.controller';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuthModule } from './auth/auth.module';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { EntitlementsService } from './billing/entitlements.service';
import { ChannelsController } from './channels/channels.controller';
import { ChannelsService } from './channels/channels.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { APP_CONFIG, type AppConfig } from './config';
import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { MediaController } from './media/media.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersController } from './users/users.controller';
import { VaultModule } from './vault/vault.module';

@Module({})
class ConfigHolder {}

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
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
        PrismaModule,
        InfraModule,
        VaultModule,
        AuthModule,
      ],
      controllers: [
        HealthController,
        UsersController,
        AccountController,
        ChannelsController,
        MediaController,
        PostsController,
        NotificationsController,
        AnalyticsController,
        AiController,
        BillingController,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        EntitlementsService,
        NotificationsService,
        ChannelsService,
        PostsService,
        AnalyticsService,
        AiService,
        BillingService,
      ],
    };
  }
}

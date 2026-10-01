import { Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { AnalyticsService } from './analytics.service';

const days = (range?: string) => Math.min(Math.max(Number(range) || 30, 1), 365);

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentAuth() auth: AuthContext, @Query('days') range?: string) {
    return this.analytics.summary(auth.organizationId, days(range));
  }

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentAuth() auth: AuthContext, @Query('days') range?: string) {
    return this.analytics.sync(auth.organizationId, days(range));
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mehwar-analytics.csv"')
  export(@CurrentAuth() auth: AuthContext, @Query('days') range?: string) {
    return this.analytics.exportCsv(auth.organizationId, days(range));
  }
}

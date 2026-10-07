import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  type UpdateSchedulerConfigDto,
  type UpdateOrderInquiryDto,
} from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { AutomationService } from './automation.service';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('overview')
  getOverview(@CurrentAuth() auth: AuthContext) {
    return this.automation.getOverview(auth.organizationId);
  }

  @Get('schedulers')
  getSchedulers(@CurrentAuth() auth: AuthContext) {
    return this.automation.getSchedulers(auth.organizationId);
  }

  @Patch('schedulers/:id')
  updateScheduler(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateSchedulerConfigDto,
  ) {
    return this.automation.updateScheduler(auth.organizationId, id, dto);
  }

  @Post('schedulers/:id/run')
  runScheduler(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ) {
    return this.automation.runScheduler(auth.organizationId, id, auth.userId);
  }

  @Get('runs')
  getRuns(
    @CurrentAuth() auth: AuthContext,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.automation.getRuns(auth.organizationId, lim);
  }

  @Get('leads')
  getLeads(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    return this.automation.getLeads(auth.organizationId, status);
  }

  @Patch('leads/:id')
  updateLead(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateOrderInquiryDto,
  ) {
    return this.automation.updateLead(auth.organizationId, id, dto);
  }
}

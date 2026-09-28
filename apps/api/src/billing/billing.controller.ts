import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { PAID_PLANS } from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth, Public } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { BillingService } from './billing.service';

const checkoutSchema = z.object({ plan: z.enum(PAID_PLANS) });

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@CurrentAuth() auth: AuthContext) {
    return this.billing.overview(auth.organizationId);
  }

  @Post('checkout')
  checkout(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.billing.checkout(auth.organizationId, body.plan);
  }

  @Post('portal')
  portal(@CurrentAuth() auth: AuthContext) {
    return this.billing.portal(auth.organizationId);
  }

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}

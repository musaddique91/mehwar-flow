import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { withSystemTransaction } from '@mehwar/db';
import { PAID_PLANS, PLANS, type PlanId } from '@mehwar/shared';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {
    this.stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;
  }

  private requireStripe(): Stripe {
    if (!this.stripe)
      throw new ServiceUnavailableException('Billing is not configured on this server');
    return this.stripe;
  }

  private priceFor(plan: (typeof PAID_PLANS)[number]): string {
    const price = plan === 'pro' ? this.config.STRIPE_PRICE_PRO : this.config.STRIPE_PRICE_BUSINESS;
    if (!price)
      throw new ServiceUnavailableException(`No Stripe price configured for the ${plan} plan`);
    return price;
  }

  private planForPrice(priceId: string | undefined): PlanId {
    if (priceId && priceId === this.config.STRIPE_PRICE_PRO) return 'pro';
    if (priceId && priceId === this.config.STRIPE_PRICE_BUSINESS) return 'business';
    return 'free';
  }

  private get returnUrl() {
    return `${this.config.WEB_ORIGIN.split(',')[0]!.trim()}/settings?tab=billing`;
  }

  async overview(organizationId: string) {
    const [plan, usage] = await Promise.all([
      this.entitlements.planOf(organizationId),
      this.entitlements.usage(organizationId),
    ]);
    return {
      billingEnabled: this.entitlements.billingEnabled,
      plan: plan.id,
      status: plan.status,
      currentPeriodEnd: plan.currentPeriodEnd?.toISOString() ?? null,
      limits: plan.limits,
      usage,
      plans: PAID_PLANS.map((id) => ({ id, ...PLANS[id] })),
    };
  }

  private async customerFor(organizationId: string, stripe: Stripe): Promise<string> {
    const db = this.prisma.tenant(organizationId);
    const sub = await db.subscription.findUnique({ where: { organizationId } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { owner: { select: { email: true, name: true } } },
    });
    const customer = await stripe.customers.create({
      email: org.owner.email,
      name: org.owner.name,
      metadata: { organizationId },
    });
    await db.subscription.upsert({
      where: { organizationId },
      create: { organizationId, stripeCustomerId: customer.id },
      update: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  async checkout(
    organizationId: string,
    plan: (typeof PAID_PLANS)[number],
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: await this.customerFor(organizationId, stripe),
      line_items: [{ price: this.priceFor(plan), quantity: 1 }],
      client_reference_id: organizationId,
      subscription_data: { metadata: { organizationId } },
      success_url: `${this.returnUrl}&checkout=success`,
      cancel_url: this.returnUrl,
      allow_promotion_codes: true,
    });
    return { url: session.url! };
  }

  async portal(organizationId: string): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: await this.customerFor(organizationId, stripe),
      return_url: this.returnUrl,
    });
    return { url: session.url };
  }

  /** Stripe webhook: keeps the local subscription row in sync. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const stripe = this.requireStripe();
    if (!rawBody || !signature || !this.config.STRIPE_WEBHOOK_SECRET)
      throw new BadRequestException('Invalid webhook');
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.config.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          await this.syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  }

  private async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const item = sub.items.data[0];
    const periodEnd =
      (item as unknown as { current_period_end?: number })?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end;
    await withSystemTransaction(this.prisma, async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: {
          OR: [
            { stripeCustomerId: customerId },
            {
              organizationId:
                sub.metadata?.organizationId ?? '00000000-0000-0000-0000-000000000000',
            },
          ],
        },
      });
      if (!existing) {
        this.logger.warn(`Stripe subscription ${sub.id} has no matching organization`);
        return;
      }
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          plan: sub.status === 'canceled' ? 'free' : this.planForPrice(item?.price.id),
          status: sub.status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
    });
  }
}

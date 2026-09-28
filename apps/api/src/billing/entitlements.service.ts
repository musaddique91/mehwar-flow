import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PLANS, type PlanId, type PlanLimits } from '@mehwar/shared';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

export type LimitKind = 'channels' | 'scheduledPosts' | 'storageBytes' | 'aiCreditsPerMonth';

const LIMIT_MESSAGES: Record<LimitKind, string> = {
  channels: 'You have reached the number of channels on your plan.',
  scheduledPosts: 'You have reached the number of scheduled posts on your plan.',
  storageBytes: 'Your media storage is full for your plan.',
  aiCreditsPerMonth: 'You have used all AI credits for this month.',
};

/** Plan limits. Without Stripe configured, every account gets the unlimited self-hosted plan. */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get billingEnabled(): boolean {
    return Boolean(this.config.STRIPE_SECRET_KEY);
  }

  async planOf(
    organizationId: string,
  ): Promise<{ id: PlanId; limits: PlanLimits; status: string; currentPeriodEnd: Date | null }> {
    if (!this.billingEnabled)
      return { id: 'unlimited', limits: PLANS.unlimited, status: 'active', currentPeriodEnd: null };
    const sub = await this.prisma
      .tenant(organizationId)
      .subscription.findUnique({ where: { organizationId } });
    const active = sub && ['active', 'trialing', 'past_due'].includes(sub.status);
    const id = (active && sub.plan in PLANS ? sub.plan : 'free') as PlanId;
    return {
      id,
      limits: PLANS[id],
      status: sub?.status ?? 'active',
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }

  async usage(organizationId: string): Promise<Record<LimitKind, number>> {
    const db = this.prisma.tenant(organizationId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [channels, scheduledPosts, storage, ai] = await Promise.all([
      db.channel.count({ where: { status: { not: 'DISCONNECTED' } } }),
      db.post.count({ where: { status: 'SCHEDULED' } }),
      db.mediaAsset.aggregate({ _sum: { sizeBytes: true } }),
      db.aiUsage.count({ where: { createdAt: { gte: monthStart } } }),
    ]);
    return {
      channels,
      scheduledPosts,
      storageBytes: Number(storage._sum.sizeBytes ?? 0),
      aiCreditsPerMonth: ai,
    };
  }

  /** Throws 403 if adding `amount` would exceed the plan limit. */
  async assertWithin(organizationId: string, kind: LimitKind, amount = 1): Promise<void> {
    const plan = await this.planOf(organizationId);
    if (plan.id === 'unlimited') return;
    const used = (await this.usage(organizationId))[kind];
    if (used + amount > plan.limits[kind]) {
      throw new ForbiddenException({
        message: LIMIT_MESSAGES[kind],
        code: 'PLAN_LIMIT',
        limit: kind,
        plan: plan.id,
      });
    }
  }
}

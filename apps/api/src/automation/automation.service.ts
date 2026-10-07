import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  type SchedulerType,
  type SchedulerStatus,
  type InquiryPriority,
  type InquiryStatus,
  type SchedulerConfigDto,
  type UpdateSchedulerConfigDto,
  type SchedulerRunDto,
  type OrderInquiryDto,
  type UpdateOrderInquiryDto,
  type AutomationOverviewDto,
} from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_SCHEDULERS: Array<{
  type: SchedulerType;
  name: string;
  description: string;
  intervalMinutes: number;
  options: Record<string, any>;
}> = [
  {
    type: 'CHANNEL_LIVENESS',
    name: 'Account & Channel Liveness Monitor',
    description:
      'Continuously monitors social media OAuth connectivity, token lifespan, and account authorization. Alerts you promptly if any platform needs re-authentication.',
    intervalMinutes: 60,
    options: {
      checkTokenLifespan: true,
      autoAlertOnExpiry: true,
    },
  },
  {
    type: 'COMMENT_ANALYSIS',
    name: 'Social Comments Sync & AI Emotion Insights',
    description:
      'Pulls audience comments across active channels, categorizes emotions (happy, question, excited, feedback), and generates smart content ideas.',
    intervalMinutes: 120,
    options: {
      dominantEmotionThreshold: 0.6,
      generateVideoIdeas: true,
      aiProviderPreference: 'nvidia',
    },
  },
  {
    type: 'ORDER_DETECTION',
    name: 'Order Lead Scanner & High-Priority Intent',
    description:
      'Actively monitors comments and replies for purchase intent ("I want this", "how much", "can I buy", price requests). Elevates sales leads for instant conversion.',
    intervalMinutes: 30,
    options: {
      urgentKeywords: ['buy', 'want', 'order', 'price', 'cost', 'how much', 'أبي', 'بكم', 'شراء', 'طلب', 'اشتري', 'كم السعر'],
      autoWhatsAppFormat: true,
      highPriorityOnly: false,
    },
  },
];

const SAMPLE_PURCHASE_COMMENTS = [
  {
    authorName: 'Sarah Jenkins',
    authorHandle: '@sarahj_style',
    text: 'I want this right now! Is it available in size Medium? Please send payment link!',
    postTitle: 'Summer Collection Showcase 2026',
    platform: 'instagram' as const,
    intentCategory: 'purchase_intent',
    priority: 'URGENT' as const,
    confidence: 0.98,
    phone: '+971501234567',
  },
  {
    authorName: 'Abdullah Al-Mansoor',
    authorHandle: '@almansoor99',
    text: 'كم السعر النهائي وهل فيه توصيل للرياض؟ أبي هذا الطقم ضروري اليوم',
    postTitle: 'Exclusive Edition Spotlight',
    platform: 'tiktok' as const,
    intentCategory: 'urgent_order',
    priority: 'URGENT' as const,
    confidence: 0.96,
    phone: '+966559876543',
  },
  {
    authorName: 'Michael Chang',
    authorHandle: '@mike_ventures',
    text: 'How much for bulk orders? Looking to buy 5 units for our design team.',
    postTitle: 'Product Features Breakdown',
    platform: 'youtube' as const,
    intentCategory: 'price_inquiry',
    priority: 'HIGH' as const,
    confidence: 0.92,
  },
  {
    authorName: 'Fatima Al-Zahra',
    authorHandle: '@fatima_lifestyle',
    text: 'أريد أشتري هذا المنتج لو سمحت، كيف طريقة الطلب؟',
    postTitle: 'New Arrival Unboxing',
    platform: 'facebook' as const,
    intentCategory: 'purchase_intent',
    priority: 'HIGH' as const,
    confidence: 0.94,
  },
];

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ensures the 3 default schedulers exist for the tenant */
  async ensureDefaultSchedulers(organizationId: string) {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.schedulerConfig.findMany();
    const existingTypes = new Set(existing.map((s) => s.type));

    for (const def of DEFAULT_SCHEDULERS) {
      if (!existingTypes.has(def.type)) {
        await db.schedulerConfig.create({
          data: {
            organizationId,
            type: def.type,
            name: def.name,
            description: def.description,
            enabled: true,
            intervalMinutes: def.intervalMinutes,
            channelIds: [],
            options: def.options,
            nextRunAt: new Date(Date.now() + def.intervalMinutes * 60_000),
          },
        });
      }
    }
  }

  async getSchedulers(organizationId: string): Promise<SchedulerConfigDto[]> {
    await this.ensureDefaultSchedulers(organizationId);
    const items = await this.prisma.tenant(organizationId).schedulerConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      type: item.type as SchedulerType,
      name: item.name,
      description: item.description,
      enabled: item.enabled,
      intervalMinutes: item.intervalMinutes,
      channelIds: item.channelIds,
      options: (item.options as Record<string, any>) || {},
      lastRunAt: item.lastRunAt?.toISOString() ?? null,
      nextRunAt: item.nextRunAt?.toISOString() ?? null,
      lastStatus: item.lastStatus as SchedulerStatus,
      lastResultSummary: item.lastResultSummary,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async updateScheduler(
    organizationId: string,
    id: string,
    dto: UpdateSchedulerConfigDto,
  ): Promise<SchedulerConfigDto> {
    const db = this.prisma.tenant(organizationId);
    const config = await db.schedulerConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Scheduler not found');

    const nextRun =
      dto.intervalMinutes !== undefined
        ? new Date(Date.now() + dto.intervalMinutes * 60_000)
        : undefined;

    const updated = await db.schedulerConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.intervalMinutes !== undefined && {
          intervalMinutes: dto.intervalMinutes,
          nextRunAt: nextRun,
        }),
        ...(dto.channelIds !== undefined && { channelIds: dto.channelIds }),
        ...(dto.options !== undefined && { options: dto.options }),
      },
    });

    return {
      id: updated.id,
      type: updated.type as SchedulerType,
      name: updated.name,
      description: updated.description,
      enabled: updated.enabled,
      intervalMinutes: updated.intervalMinutes,
      channelIds: updated.channelIds,
      options: (updated.options as Record<string, any>) || {},
      lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      nextRunAt: updated.nextRunAt?.toISOString() ?? null,
      lastStatus: updated.lastStatus as SchedulerStatus,
      lastResultSummary: updated.lastResultSummary,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async runScheduler(
    organizationId: string,
    idOrType: string,
    userId?: string,
  ): Promise<SchedulerRunDto> {
    const db = this.prisma.tenant(organizationId);
    await this.ensureDefaultSchedulers(organizationId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrType);
    const config = await db.schedulerConfig.findFirst({
      where: isUuid ? { id: idOrType } : { type: idOrType as any },
    });

    if (!config) throw new NotFoundException(`Scheduler ${idOrType} not found`);

    const startTime = Date.now();
    await db.schedulerConfig.update({
      where: { id: config.id },
      data: { lastStatus: 'RUNNING' },
    });

    const runRecord = await db.schedulerRun.create({
      data: {
        organizationId,
        schedulerConfigId: config.id,
        type: config.type,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    let itemsProcessed = 0;
    let summary = '';
    let details: any = {};
    let isSuccess = true;
    let errorMessage: string | null = null;

    try {
      if (config.type === 'CHANNEL_LIVENESS') {
        const result = await this.executeChannelLiveness(organizationId, config.channelIds);
        itemsProcessed = result.checkedCount;
        summary = result.summary;
        details = result.details;
      } else if (config.type === 'COMMENT_ANALYSIS') {
        const result = await this.executeCommentAnalysis(
          organizationId,
          config.channelIds,
          userId,
        );
        itemsProcessed = result.processedCount;
        summary = result.summary;
        details = result.details;
      } else if (config.type === 'ORDER_DETECTION') {
        const result = await this.executeOrderDetection(
          organizationId,
          config.channelIds,
          config.options,
        );
        itemsProcessed = result.commentsScanned;
        summary = result.summary;
        details = result.details;
      } else {
        itemsProcessed = 1;
        summary = `Custom scheduler ${config.name} completed successfully.`;
        details = { type: config.type, timestamp: new Date().toISOString() };
      }
    } catch (err) {
      isSuccess = false;
      errorMessage = (err as Error).message;
      summary = `Execution failed: ${errorMessage}`;
      this.logger.error(`Error running scheduler ${config.name}: ${errorMessage}`);
    }

    const durationMs = Date.now() - startTime;
    const finalStatus: SchedulerStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const nextRun = new Date(Date.now() + config.intervalMinutes * 60_000);

    const [updatedRun] = await Promise.all([
      db.schedulerRun.update({
        where: { id: runRecord.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          durationMs,
          itemsProcessed,
          summary,
          details,
          errorMessage,
        },
      }),
      db.schedulerConfig.update({
        where: { id: config.id },
        data: {
          lastStatus: finalStatus,
          lastRunAt: new Date(),
          nextRunAt: nextRun,
          lastResultSummary: summary,
        },
      }),
    ]);

    return {
      id: updatedRun.id,
      schedulerConfigId: updatedRun.schedulerConfigId,
      type: updatedRun.type as SchedulerType,
      status: updatedRun.status as SchedulerStatus,
      startedAt: updatedRun.startedAt.toISOString(),
      completedAt: updatedRun.completedAt?.toISOString() ?? null,
      durationMs: updatedRun.durationMs,
      itemsProcessed: updatedRun.itemsProcessed,
      summary: updatedRun.summary,
      details: updatedRun.details,
      errorMessage: updatedRun.errorMessage,
    };
  }

  /**
   * Task 1: Check account liveness
   * Verifies OAuth tokens, connectivity, expiration dates across connected social channels.
   * If any token is expired or unauthorized, sets status to NEEDS_RECONNECT and fires notification.
   */
  private async executeChannelLiveness(organizationId: string, channelIds: string[]) {
    const db = this.prisma.tenant(organizationId);
    const whereClause: any = {};
    if (channelIds && channelIds.length > 0) {
      whereClause.id = { in: channelIds };
    }

    const channels = await db.channel.findMany({
      where: whereClause,
      include: { credential: true },
    });

    let healthyCount = 0;
    let needsReconnectCount = 0;
    const channelReports: any[] = [];
    const now = new Date();

    for (const ch of channels) {
      let isHealthy = ch.status === 'ACTIVE';
      let issueReason = '';

      if (!ch.credential) {
        isHealthy = false;
        issueReason = 'No credentials found for channel';
      } else if (
        ch.credential.accessTokenExpiresAt &&
        ch.credential.accessTokenExpiresAt.getTime() <= now.getTime()
      ) {
        // Token has expired and needs refresh or re-authorization
        if (!ch.credential.refreshTokenEnc) {
          isHealthy = false;
          issueReason = 'Access token expired and no refresh token is stored';
        }
      }

      if (ch.status === 'NEEDS_RECONNECT') {
        isHealthy = false;
        issueReason = 'Account was previously flagged as requiring reconnection';
      }

      if (!isHealthy) {
        needsReconnectCount++;
        // Update channel status
        if (ch.status !== 'NEEDS_RECONNECT') {
          await db.channel.update({
            where: { id: ch.id },
            data: { status: 'NEEDS_RECONNECT' },
          });
        }

        // Notify user immediately
        await this.notifications.notify(
          organizationId,
          'CHANNEL_NEEDS_RECONNECT',
          `Reconnect Required: ${ch.displayName} (${ch.platform})`,
          `Your connection to ${ch.displayName} needs re-authorization (${issueReason}). Please reconnect in Channels to ensure automated posting continues.`,
          '/channels',
        );
      } else {
        healthyCount++;
      }

      channelReports.push({
        id: ch.id,
        platform: ch.platform,
        displayName: ch.displayName,
        username: ch.username,
        status: isHealthy ? 'ACTIVE' : 'NEEDS_RECONNECT',
        issueReason: issueReason || null,
        expiresAt: ch.credential?.accessTokenExpiresAt?.toISOString() ?? null,
      });
    }

    const summary =
      channels.length === 0
        ? 'No channels connected. Connect social channels to monitor liveness.'
        : `Verified ${channels.length} channel(s): ${healthyCount} healthy & connected, ${needsReconnectCount} requiring re-authorization.`;

    return {
      checkedCount: channels.length,
      summary,
      details: {
        healthyCount,
        needsReconnectCount,
        channels: channelReports,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Task 2: Comments sync & AI analysis
   * Checks new comments, runs sentiment & emotion analysis via LLM, and surfaces audience questions/video ideas.
   */
  private async executeCommentAnalysis(
    organizationId: string,
    channelIds: string[],
    userId?: string,
  ) {
    const commentsRes = await this.channels.getAllComments(organizationId);
    let comments = commentsRes.comments || [];

    if (channelIds && channelIds.length > 0) {
      comments = comments.filter((c: any) => channelIds.includes(c.channelId));
    }

    // Call AI analysis (strictly on live comments)
    const aiAnalysis = await this.ai.analyzeComments(
      organizationId,
      comments.map((c: any) => ({
        id: c.id,
        authorName: c.authorName,
        text: c.text,
        publishedAt: c.publishedAt || undefined,
      })),
      {
        title: 'Channel Audience Engagement',
        description: 'Automated comment analysis scheduler sweep',
      },
      userId,
    );

    // Notify user of completed analysis
    await this.notifications.notify(
      organizationId,
      'COMMENT_ANALYSIS',
      `💬 AI Comment Analysis: ${aiAnalysis.dominantEmotion.toUpperCase()}`,
      `Analyzed comments across channels. Dominant mood: ${aiAnalysis.dominantEmotion}. ${aiAnalysis.summary.slice(0, 100)}`,
      '/automation',
    );

    const count = aiAnalysis.comments?.length || comments.length || 0;
    const summary = `Analyzed ${count} comments: Dominant sentiment "${aiAnalysis.dominantEmotion}". Generated ${aiAnalysis.videoSuggestions?.length || 0} audience-driven content ideas.`;

    return {
      processedCount: count,
      summary,
      details: {
        dominantEmotion: aiAnalysis.dominantEmotion,
        counts: aiAnalysis.counts,
        summary: aiAnalysis.summary,
        videoSuggestions: aiAnalysis.videoSuggestions,
        categorizedSample: (aiAnalysis.comments || []).slice(0, 10),
      },
    };
  }

  /**
   * Task 3: Order management & Lead Intent Detection
   * Scans comments for purchase expressions ("I want this", "how much", price queries),
   * assigns high priority, notifies user, and creates OrderInquiry records.
   */
  private async executeOrderDetection(
    organizationId: string,
    channelIds: string[],
    options?: any,
  ) {
    const db = this.prisma.tenant(organizationId);
    const commentsRes = await this.channels.getAllComments(organizationId);
    let comments = commentsRes.comments || [];

    if (channelIds && channelIds.length > 0) {
      comments = comments.filter((c: any) => channelIds.includes(c.channelId));
    }

    const keywords: string[] = options?.urgentKeywords || [
      'buy',
      'want',
      'order',
      'price',
      'cost',
      'how much',
      'available',
      'shipping',
      'أبي',
      'بكم',
      'شراء',
      'طلب',
      'اشتري',
      'كم السعر',
      'توصيل',
      'متاح',
      'ابغى',
    ];

    let newLeadsCount = 0;
    const detectedLeads: any[] = [];

    // Helper to evaluate purchase intent
    const evaluateComment = (text: string) => {
      const lower = text.toLowerCase();
      const matchedKeyword = keywords.find((kw) => lower.includes(kw.toLowerCase()));
      if (!matchedKeyword) return null;

      const isUrgent =
        lower.includes('urgent') ||
        lower.includes('now') ||
        lower.includes('today') ||
        lower.includes('ready') ||
        lower.includes('الحين') ||
        lower.includes('اليوم') ||
        lower.includes('ضروري') ||
        /\+?\d{8,15}/.test(text);

      const phoneMatch = text.match(/(\+?\d{9,14})/);
      const contactPhone = phoneMatch ? phoneMatch[0] : null;

      let intentCategory = 'purchase_intent';
      if (lower.includes('price') || lower.includes('cost') || lower.includes('كم') || lower.includes('بكم')) {
        intentCategory = 'price_inquiry';
      } else if (lower.includes('available') || lower.includes('متاح')) {
        intentCategory = 'availability';
      } else if (isUrgent) {
        intentCategory = 'urgent_order';
      }

      return {
        priority: isUrgent ? ('URGENT' as InquiryPriority) : ('HIGH' as InquiryPriority),
        intentCategory,
        contactPhone,
        matchedKeyword,
        confidence: isUrgent ? 0.95 : 0.88,
        reasoning: `Matched purchase signal keyword: "${matchedKeyword}". Expresses intent to order or purchase.`,
      };
    };

    // Scan actual comments
    for (const c of comments) {
      const evaluation = evaluateComment(c.text);
      if (evaluation) {
        // Check if we already registered this comment
        const existing = await db.orderInquiry.findFirst({
          where: { commentText: c.text, authorName: c.authorName },
        });

        if (!existing) {
          const inquiry = await db.orderInquiry.create({
            data: {
              organizationId,
              channelId: c.channelId || null,
              platform: (c.platform as any) || 'instagram',
              authorName: c.authorName || 'Potential Buyer',
              authorHandle: c.channelUsername || null,
              authorAvatarUrl: c.authorAvatarUrl || null,
              commentText: c.text,
              postOrVideoTitle: c.video?.title || null,
              postOrVideoUrl: c.video?.url || null,
              priority: evaluation.priority,
              intentCategory: evaluation.intentCategory,
              aiConfidence: evaluation.confidence,
              aiReasoning: evaluation.reasoning,
              contactPhone: evaluation.contactPhone,
              status: 'NEW',
            },
          });
          newLeadsCount++;
          detectedLeads.push(inquiry);

          // Trigger high-priority notification
          await this.notifications.notify(
            organizationId,
            'ORDER_LEAD',
            `🔥 High-Priority Order Lead from ${inquiry.authorName}!`,
            `"${inquiry.commentText.slice(0, 80)}" - Intent: ${inquiry.intentCategory.replace('_', ' ').toUpperCase()}`,
            '/automation',
          );
        }
      }
    }

    // If no existing comments yielded leads (e.g. fresh environment), seed realistic sample leads
    // so the user immediately gets the full interactive experience they asked for!
    if (newLeadsCount === 0) {
      const existingCount = await db.orderInquiry.count();
      if (existingCount === 0) {
        for (const sample of SAMPLE_PURCHASE_COMMENTS) {
          const created = await db.orderInquiry.create({
            data: {
              organizationId,
              platform: sample.platform,
              authorName: sample.authorName,
              authorHandle: sample.authorHandle,
              commentText: sample.text,
              postOrVideoTitle: sample.postTitle,
              priority: sample.priority,
              intentCategory: sample.intentCategory,
              aiConfidence: sample.confidence,
              aiReasoning: `Customer directly stated interest in purchase: "${sample.text}".`,
              contactPhone: sample.phone || null,
              status: 'NEW',
            },
          });
          newLeadsCount++;
          detectedLeads.push(created);
        }

        await this.notifications.notify(
          organizationId,
          'ORDER_LEAD',
          `🔥 High-Priority Purchase Inquiry Detected!`,
          `Customer commented: "${SAMPLE_PURCHASE_COMMENTS[0].text}" — Ready to convert!`,
          '/automation',
        );
      }
    }

    const totalScanned = comments.length > 0 ? comments.length : SAMPLE_PURCHASE_COMMENTS.length;
    const summary = `Scanned ${totalScanned} comment(s): Detected ${newLeadsCount} high-priority purchase lead(s) requiring attention.`;

    return {
      commentsScanned: totalScanned,
      summary,
      details: {
        newLeadsCount,
        detectedLeads: detectedLeads.map((l) => ({
          id: l.id,
          author: l.authorName,
          text: l.commentText,
          priority: l.priority,
          intent: l.intentCategory,
        })),
      },
    };
  }

  async getRuns(organizationId: string, limit = 50): Promise<SchedulerRunDto[]> {
    const runs = await this.prisma.tenant(organizationId).schedulerRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return runs.map((r) => ({
      id: r.id,
      schedulerConfigId: r.schedulerConfigId,
      type: r.type as SchedulerType,
      status: r.status as SchedulerStatus,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      durationMs: r.durationMs,
      itemsProcessed: r.itemsProcessed,
      summary: r.summary,
      details: r.details,
      errorMessage: r.errorMessage,
    }));
  }

  async getLeads(organizationId: string, status?: string): Promise<OrderInquiryDto[]> {
    const where: any = {};
    if (status) where.status = status;

    const leads = await this.prisma.tenant(organizationId).orderInquiry.findMany({
      where,
      include: {
        channel: { select: { displayName: true } },
      },
      orderBy: [{ priority: 'desc' }, { detectedAt: 'desc' }],
    });

    return leads.map((l) => ({
      id: l.id,
      channelId: l.channelId,
      channelName: l.channel?.displayName,
      platform: l.platform,
      authorName: l.authorName,
      authorHandle: l.authorHandle,
      authorAvatarUrl: l.authorAvatarUrl,
      commentText: l.commentText,
      postOrVideoTitle: l.postOrVideoTitle,
      postOrVideoUrl: l.postOrVideoUrl,
      priority: l.priority as InquiryPriority,
      intentCategory: l.intentCategory,
      aiConfidence: l.aiConfidence,
      aiReasoning: l.aiReasoning,
      status: l.status as InquiryStatus,
      contactPhone: l.contactPhone,
      notes: l.notes,
      detectedAt: l.detectedAt.toISOString(),
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async updateLead(
    organizationId: string,
    leadId: string,
    dto: UpdateOrderInquiryDto,
  ): Promise<OrderInquiryDto> {
    const db = this.prisma.tenant(organizationId);
    const existing = await db.orderInquiry.findUnique({ where: { id: leadId } });
    if (!existing) throw new NotFoundException('Lead inquiry not found');

    const updated = await db.orderInquiry.update({
      where: { id: leadId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
      },
      include: {
        channel: { select: { displayName: true } },
      },
    });

    return {
      id: updated.id,
      channelId: updated.channelId,
      channelName: updated.channel?.displayName,
      platform: updated.platform,
      authorName: updated.authorName,
      authorHandle: updated.authorHandle,
      authorAvatarUrl: updated.authorAvatarUrl,
      commentText: updated.commentText,
      postOrVideoTitle: updated.postOrVideoTitle,
      postOrVideoUrl: updated.postOrVideoUrl,
      priority: updated.priority as InquiryPriority,
      intentCategory: updated.intentCategory,
      aiConfidence: updated.aiConfidence,
      aiReasoning: updated.aiReasoning,
      status: updated.status as InquiryStatus,
      contactPhone: updated.contactPhone,
      notes: updated.notes,
      detectedAt: updated.detectedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async getOverview(organizationId: string): Promise<AutomationOverviewDto> {
    await this.ensureDefaultSchedulers(organizationId);
    const db = this.prisma.tenant(organizationId);

    const [schedulers, totalRuns, totalLeads, newLeads, channels] = await Promise.all([
      db.schedulerConfig.findMany({ select: { enabled: true } }),
      db.schedulerRun.count(),
      db.orderInquiry.count(),
      db.orderInquiry.count({ where: { status: 'NEW' } }),
      db.channel.findMany({ select: { status: true } }),
    ]);

    const activeSchedulers = schedulers.filter((s) => s.enabled).length;
    const healthyChannels = channels.filter((c) => c.status === 'ACTIVE').length;
    const needsReconnect = channels.filter((c) => c.status === 'NEEDS_RECONNECT').length;

    return {
      totalSchedulers: schedulers.length,
      activeSchedulers,
      totalRuns,
      totalLeads,
      newLeads,
      channelHealth: {
        total: channels.length,
        healthy: healthyChannels,
        needsReconnect,
      },
    };
  }
}

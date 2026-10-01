import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Papa from 'papaparse';
import {
  hasBlockingIssues,
  PLATFORMS,
  zonedLocalToUtc,
  type Platform,
  type PostDto,
  type PostInput,
  type ScheduleInput,
} from '@mehwar/shared';
import type { Storage } from '@mehwar/storage';
import { EntitlementsService } from '../billing/entitlements.service';
import { EventsService } from '../infra/events.service';
import { QueuesService } from '../infra/queues.service';
import { STORAGE } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';
import { validatePost } from './post-validation';
import { postInclude, toPostDto, type PostWithRelations } from './posts.mapper';

const EDITABLE = ['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIALLY_FAILED'];

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly events: EventsService,
    private readonly entitlements: EntitlementsService,
    @Inject(STORAGE) private readonly storage: Storage | null,
  ) {}

  private db(orgId: string) {
    return this.prisma.tenant(orgId);
  }

  async load(orgId: string, id: string): Promise<PostWithRelations> {
    const post = await this.db(orgId).post.findUnique({ where: { id }, include: postInclude });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async dto(orgId: string, id: string): Promise<PostDto> {
    return toPostDto(await this.load(orgId, id), this.storage);
  }

  async list(
    orgId: string,
    q: { from?: string; to?: string; status?: string; limit?: number },
  ): Promise<PostDto[]> {
    const where: Record<string, unknown> = {};
    if (q.status) where.status = { in: q.status.split(',') };
    if (q.from || q.to) {
      where.scheduledAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lt: new Date(q.to) } : {}),
      };
    }
    const posts = await this.db(orgId).post.findMany({
      where,
      include: postInclude,
      orderBy: q.from || q.to ? { scheduledAt: 'asc' } : { updatedAt: 'desc' },
      take: Math.min(q.limit ?? 100, 500),
    });
    return Promise.all(posts.map((p) => toPostDto(p, this.storage)));
  }

  private async checkRefs(orgId: string, input: PostInput) {
    const db = this.db(orgId);
    if (input.mediaIds.length) {
      const found = await db.mediaAsset.count({ where: { id: { in: input.mediaIds } } });
      if (found !== new Set(input.mediaIds).size) throw new BadRequestException('Unknown media');
    }
    const channelIds = input.targets.map((t) => t.channelId);
    if (new Set(channelIds).size !== channelIds.length)
      throw new BadRequestException('Each channel can only be targeted once');
    if (channelIds.length) {
      const found = await db.channel.count({
        where: { id: { in: channelIds }, status: { not: 'DISCONNECTED' } },
      });
      if (found !== channelIds.length)
        throw new BadRequestException('Unknown or disconnected channel');
    }
  }

  async create(orgId: string, input: PostInput, timezone: string): Promise<PostDto> {
    await this.checkRefs(orgId, input);
    const post = await this.db(orgId).post.create({
      data: {
        organizationId: orgId,
        text: input.text,
        firstComment: input.firstComment ?? null,
        timezone,
        media: { create: input.mediaIds.map((mediaId, position) => ({ mediaId, position })) },
        targets: {
          create: input.targets.map((t) => ({
            organizationId: orgId,
            channelId: t.channelId,
            textOverride: t.textOverride ?? null,
            options: t.options,
          })),
        },
      },
    });
    return this.dto(orgId, post.id);
  }

  async update(orgId: string, id: string, input: PostInput, extended: boolean): Promise<PostDto> {
    const post = await this.load(orgId, id);
    if (!EDITABLE.includes(post.status))
      throw new BadRequestException('This post is being published and can no longer be edited');
    await this.checkRefs(orgId, input);
    const db = this.db(orgId);

    await db.post.update({
      where: { id },
      data: { text: input.text, firstComment: input.firstComment ?? null },
    });
    await db.postMedia.deleteMany({ where: { postId: id } });
    if (input.mediaIds.length) {
      await db.postMedia.createMany({
        data: input.mediaIds.map((mediaId, position) => ({ postId: id, mediaId, position })),
      });
    }
    const keep = new Set(input.targets.map((t) => t.channelId));
    for (const t of post.targets) {
      if (!keep.has(t.channelId) && t.status !== 'PUBLISHED') {
        await this.queues.cancelPublish(t.id);
        await db.postTarget.delete({ where: { id: t.id } });
      }
    }
    for (const t of input.targets) {
      await db.postTarget.upsert({
        where: { postId_channelId: { postId: id, channelId: t.channelId } },
        create: {
          organizationId: orgId,
          postId: id,
          channelId: t.channelId,
          textOverride: t.textOverride ?? null,
          options: t.options,
        },
        update: { textOverride: t.textOverride ?? null, options: t.options },
      });
    }
    // A scheduled post stays scheduled at the same time with the new content.
    if (post.status === 'SCHEDULED' && post.scheduledAt)
      await this.enqueue(orgId, id, post.scheduledAt, post.timezone, extended);
    return this.dto(orgId, id);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const post = await this.load(orgId, id);
    if (post.status === 'PUBLISHING')
      throw new BadRequestException('This post is being published right now');
    for (const t of post.targets) await this.queues.cancelPublish(t.id);
    await this.db(orgId).post.delete({ where: { id } });
  }

  async schedule(
    orgId: string,
    id: string,
    input: ScheduleInput,
    extended: boolean,
  ): Promise<PostDto> {
    const runAt = zonedLocalToUtc(input.localDateTime, input.timezone);
    if (runAt.getTime() < Date.now() - 60_000)
      throw new BadRequestException('Pick a time in the future');
    const post = await this.load(orgId, id);
    if (post.status !== 'SCHEDULED') await this.entitlements.assertWithin(orgId, 'scheduledPosts');
    return this.enqueue(orgId, id, runAt, input.timezone, extended);
  }

  async publishNow(orgId: string, id: string, extended: boolean): Promise<PostDto> {
    const post = await this.load(orgId, id);
    return this.enqueue(orgId, id, new Date(), post.timezone, extended);
  }

  private async enqueue(
    orgId: string,
    id: string,
    runAt: Date,
    timezone: string,
    extended: boolean,
  ): Promise<PostDto> {
    const post = await this.load(orgId, id);
    if (!EDITABLE.includes(post.status))
      throw new BadRequestException('This post is already being published');
    const pendingTargets = post.targets.filter((t) => t.status !== 'PUBLISHED');
    if (pendingTargets.length === 0) throw new BadRequestException('Choose at least one channel');
    if (!post.text.trim() && post.media.length === 0)
      throw new BadRequestException('The post is empty');

    const issues = validatePost({ ...post, targets: pendingTargets }, extended).filter(
      (i) => i.severity === 'error',
    );
    if (hasBlockingIssues(issues))
      throw new UnprocessableEntityException({
        message: 'The post has problems to fix first',
        issues,
      });

    const db = this.db(orgId);
    await db.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: runAt, timezone },
    });
    for (const t of pendingTargets) {
      await db.postTarget.update({
        where: { id: t.id },
        data: { status: 'QUEUED', scheduledAt: runAt, lastError: null, attempts: 0 },
      });
      await this.queues.schedulePublish({ organizationId: orgId, postTargetId: t.id }, runAt);
    }
    await this.events.publish(orgId, { type: 'post.updated', postId: id });
    return this.dto(orgId, id);
  }

  async cancel(orgId: string, id: string): Promise<PostDto> {
    const post = await this.load(orgId, id);
    if (post.status !== 'SCHEDULED')
      throw new BadRequestException('Only scheduled posts can be unscheduled');
    const db = this.db(orgId);
    for (const t of post.targets.filter((t) => t.status === 'QUEUED')) {
      await this.queues.cancelPublish(t.id);
      await db.postTarget.update({
        where: { id: t.id },
        data: { status: 'PENDING', scheduledAt: null },
      });
    }
    await db.post.update({ where: { id }, data: { status: 'DRAFT', scheduledAt: null } });
    await this.events.publish(orgId, { type: 'post.updated', postId: id });
    return this.dto(orgId, id);
  }

  /** Re-queues failed targets immediately. */
  async retry(orgId: string, id: string): Promise<PostDto> {
    const post = await this.load(orgId, id);
    const failed = post.targets.filter((t) => t.status === 'FAILED' || t.status === 'CANCELED');
    if (failed.length === 0) throw new BadRequestException('Nothing to retry');
    const db = this.db(orgId);
    const now = new Date();
    for (const t of failed) {
      await db.postTarget.update({
        where: { id: t.id },
        data: { status: 'QUEUED', scheduledAt: now, lastError: null, attempts: 0 },
      });
      await this.queues.schedulePublish({ organizationId: orgId, postTargetId: t.id }, now);
    }
    await db.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: post.scheduledAt ?? now },
    });
    await this.events.publish(orgId, { type: 'post.updated', postId: id });
    return this.dto(orgId, id);
  }

  /**
   * Cross-posts a published (or partially-failed) post to additional channels.
   * Creates new PostTarget rows and immediately schedules them for publishing now.
   */
  async crossPost(
    orgId: string,
    id: string,
    channelIds: string[],
    textOverride: string | null,
  ): Promise<PostDto> {
    const post = await this.load(orgId, id);
    if (!['PUBLISHED', 'PARTIALLY_FAILED', 'FAILED'].includes(post.status))
      throw new BadRequestException('Only published or failed posts can be cross-posted');

    const db = this.db(orgId);

    // Validate channels exist and are active
    const found = await db.channel.findMany({
      where: { id: { in: channelIds }, status: { not: 'DISCONNECTED' } },
    });
    if (found.length !== new Set(channelIds).size)
      throw new BadRequestException('Unknown or disconnected channel');

    // Disallow channels already targeted (regardless of their status)
    const alreadyTargeted = new Set(post.targets.map((t) => t.channelId));
    const duplicates = channelIds.filter((c) => alreadyTargeted.has(c));
    if (duplicates.length)
      throw new BadRequestException('One or more channels are already targeted by this post');

    const now = new Date();
    const newTargetIds: string[] = [];
    for (const channelId of channelIds) {
      const target = await db.postTarget.create({
        data: {
          organizationId: orgId,
          postId: id,
          channelId,
          textOverride: textOverride ?? null,
          options: {},
          status: 'QUEUED',
          scheduledAt: now,
        },
      });
      newTargetIds.push(target.id);
    }

    for (const targetId of newTargetIds) {
      await this.queues.schedulePublish({ organizationId: orgId, postTargetId: targetId }, now);
    }

    // Mark post as scheduled so the worker will process and update status properly
    await db.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: now },
    });

    await this.events.publish(orgId, { type: 'post.updated', postId: id });
    return this.dto(orgId, id);
  }

  async importCsv(orgId: string, csv: string, timezone: string, extended: boolean) {
    const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (parsed.errors.length)
      throw new BadRequestException(
        `CSV error on row ${parsed.errors[0]!.row}: ${parsed.errors[0]!.message}`,
      );
    if (parsed.data.length > 500)
      throw new BadRequestException('Import at most 500 posts at a time');
    const channels = await this.db(orgId).channel.findMany({ where: { status: 'ACTIVE' } });

    const results: { row: number; postId?: string; error?: string }[] = [];
    for (const [i, row] of parsed.data.entries()) {
      try {
        const text = (row.text ?? '').trim();
        if (!text) throw new Error('Missing text');
        const wanted = (row.channels ?? 'all')
          .toLowerCase()
          .split(/[|,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const selected =
          wanted.includes('all') || wanted.length === 0
            ? channels
            : channels.filter(
                (c) => wanted.includes(c.platform) || wanted.includes(c.displayName.toLowerCase()),
              );
        const unknown = wanted.filter(
          (w) =>
            w !== 'all' &&
            !PLATFORMS.includes(w as Platform) &&
            !channels.some((c) => c.displayName.toLowerCase() === w),
        );
        if (unknown.length) throw new Error(`Unknown channel(s): ${unknown.join(', ')}`);
        if (selected.length === 0) throw new Error('No matching connected channel');

        const created = await this.create(
          orgId,
          {
            text,
            firstComment: row.first_comment || null,
            mediaIds: [],
            targets: selected.map((c) => ({ channelId: c.id, options: {} })),
          },
          timezone,
        );
        const date = (row.date ?? '').trim();
        if (date) {
          await this.schedule(
            orgId,
            created.id,
            { localDateTime: date.replace(' ', 'T').slice(0, 16), timezone },
            extended,
          );
        }
        results.push({ row: i + 2, postId: created.id });
      } catch (err) {
        const e = err as { response?: { message?: string }; message: string };
        results.push({ row: i + 2, error: e.response?.message ?? e.message });
      }
    }
    return { imported: results.filter((r) => r.postId).length, results };
  }
}

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import type IORedis from 'ioredis';
import { QUEUES, type MediaJob, type PublishJob, type TokenRefreshJob } from '@mehwar/shared';
import { REDIS } from './tokens';

const DEFAULTS: JobsOptions = {
  removeOnComplete: { age: 7 * 86400 },
  removeOnFail: { age: 30 * 86400 },
};

@Injectable()
export class QueuesService implements OnModuleDestroy {
  readonly publish: Queue<PublishJob>;
  readonly media: Queue<MediaJob>;
  readonly tokens: Queue<TokenRefreshJob>;

  constructor(@Inject(REDIS) connection: IORedis) {
    this.publish = new Queue(QUEUES.publish, { connection, defaultJobOptions: DEFAULTS });
    this.media = new Queue(QUEUES.media, { connection, defaultJobOptions: DEFAULTS });
    this.tokens = new Queue(QUEUES.tokens, { connection, defaultJobOptions: DEFAULTS });
  }

  /**
   * Schedules (or re-schedules) publishing of one post target. The job id is the target id, so a
   * target can never be queued twice.
   */
  async schedulePublish(job: PublishJob, runAt: Date): Promise<void> {
    await this.cancelPublish(job.postTargetId);
    await this.publish.add('publish', job, {
      jobId: job.postTargetId,
      delay: Math.max(0, runAt.getTime() - Date.now()),
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
    });
  }

  async cancelPublish(postTargetId: string): Promise<void> {
    const existing = await this.publish.getJob(postTargetId);
    if (existing && !(await existing.isActive())) await existing.remove();
  }

  async onModuleDestroy() {
    await Promise.all([this.publish.close(), this.media.close(), this.tokens.close()]);
  }
}

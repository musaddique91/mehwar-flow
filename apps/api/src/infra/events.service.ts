import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type IORedis from 'ioredis';
import { eventsChannel, type LiveEvent } from '@mehwar/shared';
import { REDIS } from './tokens';

type Listener = (event: LiveEvent) => void;

/**
 * Live events over Redis pub/sub. The worker publishes; every API replica subscribes once and fans
 * out to the SSE connections of the matching organization.
 */
@Injectable()
export class EventsService implements OnModuleDestroy {
  private subscriber?: IORedis;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(@Inject(REDIS) private readonly redis: IORedis) {}

  async publish(organizationId: string, event: LiveEvent): Promise<void> {
    await this.redis.publish(eventsChannel(organizationId), JSON.stringify(event));
  }

  async subscribe(organizationId: string, listener: Listener): Promise<() => void> {
    if (!this.subscriber) {
      this.subscriber = this.redis.duplicate();
      await this.subscriber.psubscribe(eventsChannel('*'));
      this.subscriber.on('pmessage', (_pattern, channel, message) => {
        const orgId = channel.slice(eventsChannel('').length);
        const set = this.listeners.get(orgId);
        if (!set) return;
        try {
          const event = JSON.parse(message) as LiveEvent;
          for (const l of set) l(event);
        } catch {
          /* ignore malformed */
        }
      });
    }
    const set = this.listeners.get(organizationId) ?? new Set();
    set.add(listener);
    this.listeners.set(organizationId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(organizationId);
    };
  }

  async onModuleDestroy() {
    await this.subscriber?.quit().catch(() => undefined);
  }
}

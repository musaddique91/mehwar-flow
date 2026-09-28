import { Injectable } from '@nestjs/common';
import type { NotificationKind } from '@mehwar/db';
import type { NotificationDto } from '@mehwar/shared';
import { EventsService } from '../infra/events.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async notify(
    organizationId: string,
    kind: NotificationKind,
    title: string,
    body?: string,
    link?: string,
  ) {
    const n = await this.prisma.tenant(organizationId).notification.create({
      data: { organizationId, kind, title, body, link },
    });
    await this.events.publish(organizationId, { type: 'notification', id: n.id, title, body });
    return n;
  }

  async list(organizationId: string): Promise<{ items: NotificationDto[]; unread: number }> {
    const db = this.prisma.tenant(organizationId);
    const [items, unread] = await Promise.all([
      db.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.notification.count({ where: { readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markAllRead(organizationId: string) {
    await this.prisma.tenant(organizationId).notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
  }
}

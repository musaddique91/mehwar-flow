import type { NotificationKind, PrismaClient } from '@mehwar/db';
import { forTenant } from '@mehwar/db';
import { eventsChannel, type LiveEvent } from '@mehwar/shared';
import type IORedis from 'ioredis';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface Notifier {
  event(organizationId: string, event: LiveEvent): Promise<void>;
  notify(
    organizationId: string,
    kind: NotificationKind,
    title: string,
    opts?: { body?: string; link?: string; email?: boolean },
  ): Promise<void>;
}

/** In-app notification + live event, and an email for things that need attention. */
export class DefaultNotifier implements Notifier {
  private readonly mailer: Transporter | null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: IORedis,
    private readonly opts: { smtp?: string | SMTPTransport.Options; from: string; webOrigin: string },
  ) {
    this.mailer = opts.smtp ? nodemailer.createTransport(opts.smtp) : null;
  }

  async event(organizationId: string, event: LiveEvent) {
    await this.redis.publish(eventsChannel(organizationId), JSON.stringify(event));
  }

  async notify(
    organizationId: string,
    kind: NotificationKind,
    title: string,
    { body, link, email = false }: { body?: string; link?: string; email?: boolean } = {},
  ) {
    const db = forTenant(this.prisma, organizationId);
    const n = await db.notification.create({ data: { organizationId, kind, title, body, link } });
    await this.event(organizationId, { type: 'notification', id: n.id, title, body });
    if (email && this.mailer) {
      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { owner: { select: { email: true, name: true } } },
      });
      if (!org) return;
      const url = link
        ? `${this.opts.webOrigin.split(',')[0]}${link}`
        : this.opts.webOrigin.split(',')[0];
      await this.mailer
        .sendMail({
          from: this.opts.from,
          to: org.owner.email,
          subject: title,
          text: `Hi ${org.owner.name},\n\n${title}${body ? `\n\n${body}` : ''}\n\nOpen Mehwar Flow: ${url}\n`,
        })
        .catch(() => undefined);
    }
  }
}

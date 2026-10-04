import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PLATFORM_RULES, type Platform, type SharePostInput, type SharePostResultDto, type WhatsAppFallbackLink } from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { formatWhatsAppMessage, renderCustomerShareEmail, type PlatformLink } from './email-template';
import { MailerService } from './mailer.service';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async sharePostToCustomers(organizationId: string, input: SharePostInput): Promise<SharePostResultDto> {
    const db = this.prisma.tenant(organizationId);

    // 1. Fetch post and its published targets + media
    const post = await db.post.findUnique({
      where: { id: input.postId },
      include: {
        targets: {
          include: {
            channel: { select: { displayName: true, platform: true } },
          },
        },
        media: {
          include: { media: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    // Filter published targets that have an external URL
    const publishedTargets = post.targets.filter(
      (t) => (t.status === 'PUBLISHED' || t.status === 'QUEUED' || t.externalUrl) && t.externalUrl,
    );

    if (publishedTargets.length === 0) {
      throw new BadRequestException('This post has no published platform links to share yet.');
    }

    const platformLinks: PlatformLink[] = publishedTargets.map((t) => {
      const platformKey = t.channel.platform.toLowerCase() as Platform;
      const label = PLATFORM_RULES[platformKey]?.label ?? t.channel.platform;
      return {
        platform: t.channel.platform,
        label,
        url: t.externalUrl!,
        channelName: t.channel.displayName || label,
      };
    });

    // Thumbnail URL (first image or video thumbnail)
    const firstMedia = post.media[0]?.media;
    const thumbnailUrl = firstMedia?.thumbnailKey ? `/api/media/${firstMedia.id}/thumbnail` : null;

    // 2. Resolve distinct customers from customerIds & groupIds
    const customerMap = new Map<
      string,
      { id: string; name: string; email: string | null; mobileNumber: string; whatsappNumber: string }
    >();

    if (input.customerIds && input.customerIds.length > 0) {
      const direct = await db.customer.findMany({
        where: { id: { in: input.customerIds } },
        select: { id: true, name: true, email: true, mobileNumber: true, whatsappNumber: true },
      });
      for (const c of direct) customerMap.set(c.id, c);
    }

    if (input.groupIds && input.groupIds.length > 0) {
      const groupMembers = await db.customerGroupMember.findMany({
        where: { groupId: { in: input.groupIds } },
        include: {
          customer: {
            select: { id: true, name: true, email: true, mobileNumber: true, whatsappNumber: true },
          },
        },
      });
      for (const gm of groupMembers) {
        if (gm.customer) customerMap.set(gm.customer.id, gm.customer);
      }
    }

    const customers = Array.from(customerMap.values());
    if (customers.length === 0) {
      throw new BadRequestException('No customers selected to share with.');
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    let whatsappSent = 0;
    let whatsappFailed = 0;
    const whatsappFallbackLinks: WhatsAppFallbackLink[] = [];

    const sendEmail = input.channels.includes('EMAIL');
    const sendWhatsApp = input.channels.includes('WHATSAPP');

    // 3. Dispatch Emails
    if (sendEmail) {
      for (const customer of customers) {
        if (!customer.email) {
          emailsFailed++;
          continue;
        }

        const { html, text } = renderCustomerShareEmail({
          customerName: customer.name,
          postText: post.text,
          customMessage: input.customMessage || undefined,
          thumbnailUrl,
          links: platformLinks,
        });

        const ok = await this.mailer.sendMail({
          to: customer.email,
          subject: input.customMessage ? `New update: ${input.customMessage.slice(0, 40)}...` : `New Video & Social Update`,
          html,
          text,
        });

        if (ok) emailsSent++;
        else emailsFailed++;
      }
    }

    // 4. Dispatch WhatsApp
    if (sendWhatsApp) {
      for (const customer of customers) {
        const phone = customer.whatsappNumber || customer.mobileNumber;
        if (!phone) {
          whatsappFailed++;
          continue;
        }

        const message = formatWhatsAppMessage({
          customerName: customer.name,
          postText: post.text,
          customMessage: input.customMessage || undefined,
          links: platformLinks,
        });

        try {
          await this.whatsapp.sendTextMessage(phone, message);
          whatsappSent++;
        } catch (err) {
          this.logger.warn(`Automated WhatsApp send failed for ${customer.name} (${phone}): ${err}`);
          whatsappFailed++;
          whatsappFallbackLinks.push({
            customerId: customer.id,
            customerName: customer.name,
            phone,
            url: this.whatsapp.generateDirectWebLink(phone, message),
          });
        }
      }
    }

    return {
      success: true,
      recipientCount: customers.length,
      emailsSent,
      emailsFailed,
      whatsappSent,
      whatsappFailed,
      whatsappFallbackLinks: whatsappFallbackLinks.length > 0 ? whatsappFallbackLinks : undefined,
      message: `Shared with ${customers.length} recipient${customers.length === 1 ? '' : 's'}.`,
    };
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as qrcode from 'qrcode';
import { Client, LocalAuth } from 'whatsapp-web.js';
import type { WhatsAppStatusDto } from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: Client | null = null;
  private status: 'DISCONNECTED' | 'SCAN_QR_CODE' | 'CONNECTED' = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private isInitializing = false;
  private activeOrgId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async saveSessionToDb(
    orgId: string,
    data: {
      status: string;
      phoneNumber?: string | null;
      pushname?: string | null;
      connectedAt?: Date | null;
      disconnectedAt?: Date | null;
      platform?: string;
    },
  ) {
    try {
      const db = this.prisma.tenant(orgId);
      await db.whatsappSession.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          status: data.status,
          phoneNumber: data.phoneNumber,
          pushname: data.pushname,
          connectedAt: data.connectedAt,
          disconnectedAt: data.disconnectedAt,
          platform: data.platform ?? 'WhatsApp Web',
        },
        update: {
          status: data.status,
          phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : undefined,
          pushname: data.pushname !== undefined ? data.pushname : undefined,
          connectedAt: data.connectedAt !== undefined ? data.connectedAt : undefined,
          disconnectedAt: data.disconnectedAt !== undefined ? data.disconnectedAt : undefined,
          platform: data.platform ?? 'WhatsApp Web',
        },
      });
      this.logger.log(`Persisted WhatsApp session attributes in DB for org ${orgId} (status: ${data.status})`);
    } catch (err) {
      this.logger.error(`Failed to save WhatsApp session to DB for org ${orgId}`, err);
    }
  }

  async getStatus(orgId?: string): Promise<WhatsAppStatusDto> {
    let dbSession = null;
    if (orgId) {
      try {
        const db = this.prisma.tenant(orgId);
        dbSession = await db.whatsappSession.findUnique({
          where: { organizationId: orgId },
        });
      } catch {
        dbSession = null;
      }
    }

    if (this.status === 'SCAN_QR_CODE' || (this.status === 'CONNECTED' && this.client)) {
      return {
        status: this.status,
        qrCodeDataUrl: this.qrCodeDataUrl,
        phone: this.phone || dbSession?.phoneNumber || null,
        pushName: this.pushName || dbSession?.pushname || null,
        platform: dbSession?.platform || 'WhatsApp Web',
        connectedAt: dbSession?.connectedAt?.toISOString() || null,
        disconnectedAt: dbSession?.disconnectedAt?.toISOString() || null,
        savedInDb: !!dbSession,
      };
    }

    if (dbSession) {
      return {
        status: dbSession.status as 'DISCONNECTED' | 'SCAN_QR_CODE' | 'CONNECTED',
        qrCodeDataUrl: this.qrCodeDataUrl,
        phone: dbSession.phoneNumber,
        pushName: dbSession.pushname,
        platform: dbSession.platform,
        connectedAt: dbSession.connectedAt?.toISOString() || null,
        disconnectedAt: dbSession.disconnectedAt?.toISOString() || null,
        savedInDb: true,
      };
    }

    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      phone: this.phone,
      pushName: this.pushName,
      platform: 'WhatsApp Web',
      savedInDb: false,
    };
  }

  async connect(orgId?: string): Promise<WhatsAppStatusDto> {
    if (orgId) {
      this.activeOrgId = orgId;
      await this.saveSessionToDb(orgId, { status: 'SCAN_QR_CODE' });
    }

    if (this.status === 'CONNECTED' && this.client) {
      return this.getStatus(orgId);
    }

    if (this.isInitializing) {
      return this.getStatus(orgId);
    }

    this.isInitializing = true;
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;

    try {
      if (this.client) {
        await this.client.destroy().catch(() => undefined);
        this.client = null;
      }

      const chromePath =
        process.env.CHROME_BIN ||
        (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : undefined);

      this.logger.log(`Initializing WhatsApp Web client (Chrome: ${chromePath ?? 'bundled'})...`);

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
          headless: true,
          executablePath: chromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      this.client.on('qr', async (qr) => {
        this.logger.log('WhatsApp QR code received');
        try {
          this.qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 6 });
          this.status = 'SCAN_QR_CODE';
        } catch (err) {
          this.logger.error('Failed to generate QR code data URL', err);
        }
      });

      this.client.on('ready', async () => {
        this.logger.log('WhatsApp Web client connected and ready!');
        this.status = 'CONNECTED';
        this.qrCodeDataUrl = null;
        this.phone = this.client?.info?.wid?.user ?? null;
        this.pushName = this.client?.info?.pushname ?? null;

        if (this.activeOrgId) {
          await this.saveSessionToDb(this.activeOrgId, {
            status: 'CONNECTED',
            phoneNumber: this.phone,
            pushname: this.pushName,
            connectedAt: new Date(),
            platform: 'WhatsApp Web (Chrome)',
          });
        }
      });

      this.client.on('authenticated', async () => {
        this.logger.log('WhatsApp Web client authenticated');
        this.status = 'CONNECTED';
      });

      this.client.on('auth_failure', async (msg) => {
        this.logger.warn(`WhatsApp authentication failure: ${msg}`);
        this.status = 'DISCONNECTED';
        this.qrCodeDataUrl = null;
        if (this.activeOrgId) {
          await this.saveSessionToDb(this.activeOrgId, {
            status: 'DISCONNECTED',
            disconnectedAt: new Date(),
          });
        }
      });

      this.client.on('disconnected', async (reason) => {
        this.logger.log(`WhatsApp client disconnected: ${reason}`);
        this.status = 'DISCONNECTED';
        this.qrCodeDataUrl = null;
        this.phone = null;
        this.pushName = null;
        if (this.activeOrgId) {
          await this.saveSessionToDb(this.activeOrgId, {
            status: 'DISCONNECTED',
            disconnectedAt: new Date(),
          });
        }
      });

      // Start initialization in background so API does not hang
      void this.client.initialize().catch((err) => {
        this.logger.error('WhatsApp initialize error', err);
        this.status = 'DISCONNECTED';
        this.isInitializing = false;
      });

      return this.getStatus(orgId);
    } finally {
      this.isInitializing = false;
    }
  }

  async disconnect(orgId?: string): Promise<void> {
    const targetOrgId = orgId || this.activeOrgId;
    if (this.client) {
      try {
        await this.client.logout().catch(() => undefined);
        await this.client.destroy().catch(() => undefined);
      } catch (err) {
        this.logger.warn('Error during WhatsApp disconnect', err);
      }
      this.client = null;
    }
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.phone = null;
    this.pushName = null;

    if (targetOrgId) {
      await this.saveSessionToDb(targetOrgId, {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
      });
    }
  }

  async sendTextMessage(toPhone: string, message: string): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error('WhatsApp client is not connected. Please scan the QR code first.');
    }

    const clean = toPhone.replace(/\D/g, '');
    if (!clean) throw new Error(`Invalid phone number: ${toPhone}`);

    const chatId = `${clean}@c.us`;
    await this.client.sendMessage(chatId, message);
    return true;
  }

  generateDirectWebLink(phone: string, message: string): string {
    const clean = phone.replace(/\D/g, '');
    return `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as qrcode from 'qrcode';
import { Client, LocalAuth } from 'whatsapp-web.js';
import type { WhatsAppStatusDto } from '@mehwar/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: Client | null = null;
  private status: 'DISCONNECTED' | 'SCAN_QR_CODE' | 'CONNECTED' = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private isInitializing = false;
  private activeOrgId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      // Check if there is an active WhatsApp session to automatically restore
      const session = await this.prisma.whatsappSession.findFirst({
        where: { status: 'CONNECTED' },
      });
      if (session) {
        this.logger.log(`Found active WhatsApp session for org ${session.organizationId}. Auto-restoring connection...`);
        this.connect(session.organizationId).catch((err) => {
          this.logger.warn(`Failed to auto-restore WhatsApp connection: ${err.message}`);
        });
      }
    } catch (err) {
      this.logger.warn(`WhatsApp auto-restore check failed: ${err}`);
    }
  }

  async onModuleDestroy() {
    // Only close browser instance on reload, DO NOT logout or mark disconnected in DB
    if (this.client) {
      try {
        await this.client.destroy().catch(() => undefined);
      } catch {}
      this.client = null;
    }
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

      // Synchronize with channels table
      if (data.status === 'CONNECTED') {
        const phone = data.phoneNumber || this.phone || 'whatsapp-web';
        const displayName =
          data.pushname ||
          (data.phoneNumber ? `WhatsApp (+${data.phoneNumber})` : 'WhatsApp Web');
        await db.channel.upsert({
          where: {
            organizationId_platform_externalId: {
              organizationId: orgId,
              platform: 'whatsapp',
              externalId: phone,
            },
          },
          create: {
            organizationId: orgId,
            platform: 'whatsapp',
            externalId: phone,
            displayName,
            username: data.phoneNumber ?? null,
            status: 'ACTIVE',
            metadata: {
              platform: data.platform ?? 'WhatsApp Web',
              connectedAt: data.connectedAt ?? new Date(),
            },
          },
          update: {
            displayName,
            username: data.phoneNumber ?? null,
            status: 'ACTIVE',
            metadata: {
              platform: data.platform ?? 'WhatsApp Web',
              connectedAt: data.connectedAt ?? new Date(),
            },
          },
        });

        // Ensure all existing whatsapp channels for this org are marked ACTIVE
        await db.channel.updateMany({
          where: {
            organizationId: orgId,
            platform: 'whatsapp',
          },
          data: {
            status: 'ACTIVE',
          },
        });
      } else if (data.status === 'DISCONNECTED') {
        await db.channel.updateMany({
          where: {
            organizationId: orgId,
            platform: 'whatsapp',
          },
          data: {
            status: 'DISCONNECTED',
          },
        });
      }
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

        // Ensure active channel exists and all whatsapp channels in org are marked ACTIVE if session is connected
        if (dbSession?.status === 'CONNECTED') {
          await db.channel.updateMany({
            where: { organizationId: orgId, platform: 'whatsapp' },
            data: { status: 'ACTIVE' },
          });
        }
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

  private cleanStaleLocks() {
    try {
      const candidates = ['./.wwebjs_auth/session', './apps/api/.wwebjs_auth/session'];
      for (const dir of candidates) {
        if (fs.existsSync(dir)) {
          const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
          for (const f of lockFiles) {
            const p = `${dir}/${f}`;
            if (fs.existsSync(p)) {
              try {
                fs.rmSync(p, { force: true });
                this.logger.log(`Cleaned stale Chrome lock file: ${p}`);
              } catch (e) {
                this.logger.warn(`Could not remove lock file ${p}: ${e}`);
              }
            }
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Error checking stale locks: ${e}`);
    }
  }

  async connect(orgId?: string): Promise<WhatsAppStatusDto> {
    if (orgId) {
      this.activeOrgId = orgId;
      await this.saveSessionToDb(orgId, { status: 'SCAN_QR_CODE' });
    }

    if (this.status === 'CONNECTED' && this.client) {
      return this.getStatus(orgId);
    }

    if (this.isInitializing && this.status === 'SCAN_QR_CODE' && this.qrCodeDataUrl) {
      return this.getStatus(orgId);
    }

    this.isInitializing = true;
    this.status = 'SCAN_QR_CODE';
    this.qrCodeDataUrl = null;

    try {
      if (this.client) {
        await this.client.destroy().catch(() => undefined);
        this.client = null;
      }

      this.cleanStaleLocks();

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
          this.isInitializing = false;
        } catch (err) {
          this.logger.error('Failed to generate QR code data URL', err);
        }
      });

      this.client.on('ready', async () => {
        this.logger.log('WhatsApp Web client connected and ready!');
        this.status = 'CONNECTED';
        this.isInitializing = false;
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
        this.isInitializing = false;
      });

      this.client.on('auth_failure', async (msg) => {
        this.logger.warn(`WhatsApp authentication failure: ${msg}`);
        this.status = 'DISCONNECTED';
        this.isInitializing = false;
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
        this.isInitializing = false;
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

      // Start initialization
      void this.client.initialize().catch((err) => {
        this.logger.error('WhatsApp initialize error', err);
        this.status = 'DISCONNECTED';
        this.isInitializing = false;
      });

      // Wait up to 10 seconds for initial QR event before returning HTTP response
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000);
        const interval = setInterval(() => {
          if (this.qrCodeDataUrl || this.status === 'CONNECTED' || !this.isInitializing) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
          }
        }, 200);
      });

      return this.getStatus(orgId);
    } catch (err) {
      this.isInitializing = false;
      this.status = 'DISCONNECTED';
      throw err;
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
    this.isInitializing = false;
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

  /**
   * Updates WhatsApp profile bio / About status using client.setStatus(status).
   * Also attempts to broadcast a text status story when supported.
   */
  async setStatus(statusText: string): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error('WhatsApp client is not connected. Please scan the QR code in Settings first.');
    }

    try {
      // client.setStatus() updates the profile About / Bio text
      await this.client.setStatus(statusText);
      this.logger.log(`WhatsApp profile status successfully updated: "${statusText}"`);

      // Additionally, try posting to WhatsApp status broadcast (story) if supported
      try {
        await this.client.sendMessage('status@broadcast', statusText);
        this.logger.log('WhatsApp status broadcast story dispatched');
      } catch (broadcastErr) {
        this.logger.debug?.(`status@broadcast story not sent: ${broadcastErr}`);
      }

      return true;
    } catch (err) {
      this.logger.error('Failed to update WhatsApp profile status', err);
      throw err;
    }
  }

  /**
   * Publishes a post to WhatsApp based on the chosen action:
   * - STATUS: sets profile status / story
   * - MESSAGE: sends direct WhatsApp message to recipient or own number
   */
  async publishPostTarget(
    text: string,
    options?: { postType?: 'MESSAGE' | 'STATUS'; recipient?: string },
  ): Promise<{ externalId: string; url?: string }> {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error('WhatsApp client is not connected. Please pair WhatsApp Web in Settings.');
    }

    const type = options?.postType ?? 'STATUS';
    if (type === 'STATUS') {
      await this.setStatus(text);
      return {
        externalId: `wa-status-${Date.now()}`,
        url: 'https://web.whatsapp.com',
      };
    } else {
      const recipient = options?.recipient || this.phone;
      if (!recipient) {
        throw new Error('Recipient phone number required for WhatsApp direct message.');
      }
      await this.sendTextMessage(recipient, text);
      const clean = recipient.replace(/\D/g, '');
      return {
        externalId: `wa-msg-${Date.now()}`,
        url: `https://wa.me/${clean}`,
      };
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

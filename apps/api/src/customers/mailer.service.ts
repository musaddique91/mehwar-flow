import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../config';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.fromAddress = config.EMAIL_FROM || 'Mehwar Flow <noreply@mehwar.io>';
    try {
      if (config.SMTP_HOST) {
        this.transporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE ? config.SMTP_SECURE === 'true' : config.SMTP_PORT === 465,
          auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
        });
        this.logger.log(`MailerService initialized with SMTP host ${config.SMTP_HOST}:${config.SMTP_PORT}`);
      } else {
        const smtpUrl = config.SMTP_URL || 'smtp://localhost:1025';
        this.transporter = nodemailer.createTransport(smtpUrl);
        // Host only: the URL may carry credentials.
        this.logger.log(`MailerService initialized with SMTP: ${new URL(smtpUrl).host}`);
      }
    } catch (err) {
      this.logger.warn(`Could not initialize SMTP transport: ${err}`);
      this.transporter = null;
    }
  }

  async sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Cannot send email to ${opts.to}: mailer transporter is not configured`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}`, err);
      return false;
    }
  }
}

import { Module } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { MailerService } from './mailer.service';
import { ShareService } from './share.service';

@Module({
  imports: [WhatsAppModule],
  controllers: [CustomersController],
  providers: [CustomersService, MailerService, ShareService, NotificationsService],
  exports: [CustomersService, MailerService, ShareService],
})
export class CustomersModule {}

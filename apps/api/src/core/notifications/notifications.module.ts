import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailChannel } from './channels/email.channel';
import { WebhookChannel } from './channels/webhook.channel';

@Global()
@Module({
  providers: [NotificationsService, EmailChannel, WebhookChannel],
  exports: [NotificationsService],
})
export class NotificationsModule {}

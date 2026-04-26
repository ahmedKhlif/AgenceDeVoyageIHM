import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './email.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, EmailService],
  exports: [NotificationService],
})
export class NotificationModule {}

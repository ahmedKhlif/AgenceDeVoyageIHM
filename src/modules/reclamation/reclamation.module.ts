import { Module } from '@nestjs/common';
import { ReclamationService } from './reclamation.service';
import { ReclamationController } from './reclamation.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ReclamationController],
  providers: [ReclamationService],
  exports: [ReclamationService],
})
export class ReclamationModule {}

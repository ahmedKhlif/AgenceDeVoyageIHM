import { Module } from '@nestjs/common';
import { OffreService } from './offre.service';
import { OffreController } from './offre.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [OffreController],
  providers: [OffreService],
  exports: [OffreService],
})
export class OffreModule {}

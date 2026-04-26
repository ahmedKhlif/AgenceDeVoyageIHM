import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { BookingController } from './booking.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ReservationController, BookingController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}

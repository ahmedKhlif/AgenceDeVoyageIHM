import { Body, Controller, Post } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.reservationService.createBooking(dto);
  }
}

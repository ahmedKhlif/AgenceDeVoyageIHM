import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.reservationService.createBooking(dto);
  }

  @Get(':id/cancellation-preview')
  cancellationPreview(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.getCancellationPreview(id);
  }

  @Patch(':id/cancel')
  cancelBooking(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.cancelBooking(id);
  }
}

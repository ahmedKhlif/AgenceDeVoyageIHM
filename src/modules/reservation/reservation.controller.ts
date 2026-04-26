import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationService.create(dto);
  }

  @Get()
  findAll(
    @Query('accountId') accountId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const options = {
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      status: status as any,
      search,
    };

    if (accountId) return this.reservationService.findByAccount(+accountId, options);
    return this.reservationService.findAll(options);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReservationDto) {
    return this.reservationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.remove(id);
  }
}

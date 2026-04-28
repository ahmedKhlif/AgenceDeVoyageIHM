import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { OffreService } from './offre.service';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';

@Controller('offres')
export class OffreController {
  constructor(private readonly offreService: OffreService) {}

  @Post()
  create(@Body() dto: CreateOffreDto) {
    return this.offreService.create(dto);
  }

  @Get()
  findAll(@Query('active') active?: string, @Query('hotelId') hotelId?: string) {
    return this.offreService.findAll({
      active: active === undefined ? undefined : active === 'true',
      hotelId: hotelId ? Number.parseInt(hotelId, 10) : undefined,
    });
  }

  @Get('active')
  findActive() {
    return this.offreService.findActive();
  }

  @Get('hotel/:hotelId')
  findByHotel(@Param('hotelId', ParseIntPipe) hotelId: number) {
    return this.offreService.findByHotel(hotelId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.offreService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOffreDto) {
    return this.offreService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.offreService.remove(id);
  }
}

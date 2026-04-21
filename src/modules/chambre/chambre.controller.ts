import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ChambreService } from './chambre.service';
import { CreateChambreDto } from './dto/create-chambre.dto';
import { UpdateChambreDto } from './dto/update-chambre.dto';

@Controller('chambres')
export class ChambreController {
  constructor(private readonly chambreService: ChambreService) {}

  @Post()
  create(@Body() dto: CreateChambreDto) {
    return this.chambreService.create(dto);
  }

  @Get()
  findAll(@Query('hotelId') hotelId?: string) {
    if (hotelId) return this.chambreService.findByHotel(+hotelId);
    return this.chambreService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.chambreService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChambreDto) {
    return this.chambreService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chambreService.remove(id);
  }
}

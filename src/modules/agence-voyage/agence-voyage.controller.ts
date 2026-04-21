import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { AgenceVoyageService } from './agence-voyage.service';
import { CreateAgenceVoyageDto } from './dto/create-agence-voyage.dto';
import { UpdateAgenceVoyageDto } from './dto/update-agence-voyage.dto';

@Controller('agences-voyage')
export class AgenceVoyageController {
  constructor(private readonly agenceVoyageService: AgenceVoyageService) {}

  @Post()
  create(@Body() dto: CreateAgenceVoyageDto) {
    return this.agenceVoyageService.create(dto);
  }

  @Get()
  findAll() {
    return this.agenceVoyageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agenceVoyageService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgenceVoyageDto) {
    return this.agenceVoyageService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agenceVoyageService.remove(id);
  }
}

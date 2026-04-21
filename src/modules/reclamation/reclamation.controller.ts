import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ReclamationService } from './reclamation.service';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';

@Controller('reclamations')
export class ReclamationController {
  constructor(private readonly reclamationService: ReclamationService) {}

  @Post()
  create(@Body() dto: CreateReclamationDto) {
    return this.reclamationService.create(dto);
  }

  @Get()
  findAll() {
    return this.reclamationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reclamationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReclamationDto) {
    return this.reclamationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reclamationService.remove(id);
  }
}

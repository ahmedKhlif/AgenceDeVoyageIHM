import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { AvisService } from './avis.service';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';

@Controller('avis')
export class AvisController {
  constructor(private readonly avisService: AvisService) {}

  @Post()
  create(@Body() dto: CreateAvisDto) {
    return this.avisService.create(dto);
  }

  @Get()
  findAll() {
    return this.avisService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.avisService.findOne(id);
  }

  @Get('hotel/:hotelId')
  findByHotel(@Param('hotelId', ParseIntPipe) hotelId: number) {
    return this.avisService.findByHotel(hotelId);
  }

  @Get('account/:accountId')
  findByAccount(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.avisService.findByAccount(accountId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAvisDto) {
    return this.avisService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.avisService.remove(id);
  }
}

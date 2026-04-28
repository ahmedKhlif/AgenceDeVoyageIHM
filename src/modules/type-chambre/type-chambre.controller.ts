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
import { TypeChambreService } from './type-chambre.service';
import { CreateTypeChambreDto } from './dto/create-type-chambre.dto';
import { UpdateTypeChambreDto } from './dto/update-type-chambre.dto';

@Controller('types-chambre')
export class TypeChambreController {
  constructor(private readonly typeChambreService: TypeChambreService) {}

  @Post()
  create(@Body() dto: CreateTypeChambreDto) {
    return this.typeChambreService.create(dto);
  }

  @Get()
  findAll() {
    return this.typeChambreService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.typeChambreService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTypeChambreDto,
  ) {
    return this.typeChambreService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.typeChambreService.remove(id);
  }
}

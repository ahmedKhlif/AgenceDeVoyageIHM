import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ConditionAnnulationService } from './condition-annulation.service';
import { CreateConditionAnnulationDto } from './dto/create-condition-annulation.dto';
import { UpdateConditionAnnulationDto } from './dto/update-condition-annulation.dto';

@Controller('conditions-annulation')
export class ConditionAnnulationController {
  constructor(private readonly conditionAnnulationService: ConditionAnnulationService) {}

  @Post()
  create(@Body() dto: CreateConditionAnnulationDto) {
    return this.conditionAnnulationService.create(dto);
  }

  @Get()
  findAll() {
    return this.conditionAnnulationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.conditionAnnulationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateConditionAnnulationDto) {
    return this.conditionAnnulationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.conditionAnnulationService.remove(id);
  }
}

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
import { SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Post()
  create(@Body() dto: CreateSystemConfigDto) {
    return this.systemConfigService.create(dto);
  }

  @Get()
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Get(':cle')
  findByCle(@Param('cle') cle: string) {
    return this.systemConfigService.findByCle(cle);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    return this.systemConfigService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.systemConfigService.remove(id);
  }
}

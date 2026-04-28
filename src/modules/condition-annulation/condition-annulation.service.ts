import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConditionAnnulationDto } from './dto/create-condition-annulation.dto';
import { UpdateConditionAnnulationDto } from './dto/update-condition-annulation.dto';

@Injectable()
export class ConditionAnnulationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateConditionAnnulationDto) {
    return this.prisma.conditionAnnulation.create({ data: dto });
  }

  findAll() {
    return this.prisma.conditionAnnulation.findMany({
      include: { systemConfig: true },
    });
  }

  findOne(id: number) {
    return this.prisma.conditionAnnulation.findUnique({
      where: { id },
      include: { systemConfig: true },
    });
  }

  update(id: number, dto: UpdateConditionAnnulationDto) {
    return this.prisma.conditionAnnulation.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.conditionAnnulation.delete({ where: { id } });
  }
}

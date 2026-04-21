import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSystemConfigDto) {
    return this.prisma.systemConfig.create({ data: dto });
  }

  findAll() {
    return this.prisma.systemConfig.findMany({ include: { conditionsAnnulation: true } });
  }

  findByCle(cle: string) {
    return this.prisma.systemConfig.findUnique({ where: { cle } });
  }

  update(id: number, dto: UpdateSystemConfigDto) {
    return this.prisma.systemConfig.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.systemConfig.delete({ where: { id } });
  }
}

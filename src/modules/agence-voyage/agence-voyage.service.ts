import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgenceVoyageDto } from './dto/create-agence-voyage.dto';
import { UpdateAgenceVoyageDto } from './dto/update-agence-voyage.dto';

@Injectable()
export class AgenceVoyageService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAgenceVoyageDto) {
    return this.prisma.agenceVoyage.create({ data: dto });
  }

  findAll() {
    return this.prisma.agenceVoyage.findMany({ include: { hotels: true } });
  }

  findOne(id: number) {
    return this.prisma.agenceVoyage.findUnique({
      where: { id },
      include: { hotels: true, reclamations: true },
    });
  }

  update(id: number, dto: UpdateAgenceVoyageDto) {
    return this.prisma.agenceVoyage.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.agenceVoyage.delete({ where: { id } });
  }
}

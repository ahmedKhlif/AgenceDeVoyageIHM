import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';

@Injectable()
export class OffreService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateOffreDto) {
    return this.prisma.offre.create({ data: dto });
  }

  findAll() {
    return this.prisma.offre.findMany({ include: { hotel: true, chambres: { include: { chambre: true } } } });
  }

  findOne(id: number) {
    return this.prisma.offre.findUnique({
      where: { id },
      include: { hotel: true, chambres: { include: { chambre: true } } },
    });
  }

  update(id: number, dto: UpdateOffreDto) {
    return this.prisma.offre.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.offre.delete({ where: { id } });
  }
}

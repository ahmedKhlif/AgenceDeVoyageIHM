import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTypeChambreDto } from './dto/create-type-chambre.dto';
import { UpdateTypeChambreDto } from './dto/update-type-chambre.dto';

@Injectable()
export class TypeChambreService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTypeChambreDto) {
    return this.prisma.typeChambre.create({ data: dto });
  }

  findAll() {
    return this.prisma.typeChambre.findMany();
  }

  findOne(id: number) {
    return this.prisma.typeChambre.findUnique({ where: { id } });
  }

  update(id: number, dto: UpdateTypeChambreDto) {
    return this.prisma.typeChambre.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.typeChambre.delete({ where: { id } });
  }
}

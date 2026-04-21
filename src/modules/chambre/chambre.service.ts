import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChambreDto } from './dto/create-chambre.dto';
import { UpdateChambreDto } from './dto/update-chambre.dto';

@Injectable()
export class ChambreService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateChambreDto) {
    return this.prisma.chambre.create({ data: dto, include: { typeChambre: true } });
  }

  findAll() {
    return this.prisma.chambre.findMany({ include: { typeChambre: true, hotel: true } });
  }

  findOne(id: number) {
    return this.prisma.chambre.findUnique({
      where: { id },
      include: { typeChambre: true, hotel: true, reservations: true },
    });
  }

  findByHotel(hotelId: number) {
    return this.prisma.chambre.findMany({
      where: { hotelId },
      include: { typeChambre: true },
    });
  }

  update(id: number, dto: UpdateChambreDto) {
    return this.prisma.chambre.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.chambre.delete({ where: { id } });
  }
}

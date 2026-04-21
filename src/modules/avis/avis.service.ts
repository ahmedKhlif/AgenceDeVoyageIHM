import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';

@Injectable()
export class AvisService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAvisDto) {
    return this.prisma.avis.create({ data: dto });
  }

  findAll() {
    return this.prisma.avis.findMany({ include: { reservation: true } });
  }

  findOne(id: number) {
    return this.prisma.avis.findUnique({
      where: { id },
      include: { reservation: true },
    });
  }

  findByReservation(reservationId: number) {
    return this.prisma.avis.findMany({ where: { reservationId } });
  }

  findByHotel(hotelId: number) {
    return this.prisma.avis.findMany({
      where: { reservation: { chambre: { hotelId } } },
      include: { reservation: true },
    });
  }

  findByAccount(accountId: number) {
    return this.prisma.avis.findMany({
      where: { reservation: { accountId } },
      include: { reservation: true },
    });
  }

  update(id: number, dto: UpdateAvisDto) {
    return this.prisma.avis.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.avis.delete({ where: { id } });
  }
}

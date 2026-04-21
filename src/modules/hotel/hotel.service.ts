import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHotelDto) {
    return this.prisma.hotel.create({ data: dto });
  }

  findAll() {
    return this.prisma.hotel.findMany({ include: { chambres: true, offres: true } });
  }

  findOne(id: number) {
    return this.prisma.hotel.findUnique({
      where: { id },
      include: { chambres: { include: { typeChambre: true } }, offres: true },
    });
  }

  update(id: number, dto: UpdateHotelDto) {
    return this.prisma.hotel.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.hotel.delete({ where: { id } });
  }
}

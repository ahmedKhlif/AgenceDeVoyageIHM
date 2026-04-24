import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';

@Injectable()
export class AvisService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAvisDto) {
    const { reservationId, hotelId, accountId, ...rest } = dto;
    return this.prisma.avis.create({
      data: {
        ...rest,
        accountId,
        ...(reservationId != null && {
          reservation: { connect: { id: reservationId } },
        }),
        ...(hotelId != null && {
          hotel: { connect: { id: hotelId } },
        }),
      },
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });
  }

  findAll() {
    return this.prisma.avis.findMany({
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.avis.findUnique({
      where: { id },
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });
  }

  findByReservation(reservationId: number) {
    return this.prisma.avis.findMany({ where: { reservationId } });
  }

  findByHotel(hotelId: number) {
    return this.prisma.avis.findMany({
      where: {
        OR: [{ reservation: { chambre: { hotelId } } }, { hotelId }],
      },
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });
  }

  findByAccount(accountId: number) {
    return this.prisma.avis.findMany({
      where: { reservation: { accountId } },
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });
  }

  update(id: number, dto: UpdateAvisDto) {
    return this.prisma.avis.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.avis.delete({ where: { id } });
  }
}

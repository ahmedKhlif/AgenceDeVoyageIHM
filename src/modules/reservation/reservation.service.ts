import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { StatutReservation } from '@prisma/client';

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReservationDto) {
    return this.prisma.reservation.create({
      data: dto,
      include: { account: true, chambre: true },
    });
  }

  findAll() {
    return this.prisma.reservation.findMany({
      include: { account: { include: { profile: true } }, chambre: true },
    });
  }

  findOne(id: number) {
    return this.prisma.reservation.findUnique({
      where: { id },
      include: {
        account: { include: { profile: true } },
        chambre: { include: { hotel: true, typeChambre: true } },
        avis: true,
        reclamations: true,
      },
    });
  }

  findByAccount(accountId: number) {
    return this.prisma.reservation.findMany({
      where: { accountId },
      include: { chambre: { include: { hotel: true } } },
    });
  }

  update(id: number, dto: UpdateReservationDto) {
    return this.prisma.reservation.update({ where: { id }, data: dto });
  }

  updateStatut(id: number, statut: StatutReservation, motifBlocage?: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { statut, ...(motifBlocage ? { motifBlocage } : {}) },
    });
  }

  remove(id: number) {
    return this.prisma.reservation.delete({ where: { id } });
  }
}

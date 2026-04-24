import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly blockingStatuses = [
    StatutReservation.EN_ATTENTE,
    StatutReservation.CONFIRMEE,
    StatutReservation.BLOQUEE,
    StatutReservation.TERMINEE,
  ];

  private parseDateInput(value: string) {
    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return parsed;
  }

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

  async findAvailable(filters: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    rooms?: number;
  }) {
    const guests = Number.isFinite(filters.guests) ? Math.max(1, filters.guests ?? 1) : 1;
    const rooms = Number.isFinite(filters.rooms) ? Math.max(1, filters.rooms ?? 1) : 1;
    const capacityPerRoom = Math.max(1, Math.ceil(guests / rooms));
    const hasCheckIn = Boolean(filters.checkIn);
    const hasCheckOut = Boolean(filters.checkOut);

    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException('checkIn and checkOut must be provided together');
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (filters.checkIn && filters.checkOut) {
      startDate = this.parseDateInput(filters.checkIn);
      endDate = this.parseDateInput(filters.checkOut);

      if (endDate <= startDate) {
        throw new BadRequestException('checkOut must be after checkIn');
      }
    }

    const hotels = await this.prisma.hotel.findMany({
      where: {
        actif: true,
        ...(filters.city
          ? {
              ville: {
                equals: filters.city,
                mode: 'insensitive',
              },
            }
          : {}),
        chambres: {
          some: {
            disponible: true,
            capacite: { gte: capacityPerRoom },
          },
        },
      },
      include: {
        chambres: {
          include: {
            typeChambre: true,
            reservations:
              startDate && endDate
                ? {
                    where: {
                      statut: { in: this.blockingStatuses },
                      dateArrivee: { lt: endDate },
                      dateDepart: { gt: startDate },
                    },
                  }
                : {
                    where: {
                      statut: { in: this.blockingStatuses },
                    },
                  },
          },
        },
        offres: true,
      },
    });

    return hotels
      .map((hotel) => {
        const chambresDisponibles = hotel.chambres.filter((chambre) => {
          if (!chambre.disponible || chambre.capacite < capacityPerRoom) {
            return false;
          }

          if (!startDate || !endDate) {
            return true;
          }

          return chambre.reservations.length === 0;
        });

        return {
          ...hotel,
          chambres: chambresDisponibles,
        };
      })
      .filter((hotel) => hotel.chambres.length >= rooms);
  }

  update(id: number, dto: UpdateHotelDto) {
    return this.prisma.hotel.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.hotel.delete({ where: { id } });
  }

  /** Returns cities with active hotel counts, ordered by count descending */
  async getDestinations(): Promise<{ ville: string; count: number }[]> {
    const cities = await this.prisma.hotel.groupBy({
      by: ['ville'],
      where: { actif: true },
      _count: { _all: true },
      orderBy: { _count: { ville: 'desc' } },
    });
    return cities.map((c) => ({ ville: c.ville, count: c._count._all }));
  }
}

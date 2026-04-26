import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly cityTaxPerNight = 5;

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

  private differenceInNights(checkIn: Date, checkOut: Date) {
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.round(diffInMs / (1000 * 60 * 60 * 24)));
  }

  create(dto: CreateHotelDto) {
    return this.prisma.hotel.create({ data: dto });
  }

  async findAll(options?: { page?: number; limit?: number }) {
    const hasPagination =
      Number.isFinite(options?.page) &&
      Number.isFinite(options?.limit) &&
      (options?.page ?? 0) > 0 &&
      (options?.limit ?? 0) > 0;

    if (!hasPagination) {
      return this.prisma.hotel.findMany({ include: { chambres: true, offres: true } });
    }

    const page = options!.page!;
    const limit = options!.limit!;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.hotel.findMany({
        include: { chambres: true, offres: true },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.hotel.count(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  findOne(id: number) {
    return this.prisma.hotel.findUnique({
      where: { id },
      include: { chambres: { include: { typeChambre: true } }, offres: true },
    });
  }

  async checkAvailability(id: number, dto: CheckAvailabilityDto) {
    const checkIn = this.parseDateInput(dto.checkIn);
    const checkOut = this.parseDateInput(dto.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const adults = Number.isFinite(dto.adults) ? Math.max(1, dto.adults) : 1;
    const children = Number.isFinite(dto.children) ? Math.max(0, dto.children) : 0;
    const totalGuests = adults + children;

    if (totalGuests < 1) {
      throw new BadRequestException('At least one guest is required');
    }

    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: {
        chambres: {
          include: {
            typeChambre: true,
            reservations: {
              where: {
                statut: { in: this.blockingStatuses },
                dateArrivee: { lt: checkOut },
                dateDepart: { gt: checkIn },
              },
            },
          },
        },
      },
    });

    if (!hotel || !hotel.actif) {
      throw new BadRequestException('Hotel not found');
    }

    const matchingRooms = hotel.chambres
      .filter(
        (room) =>
          room.disponible &&
          room.capacite >= totalGuests &&
          room.reservations.length === 0,
      )
      .map((room) => ({
        id: room.id,
        hotelId: room.hotelId,
        title: room.typeChambre?.libelle ?? `Room ${room.numero}`,
        maxGuests: room.capacite,
        bedType: room.typeChambre?.description?.trim() || '1 King Size Bed',
        roomSize: Math.round(room.typeChambre?.superficieM2 ?? 32),
        pricePerNight: room.prixParNuit,
        image:
          room.photos?.[0] ||
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80',
      }))
      .sort((a, b) => a.pricePerNight - b.pricePerNight);

    const nights = this.differenceInNights(checkIn, checkOut);
    const selectedPricePerNight = matchingRooms[0]?.pricePerNight ?? 0;
    const basePrice = selectedPricePerNight * nights;
    const cityTax = this.cityTaxPerNight * nights;
    const total = basePrice + cityTax;

    return {
      available: matchingRooms.length > 0,
      nights,
      basePrice,
      cityTax,
      total,
      rooms: matchingRooms,
      selectedPricePerNight,
      guests: {
        adults,
        children,
        total: totalGuests,
      },
    };
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

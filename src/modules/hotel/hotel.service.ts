import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class HotelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {}
  private readonly cityTaxPerNight = 5;

  private readonly blockingStatuses = [
    StatutReservation.EN_ATTENTE,
    StatutReservation.CONFIRMEE,
    StatutReservation.BLOQUEE,
    StatutReservation.TERMINEE,
  ];

  private parseDateInput(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException('Invalid date format');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid date format');
    }

    return parsed;
  }

  private differenceInNights(checkIn: Date, checkOut: Date) {
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.round(diffInMs / (1000 * 60 * 60 * 24)));
  }

  async create(dto: CreateHotelDto) {
    const agency = await this.prisma.agenceVoyage.findUnique({
      where: { id: dto.agenceVoyageId },
      select: { id: true, actif: true },
    });

    if (!agency) {
      throw new BadRequestException('Invalid agenceVoyageId: agency not found');
    }

    if (!agency.actif) {
      throw new BadRequestException('Selected agency is inactive');
    }

    const hotel = await this.prisma.hotel.create({ data: dto });

    await this.notificationService.notifyNewHotel({
      id: hotel.id,
      nom: hotel.nom,
      ville: hotel.ville,
    });

    try {
      await this.mailService.sendTemplate({
        to: await this.mailService.getSupportEmail(),
        templateSlug: 'ops.new-hotel-alert',
        tokens: {
          hotel_name: hotel.nom,
          city: hotel.ville,
          hotel_email: hotel.email,
          hotel_phone: hotel.telephone,
        },
        actionLabel: 'Open admin',
        actionUrl: `${this.mailService.getAppWebUrl()}/admin/hotels`,
        fallbackSubject: `New hotel onboarded: ${hotel.nom}`,
        fallbackBody: `A new hotel was added in ${hotel.ville}.`,
      });
    } catch {
      // Hotel creation should not fail because an internal alert could not be delivered.
    }

    return hotel;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    ids?: number[];
    minPrice?: number;
    maxPrice?: number;
    stars?: number[];
    search?: string;
    sortBy?: string;
  }): Promise<any> {
    const hasPagination =
      Number.isFinite(options?.page) &&
      Number.isFinite(options?.limit) &&
      (options?.page ?? 0) > 0 &&
      (options?.limit ?? 0) > 0;

    const where: any = {};

    if (options?.ids && options.ids.length > 0) {
      where.id = { in: options.ids };
    }
    if (options?.stars && options.stars.length > 0) {
      where.etoiles = { in: options.stars };
    }
    if (options?.search) {
      where.OR = [
        { nom: { contains: options.search, mode: 'insensitive' } },
        { ville: { contains: options.search, mode: 'insensitive' } },
        { pays: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (
      Number.isFinite(options?.minPrice) ||
      Number.isFinite(options?.maxPrice)
    ) {
      where.chambres = {
        some: {
          prixParNuit: {
            ...(Number.isFinite(options?.minPrice) && {
              gte: options!.minPrice,
            }),
            ...(Number.isFinite(options?.maxPrice) && {
              lte: options!.maxPrice,
            }),
          },
        },
      };
    }

    const orderBy: any =
      options?.sortBy === 'note' ? { etoiles: 'desc' } : { id: 'desc' };

    if (!hasPagination) {
      return this.prisma.hotel.findMany({
        where,
        include: { chambres: true, offres: true },
        orderBy,
      });
    }

    const page = options!.page!;
    const limit = options!.limit!;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        include: { chambres: true, offres: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.hotel.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { items, total, page, limit, totalPages };
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
    const children = Number.isFinite(dto.children)
      ? Math.max(0, dto.children)
      : 0;
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
          room.capacite >= totalGuests && room.reservations.length === 0,
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
      guests: { adults, children, total: totalGuests },
    };
  }

  async findAvailable(filters: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    rooms?: number;
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    stars?: number[];
    search?: string;
    sortBy?: string;
  }): Promise<any> {
    const guests = Number.isFinite(filters.guests)
      ? Math.max(1, filters.guests ?? 1)
      : 1;
    const rooms = Number.isFinite(filters.rooms)
      ? Math.max(1, filters.rooms ?? 1)
      : 1;
    const capacityPerRoom = Math.max(1, Math.ceil(guests / rooms));
    const hasCheckIn = Boolean(filters.checkIn);
    const hasCheckOut = Boolean(filters.checkOut);

    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException(
        'checkIn and checkOut must be provided together',
      );
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

    const where: any = {
      actif: true,
    };

    if (filters.city) {
      where.ville = { equals: filters.city, mode: 'insensitive' };
    }
    if (filters.stars && filters.stars.length > 0) {
      where.etoiles = { in: filters.stars };
    }
    if (filters.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { ville: { contains: filters.search, mode: 'insensitive' } },
        { pays: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const chambreWhere: any = {
      capacite: { gte: capacityPerRoom },
    };
    if (
      Number.isFinite(filters.minPrice) ||
      Number.isFinite(filters.maxPrice)
    ) {
      chambreWhere.prixParNuit = {
        ...(Number.isFinite(filters.minPrice) && { gte: filters.minPrice }),
        ...(Number.isFinite(filters.maxPrice) && { lte: filters.maxPrice }),
      };
    }
    where.chambres = { some: chambreWhere };

    const hotels = await this.prisma.hotel.findMany({
      where,
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

    const availableHotels = hotels
      .map((hotel) => {
        const chambresDisponibles = hotel.chambres.filter((chambre) => {
          if (chambre.capacite < capacityPerRoom) return false;
          if (!startDate || !endDate) return true;
          return chambre.reservations.length === 0;
        });
        return { ...hotel, chambres: chambresDisponibles };
      })
      .filter((hotel) => hotel.chambres.length >= rooms);

    if (filters.sortBy === 'note') {
      availableHotels.sort((a, b) => b.etoiles - a.etoiles);
    } else {
      availableHotels.sort((a, b) => b.id - a.id);
    }

    const hasPagination =
      Number.isFinite(filters.page) &&
      Number.isFinite(filters.limit) &&
      (filters.page ?? 0) > 0 &&
      (filters.limit ?? 0) > 0;

    if (!hasPagination) {
      return availableHotels;
    }

    const page = filters.page!;
    const limit = filters.limit!;
    const total = availableHotels.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = availableHotels.slice((page - 1) * limit, page * limit);

    return { items, total, page, limit, totalPages };
  }

  async update(id: number, dto: UpdateHotelDto) {
    if (dto.agenceVoyageId !== undefined) {
      const agency = await this.prisma.agenceVoyage.findUnique({
        where: { id: dto.agenceVoyageId },
        select: { id: true, actif: true },
      });

      if (!agency) {
        throw new BadRequestException(
          'Invalid agenceVoyageId: agency not found',
        );
      }

      if (!agency.actif) {
        throw new BadRequestException('Selected agency is inactive');
      }
    }

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

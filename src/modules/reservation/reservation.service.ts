import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { StatutReservation } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly cityTaxPerNight = 5;
  private readonly blockingStatuses = [
    StatutReservation.EN_ATTENTE,
    StatutReservation.CONFIRMEE,
    StatutReservation.BLOQUEE,
    StatutReservation.TERMINEE,
  ];

  private parseDateInput(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private differenceInNights(checkIn: Date, checkOut: Date) {
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.round(diffInMs / (1000 * 60 * 60 * 24)));
  }

  private generateBookingReference() {
    const year = new Date().getFullYear();
    const randomChunk = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `VH-${year}-${randomChunk}`;
  }

  create(dto: CreateReservationDto) {
    return this.prisma.reservation.create({
      data: dto,
      include: { account: true, chambre: true },
    });
  }

  async createBooking(dto: CreateBookingDto) {
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

    const account =
      dto.accountId != null
        ? await this.prisma.account.findUnique({
            where: { id: dto.accountId },
            include: { profile: true },
          })
        : await this.prisma.account.findUnique({
            where: { email: dto.email.trim().toLowerCase() },
            include: { profile: true },
          });

    if (!account || !account.actif) {
      throw new BadRequestException('Please sign in before confirming this reservation');
    }

    const room = await this.prisma.chambre.findFirst({
      where: {
        id: dto.roomId,
        hotelId: dto.hotelId,
        disponible: true,
        hotel: { actif: true },
      },
      include: {
        hotel: true,
        typeChambre: true,
        reservations: {
          where: {
            statut: { in: this.blockingStatuses },
            dateArrivee: { lt: checkOut },
            dateDepart: { gt: checkIn },
          },
        },
      },
    });

    if (!room) {
      throw new BadRequestException('Room not found for this hotel');
    }

    if (room.capacite < totalGuests) {
      throw new BadRequestException('Selected room cannot host this number of guests');
    }

    if (room.reservations.length > 0) {
      throw new ConflictException('This room is no longer available');
    }

    const nights = this.differenceInNights(checkIn, checkOut);
    const roomPrice = room.prixParNuit * nights;
    const taxes = this.cityTaxPerNight * nights;
    const total = roomPrice + taxes;
    const bookingReference = this.generateBookingReference();

    const reservation = await this.prisma.reservation.create({
      data: {
        accountId: account.id,
        chambreId: room.id,
        dateArrivee: checkIn,
        dateDepart: checkOut,
        nombrePersonnes: totalGuests,
        nombreNuits: nights,
        montantTotal: total,
        codeConfirmation: bookingReference,
        statut: StatutReservation.CONFIRMEE,
      },
      include: {
        chambre: { include: { hotel: true, typeChambre: true } },
      },
    });

    if (account.profile) {
      const trimmedName = dto.fullName.trim();
      const [prenom, ...nomParts] = trimmedName.split(/\s+/).filter(Boolean);
      const nom = nomParts.join(' ').trim();

      await this.prisma.profile.update({
        where: { accountId: account.id },
        data: {
          ...(prenom ? { prenom } : {}),
          ...(nom ? { nom } : {}),
          telephone: dto.phone.trim(),
        },
      });
    }

    return {
      confirmed: true,
      bookingReference: reservation.codeConfirmation,
      bookingId: reservation.id,
      hotelName: reservation.chambre.hotel.nom,
      roomName:
        reservation.chambre.typeChambre?.libelle ?? `Room ${reservation.chambre.numero}`,
      checkIn: reservation.dateArrivee,
      checkOut: reservation.dateDepart,
      nights: reservation.nombreNuits,
      guests: {
        adults,
        children,
        total: totalGuests,
      },
      pricing: {
        roomPrice,
        taxes,
        total,
      },
      contact: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        specialRequests: dto.specialRequests ?? null,
      },
    };
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

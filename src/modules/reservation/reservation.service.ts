import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { StatutReservation } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';

type CancellationEvaluation = {
  allowed: boolean;
  policyLabel: string;
  policyDescription: string;
  freeCancellationUntil: Date | null;
  refundType: 'FULL' | 'PARTIAL' | 'NONE';
  refundAmount: number;
  chargeAmount: number;
  totalPaid: number;
  reason?: string;
};

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

  private evaluateCancellationPolicy(input: {
    status: StatutReservation;
    checkInDate: Date;
    totalPaid: number;
    roomPricePerNight: number;
    now: Date;
    policy?: {
      delaiLimiteHeures: number;
      fraisAnnulation: number;
      remboursementTotal: boolean;
      description?: string | null;
    } | null;
  }): CancellationEvaluation {
    const { status, checkInDate, totalPaid, roomPricePerNight, now, policy } = input;
    const nowMs = now.getTime();
    const checkInMs = checkInDate.getTime();
    const isPastStart = nowMs >= checkInMs;
    const isAlreadyCancelled = [StatutReservation.ANNULEE, StatutReservation.REFUSEE].includes(
      status,
    );
    const isClosedReservation = status === StatutReservation.TERMINEE;

    if (isAlreadyCancelled) {
      return {
        allowed: false,
        policyLabel: 'Booking already cancelled',
        policyDescription: 'This reservation has already been cancelled and cannot be modified.',
        freeCancellationUntil: null,
        refundType: 'NONE',
        refundAmount: 0,
        chargeAmount: 0,
        totalPaid,
        reason: 'Reservation is already cancelled',
      };
    }

    if (isClosedReservation || isPastStart) {
      return {
        allowed: false,
        policyLabel: 'Cancellation window closed',
        policyDescription: 'This reservation can no longer be cancelled because the stay has started.',
        freeCancellationUntil: null,
        refundType: 'NONE',
        refundAmount: 0,
        chargeAmount: totalPaid,
        totalPaid,
        reason: 'Cancellation deadline has passed',
      };
    }

    const defaultHours = 48;
    const deadlineHours = policy?.delaiLimiteHeures ?? defaultHours;
    const freeCancellationUntil = new Date(checkInDate.getTime() - deadlineHours * 60 * 60 * 1000);
    const beforeDeadline = nowMs <= freeCancellationUntil.getTime();

    if (beforeDeadline) {
      return {
        allowed: true,
        policyLabel: `Free cancellation before ${freeCancellationUntil.toISOString()}`,
        policyDescription:
          policy?.description?.trim() ||
          `Free cancellation is available up to ${deadlineHours} hours before check-in.`,
        freeCancellationUntil,
        refundType: 'FULL',
        refundAmount: totalPaid,
        chargeAmount: 0,
        totalPaid,
      };
    }

    const configuredPenalty = Math.max(0, policy?.fraisAnnulation ?? roomPricePerNight);
    const effectivePenalty = Math.min(totalPaid, configuredPenalty || roomPricePerNight);
    const refundAmount = Math.max(0, totalPaid - effectivePenalty);

    return {
      allowed: true,
      policyLabel: `After ${freeCancellationUntil.toISOString()}, cancellation charges apply`,
      policyDescription:
        policy?.description?.trim() ||
        'After the free cancellation deadline, the first night is charged.',
      freeCancellationUntil,
      refundType: refundAmount <= 0 ? 'NONE' : 'PARTIAL',
      refundAmount,
      chargeAmount: totalPaid - refundAmount,
      totalPaid,
    };
  }

  private async getReservationWithRelations(id: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        chambre: { include: { hotel: true, typeChambre: true } },
        account: { include: { profile: true } },
      },
    });

    if (!reservation) {
      throw new BadRequestException('Booking not found');
    }

    return reservation;
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

  async getCancellationPreview(id: number) {
    const reservation = await this.getReservationWithRelations(id);
    const policy = await this.prisma.conditionAnnulation.findFirst({
      orderBy: { delaiLimiteHeures: 'desc' },
    });
    const now = new Date();
    const evaluation = this.evaluateCancellationPolicy({
      status: reservation.statut,
      checkInDate: reservation.dateArrivee,
      totalPaid: reservation.montantTotal,
      roomPricePerNight: reservation.chambre.prixParNuit,
      now,
      policy,
    });

    return {
      bookingId: reservation.id,
      bookingReference: reservation.codeConfirmation,
      hotelName: reservation.chambre.hotel.nom,
      roomName:
        reservation.chambre.typeChambre?.libelle ?? `Room ${reservation.chambre.numero}`,
      stay: {
        checkIn: reservation.dateArrivee,
        checkOut: reservation.dateDepart,
        nights: reservation.nombreNuits,
      },
      cancellationAllowed: evaluation.allowed,
      cancellationDeadline: evaluation.freeCancellationUntil,
      policy: {
        label: evaluation.policyLabel,
        description: evaluation.policyDescription,
      },
      refund: {
        type: evaluation.refundType,
        amount: evaluation.refundAmount,
        chargeAmount: evaluation.chargeAmount,
        totalPaid: evaluation.totalPaid,
      },
      reason: evaluation.reason ?? null,
    };
  }

  async cancelBooking(id: number) {
    const reservation = await this.getReservationWithRelations(id);
    const policy = await this.prisma.conditionAnnulation.findFirst({
      orderBy: { delaiLimiteHeures: 'desc' },
    });
    const now = new Date();
    const evaluation = this.evaluateCancellationPolicy({
      status: reservation.statut,
      checkInDate: reservation.dateArrivee,
      totalPaid: reservation.montantTotal,
      roomPricePerNight: reservation.chambre.prixParNuit,
      now,
      policy,
    });

    if (!evaluation.allowed) {
      throw new BadRequestException(
        evaluation.reason || 'This reservation cannot be cancelled at this time',
      );
    }

    const cancellationTimestamp = now.toISOString();
    const cancellationNote = `Cancelled on ${cancellationTimestamp}; refund=${evaluation.refundAmount.toFixed(2)}; charge=${evaluation.chargeAmount.toFixed(2)}`;

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        statut: StatutReservation.ANNULEE,
        motifBlocage: cancellationNote,
      },
      include: {
        chambre: { include: { hotel: true, typeChambre: true } },
      },
    });

    return {
      cancelled: true,
      bookingId: updated.id,
      bookingReference: updated.codeConfirmation,
      cancellationDate: cancellationTimestamp,
      hotelName: updated.chambre.hotel.nom,
      roomName: updated.chambre.typeChambre?.libelle ?? `Room ${updated.chambre.numero}`,
      stay: {
        checkIn: updated.dateArrivee,
        checkOut: updated.dateDepart,
        nights: updated.nombreNuits,
      },
      refund: {
        type: evaluation.refundType,
        amount: evaluation.refundAmount,
        chargeAmount: evaluation.chargeAmount,
        totalPaid: evaluation.totalPaid,
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

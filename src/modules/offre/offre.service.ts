import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OffreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly includeOfferRelations = {
    hotel: {
      include: {
        chambres: {
          select: { photos: true },
          take: 3,
        },
      },
    },
    chambres: { include: { chambre: true } },
  } satisfies Prisma.OffreInclude;

  private parseOfferDate(value: string, field: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} is not a valid date`);
    }

    return parsed;
  }

  private assertValidDateRange(dateDebut?: string, dateFin?: string) {
    if (!dateDebut || !dateFin) return;

    const start = this.parseOfferDate(dateDebut, 'dateDebut');
    const end = this.parseOfferDate(dateFin, 'dateFin');

    if (end <= start) {
      throw new BadRequestException('dateFin must be after dateDebut');
    }
  }

  private async assertHotelExists(hotelId: number) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, actif: true },
    });

    if (!hotel) {
      throw new BadRequestException('Invalid hotelId: hotel not found');
    }

    if (!hotel.actif) {
      throw new BadRequestException('Cannot create an offer for an inactive hotel');
    }
  }

  private async assertRoomsBelongToHotel(hotelId: number, chambreIds?: number[]) {
    if (!chambreIds?.length) return;

    const uniqueRoomIds = [...new Set(chambreIds)];
    const count = await this.prisma.chambre.count({
      where: {
        id: { in: uniqueRoomIds },
        hotelId,
      },
    });

    if (count !== uniqueRoomIds.length) {
      throw new BadRequestException('All chambreIds must belong to the selected hotel');
    }
  }

  private async assertNoDateOverlapForHotel(
    hotelId: number,
    startDate: Date,
    endDate: Date,
    excludeOfferId?: number,
  ) {
    const overlap = await this.prisma.offre.findFirst({
      where: {
        hotelId,
        active: true,
        ...(excludeOfferId !== undefined
          ? { id: { not: excludeOfferId } }
          : {}),
        dateDebut: { lte: endDate },
        dateFin: { gte: startDate },
      },
      select: { id: true, titre: true, dateDebut: true, dateFin: true },
    });

    if (overlap) {
      throw new BadRequestException(
        `Offer dates overlap with existing active offer #${overlap.id} (${overlap.titre}) for this hotel`,
      );
    }
  }

  private buildOfferData(dto: CreateOffreDto | UpdateOffreDto) {
    const { chambreIds, hotelId, ...offerData } = dto;
    return {
      offerData,
      hotelId,
      chambreIds: chambreIds ? [...new Set(chambreIds)] : undefined,
    };
  }

  async create(dto: CreateOffreDto) {
    this.assertValidDateRange(dto.dateDebut, dto.dateFin);
    await this.assertHotelExists(dto.hotelId);
    await this.assertRoomsBelongToHotel(dto.hotelId, dto.chambreIds);

    const chambreIds = dto.chambreIds ? [...new Set(dto.chambreIds)] : undefined;
    const startDate = this.parseOfferDate(dto.dateDebut, 'dateDebut');
    const endDate = this.parseOfferDate(dto.dateFin, 'dateFin');
    const targetIsActive = dto.active ?? true;

    if (targetIsActive) {
      await this.assertNoDateOverlapForHotel(dto.hotelId, startDate, endDate);
    }

    const data: Prisma.OffreCreateInput = {
      titre: dto.titre,
      description: dto.description,
      tauxRemise: dto.tauxRemise,
      dateDebut: startDate,
      dateFin: endDate,
      active: dto.active,
      photo: dto.photo,
      hotel: { connect: { id: dto.hotelId } },
      chambres: chambreIds
        ? {
            create: chambreIds.map((chambreId) => ({
              chambre: { connect: { id: chambreId } },
            })),
          }
        : undefined,
    };

    const offer = await this.prisma.offre.create({
      data,
      include: {
        hotel: {
          select: {
            nom: true,
            ville: true,
          },
        },
      },
    });

    await this.notificationService.notifyNewOffer({
      titre: offer.titre,
      tauxRemise: offer.tauxRemise,
      hotelId: offer.hotelId,
      hotelName: offer.hotel?.nom,
      hotelCity: offer.hotel?.ville,
    });

    return offer;
  }

  findAll(options?: { active?: boolean; hotelId?: number }) {
    const where: Prisma.OffreWhereInput = {};

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (Number.isFinite(options?.hotelId)) {
      where.hotelId = options?.hotelId;
    }

    return this.prisma.offre.findMany({
      where,
      include: this.includeOfferRelations,
      orderBy: [{ active: 'desc' }, { dateDebut: 'desc' }],
    });
  }

  findActive() {
    const now = new Date();

    return this.prisma.offre.findMany({
      where: {
        active: true,
        dateDebut: { lte: now },
        dateFin: { gte: now },
      },
      include: this.includeOfferRelations,
      orderBy: { dateFin: 'asc' },
    });
  }

  findByHotel(hotelId: number) {
    return this.prisma.offre.findMany({
      where: { hotelId },
      include: this.includeOfferRelations,
      orderBy: [{ active: 'desc' }, { dateDebut: 'desc' }],
    });
  }

  async findOne(id: number) {
    const offer = await this.prisma.offre.findUnique({
      where: { id },
      include: this.includeOfferRelations,
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    return offer;
  }

  async update(id: number, dto: UpdateOffreDto) {
    const current = await this.prisma.offre.findUnique({
      where: { id },
      select: {
        id: true,
        hotelId: true,
        dateDebut: true,
        dateFin: true,
        active: true,
      },
    });

    if (!current) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    const targetHotelId = dto.hotelId ?? current.hotelId;
    this.assertValidDateRange(
      dto.dateDebut ?? current.dateDebut.toISOString(),
      dto.dateFin ?? current.dateFin.toISOString(),
    );

    if (dto.hotelId !== undefined) {
      await this.assertHotelExists(dto.hotelId);
    }

    await this.assertRoomsBelongToHotel(targetHotelId, dto.chambreIds);
    const { offerData, hotelId, chambreIds } = this.buildOfferData(dto);
    const targetStartDate =
      dto.dateDebut !== undefined
        ? this.parseOfferDate(dto.dateDebut, 'dateDebut')
        : current.dateDebut;
    const targetEndDate =
      dto.dateFin !== undefined
        ? this.parseOfferDate(dto.dateFin, 'dateFin')
        : current.dateFin;
    const targetIsActive = dto.active ?? current.active;

    if (targetIsActive) {
      await this.assertNoDateOverlapForHotel(
        targetHotelId,
        targetStartDate,
        targetEndDate,
        id,
      );
    }

    const updateData: Prisma.OffreUpdateInput = {
      ...offerData,
      ...(dto.dateDebut !== undefined
        ? { dateDebut: targetStartDate }
        : {}),
      ...(dto.dateFin !== undefined
        ? { dateFin: targetEndDate }
        : {}),
      ...(hotelId !== undefined
        ? { hotel: { connect: { id: hotelId } } }
        : {}),
      chambres: chambreIds
        ? {
            create: chambreIds.map((chambreId) => ({
              chambre: { connect: { id: chambreId } },
            })),
          }
        : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      if (chambreIds) {
        await tx.offreChambre.deleteMany({ where: { offreId: id } });
      }

      return tx.offre.update({
        where: { id },
        data: updateData,
        include: this.includeOfferRelations,
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.offre.delete({ where: { id } });
  }
}

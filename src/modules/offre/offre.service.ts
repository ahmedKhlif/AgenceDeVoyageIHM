import { Injectable } from '@nestjs/common';
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

  async create(dto: CreateOffreDto) {
    const offer = await this.prisma.offre.create({
      data: dto,
      include: {
        hotel: {
          select: {
            nom: true,
          },
        },
      },
    });

    await this.notificationService.notifyNewOffer({
      titre: offer.titre,
      tauxRemise: offer.tauxRemise,
      hotelId: offer.hotelId,
      hotelName: offer.hotel?.nom,
    });

    return offer;
  }

  findAll() {
    return this.prisma.offre.findMany({
      include: {
        hotel: {
          include: {
            chambres: {
              select: { photos: true },
              take: 3,
            },
          },
        },
        chambres: { include: { chambre: true } },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.offre.findUnique({
      where: { id },
      include: {
        hotel: {
          include: {
            chambres: {
              select: { photos: true },
              take: 3,
            },
          },
        },
        chambres: { include: { chambre: true } },
      },
    });
  }

  update(id: number, dto: UpdateOffreDto) {
    return this.prisma.offre.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.offre.delete({ where: { id } });
  }
}

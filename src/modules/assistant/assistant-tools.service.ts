import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface HotelQuery {
  city?: string;
  minStars?: number;
  maxBudget?: number;
}

@Injectable()
export class AssistantToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findHotels(query: HotelQuery) {
    return this.prisma.hotel.findMany({
      where: {
        actif: true,
        ...(query.city
          ? {
              ville: {
                contains: query.city,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(Number.isFinite(query.minStars)
          ? {
              etoiles: { gte: query.minStars },
            }
          : {}),
        ...(Number.isFinite(query.maxBudget)
          ? {
              chambres: {
                some: {
                  prixParNuit: { lte: query.maxBudget },
                },
              },
            }
          : {}),
      },
      take: 6,
      orderBy: [{ etoiles: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        nom: true,
        ville: true,
        pays: true,
        etoiles: true,
        description: true,
        chambres: {
          take: 3,
          orderBy: { prixParNuit: 'asc' },
          select: {
            id: true,
            prixParNuit: true,
            capacite: true,
          },
        },
      },
    });
  }

  async findActiveOffers(city?: string) {
    const now = new Date();
    return this.prisma.offre.findMany({
      where: {
        active: true,
        dateDebut: { lte: now },
        dateFin: { gte: now },
        ...(city
          ? {
              hotel: {
                ville: {
                  contains: city,
                  mode: 'insensitive',
                },
              },
            }
          : {}),
      },
      take: 8,
      orderBy: [{ tauxRemise: 'desc' }, { dateFin: 'asc' }],
      select: {
        id: true,
        titre: true,
        description: true,
        tauxRemise: true,
        dateFin: true,
        hotel: {
          select: {
            id: true,
            nom: true,
            ville: true,
            pays: true,
          },
        },
      },
    });
  }

  async getDestinationHints(limit = 8) {
    const rows = await this.prisma.hotel.groupBy({
      by: ['ville'],
      where: { actif: true },
      _count: { _all: true },
      orderBy: { _count: { ville: 'desc' } },
      take: limit,
    });

    return rows.map((row) => ({
      ville: row.ville,
      count: row._count._all,
    }));
  }

  async getFaqContext() {
    const [configs, cancellationPolicies] = await Promise.all([
      this.prisma.systemConfig.findMany({
        where: {
          cle: {
            in: [
              'site_name',
              'default_currency',
              'max_booking_advance_days',
              'cancellation_deadline_hours',
              'support_email',
            ],
          },
        },
        select: {
          cle: true,
          valeur: true,
          description: true,
        },
      }),
      this.prisma.conditionAnnulation.findMany({
        select: {
          id: true,
          description: true,
          delaiLimiteHeures: true,
          fraisAnnulation: true,
          remboursementTotal: true,
        },
        orderBy: { delaiLimiteHeures: 'desc' },
        take: 6,
      }),
    ]);

    return { configs, cancellationPolicies };
  }
}

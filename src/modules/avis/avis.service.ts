import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';

@Injectable()
export class AvisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAvisDto) {
    const { reservationId, hotelId, accountId, authorName, ...rest } = dto;
    const resolvedAuthorName = await this.resolveAuthorName(
      authorName,
      accountId,
    );

    return this.prisma.avis.create({
      data: {
        ...rest,
        ...(resolvedAuthorName ? { authorName: resolvedAuthorName } : {}),
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

  async findAll() {
    const reviews = await this.prisma.avis.findMany({
      include: {
        reservation: {
          include: {
            account: { include: { profile: true } },
            chambre: true,
          },
        },
      },
    });

    return this.hydrateAuthorNames(reviews);
  }

  async findOne(id: number) {
    const review = await this.prisma.avis.findUnique({
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

    if (!review) {
      return null;
    }

    const [normalized] = await this.hydrateAuthorNames([review]);
    return normalized;
  }

  findByReservation(reservationId: number) {
    return this.prisma.avis.findMany({ where: { reservationId } });
  }

  async findByHotel(hotelId: number) {
    const reviews = await this.prisma.avis.findMany({
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

    return this.hydrateAuthorNames(reviews);
  }

  async findByAccount(accountId: number) {
    const reviews = await this.prisma.avis.findMany({
      where: {
        OR: [{ reservation: { accountId } }, { accountId }],
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

    return this.hydrateAuthorNames(reviews);
  }

  update(id: number, dto: UpdateAvisDto) {
    return this.prisma.avis.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.avis.delete({ where: { id } });
  }

  private normalizeAuthorName(authorName?: string | null) {
    const value = authorName?.trim();
    if (!value) {
      return undefined;
    }

    const lowered = value.toLowerCase();
    if (
      lowered === 'undefined' ||
      lowered === 'undefined undefined' ||
      lowered === 'null' ||
      lowered === 'null null'
    ) {
      return undefined;
    }

    return value;
  }

  private async resolveProfileName(accountId?: number | null) {
    if (!accountId) {
      return undefined;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { accountId },
      select: { prenom: true, nom: true },
    });

    if (!profile) {
      return undefined;
    }

    const fullName =
      `${profile.prenom?.trim() ?? ''} ${profile.nom?.trim() ?? ''}`.trim();
    return fullName || undefined;
  }

  private async resolveAuthorName(
    authorName?: string | null,
    accountId?: number | null,
  ) {
    return (
      this.normalizeAuthorName(authorName) ||
      (await this.resolveProfileName(accountId))
    );
  }

  private async hydrateAuthorNames<
    T extends {
      authorName?: string | null;
      accountId?: number | null;
    },
  >(reviews: T[]) {
    const missingAccountIds = Array.from(
      new Set(
        reviews
          .filter(
            (review) =>
              !this.normalizeAuthorName(review.authorName) &&
              !!review.accountId,
          )
          .map((review) => Number(review.accountId)),
      ),
    );

    if (missingAccountIds.length === 0) {
      return reviews;
    }

    const profiles = await this.prisma.profile.findMany({
      where: {
        accountId: { in: missingAccountIds },
      },
      select: {
        accountId: true,
        prenom: true,
        nom: true,
      },
    });

    const nameByAccountId = new Map(
      profiles.map((profile) => {
        const fullName =
          `${profile.prenom?.trim() ?? ''} ${profile.nom?.trim() ?? ''}`.trim();
        return [profile.accountId, fullName];
      }),
    );

    return reviews.map((review) => {
      if (this.normalizeAuthorName(review.authorName) || !review.accountId) {
        return review;
      }

      const resolvedName = nameByAccountId.get(Number(review.accountId));
      if (!resolvedName) {
        return review;
      }

      return {
        ...review,
        authorName: resolvedName,
      };
    });
  }
}

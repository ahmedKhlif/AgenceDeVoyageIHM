import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProfileDto) {
    return this.prisma.profile.create({ data: this.normalizeProfileData(dto) });
  }

  findOne(accountId: number) {
    return this.prisma.profile.findUnique({ where: { accountId } });
  }

  update(id: number, dto: UpdateProfileDto) {
    return this.prisma.profile.update({ where: { id }, data: this.normalizeProfileData(dto) });
  }

  private normalizeProfileData<T extends { dateNaissance?: string | Date | null }>(data: T): T {
    if (!data.dateNaissance) {
      return data;
    }

    const normalizedDate =
      typeof data.dateNaissance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.dateNaissance)
        ? new Date(`${data.dateNaissance}T00:00:00.000Z`)
        : data.dateNaissance;

    return {
      ...data,
      dateNaissance: normalizedDate,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgenceVoyageDto } from './dto/create-agence-voyage.dto';
import { UpdateAgenceVoyageDto } from './dto/update-agence-voyage.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgenceVoyageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgenceVoyageDto) {
    const hashedPassword = await bcrypt.hash(dto.motDePasse, 10);
    return this.prisma.agenceVoyage.create({
      data: {
        ...dto,
        email: dto.email.trim().toLowerCase(),
        motDePasse: hashedPassword,
      },
    });
  }

  findAll() {
    return this.prisma.agenceVoyage.findMany({ include: { hotels: true } });
  }

  findOne(id: number) {
    return this.prisma.agenceVoyage.findUnique({
      where: { id },
      include: { hotels: true, reclamations: true },
    });
  }

  async update(id: number, dto: UpdateAgenceVoyageDto) {
    const data = { ...dto } as UpdateAgenceVoyageDto;
    if (dto.email) {
      data.email = dto.email.trim().toLowerCase();
    }
    if (dto.motDePasse) {
      data.motDePasse = await bcrypt.hash(dto.motDePasse, 10);
    }

    return this.prisma.agenceVoyage.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.agenceVoyage.delete({ where: { id } });
  }
}

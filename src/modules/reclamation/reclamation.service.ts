import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';
import { StatutReclamation } from '@prisma/client';

@Injectable()
export class ReclamationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReclamationDto) {
    return this.prisma.reclamation.create({ data: dto });
  }

  findAll() {
    return this.prisma.reclamation.findMany({
      include: { reservation: true, agenceVoyage: true },
    });
  }

  findOne(id: number) {
    return this.prisma.reclamation.findUnique({
      where: { id },
      include: { reservation: true, agenceVoyage: true },
    });
  }

  findByAgence(agenceVoyageId: number) {
    return this.prisma.reclamation.findMany({ where: { agenceVoyageId } });
  }

  update(id: number, dto: UpdateReclamationDto) {
    return this.prisma.reclamation.update({ where: { id }, data: dto });
  }

  updateStatut(id: number, statut: StatutReclamation, reponseAgence?: string) {
    return this.prisma.reclamation.update({
      where: { id },
      data: {
        statut,
        ...(reponseAgence ? { reponseAgence } : {}),
        ...(statut === StatutReclamation.RESOLUE ? { dateResolution: new Date() } : {}),
      },
    });
  }

  remove(id: number) {
    return this.prisma.reclamation.delete({ where: { id } });
  }
}

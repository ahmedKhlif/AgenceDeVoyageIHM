import { IsInt, IsString, IsEnum, IsOptional } from 'class-validator';
import { StatutReclamation } from '@prisma/client';

export class CreateReclamationDto {
  @IsInt()
  reservationId: number;

  @IsInt()
  agenceVoyageId: number;

  @IsString()
  sujet: string;

  @IsString()
  description: string;

  @IsEnum(StatutReclamation)
  @IsOptional()
  statut?: StatutReclamation;
}

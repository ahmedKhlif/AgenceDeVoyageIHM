import { IsInt, IsDateString, IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';
import { StatutReservation } from '@prisma/client';

export class CreateReservationDto {
  @IsInt()
  accountId: number;

  @IsInt()
  chambreId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsInt()
  nombrePersonnes: number;

  @IsInt()
  nombreNuits: number;

  @IsNumber()
  montantTotal: number;

  @IsString()
  codeConfirmation: string;

  @IsEnum(StatutReservation)
  @IsOptional()
  statut?: StatutReservation;

  @IsString()
  @IsOptional()
  motifBlocage?: string;
}

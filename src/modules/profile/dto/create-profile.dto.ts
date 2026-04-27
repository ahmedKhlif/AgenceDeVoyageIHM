import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  Length,
  Matches,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProfileDto {
  @IsInt()
  accountId: number;

  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsString()
  @IsOptional()
  nationalite?: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsDateString()
  @IsOptional()
  dateNaissance?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(6, 9, { message: 'Passport number must be between 6 and 9 characters.' })
  @Matches(/^[A-Z0-9]+$/, { message: 'Passport number must contain only letters and numbers.' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]+$/, {
    message: 'Passport number must include at least one letter and one number.',
  })
  numeroPasseport?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  destinationsPreferees?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferencesVoyage?: string[];

  @IsBoolean()
  @IsOptional()
  notificationsReservation?: boolean;

  @IsBoolean()
  @IsOptional()
  notificationsPromotion?: boolean;
}

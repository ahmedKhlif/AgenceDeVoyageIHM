import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

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

import {
  IsString,
  IsInt,
  IsBoolean,
  IsEmail,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateHotelDto {
  @IsString()
  nom: string;

  @IsString()
  adresse: string;

  @IsString()
  ville: string;

  @IsString()
  pays: string;

  @IsInt()
  @Min(1)
  @Max(5)
  etoiles: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail()
  email: string;

  @IsString()
  telephone: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;

  @IsBoolean()
  @IsOptional()
  estPartenaire?: boolean;

  @IsInt()
  agenceVoyageId: number;
}

import { IsEmail, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAgenceVoyageDto {
  @IsEmail()
  email: string;

  @IsString()
  motDePasse: string;

  @IsString()
  nomAgence: string;

  @IsString()
  siret: string;

  @IsString()
  adresseAgence: string;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

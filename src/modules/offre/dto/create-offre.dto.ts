import { IsString, IsNumber, IsDateString, IsBoolean, IsInt, IsOptional } from 'class-validator';

export class CreateOffreDto {
  @IsString()
  titre: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  tauxRemise: number;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsInt()
  hotelId: number;
}


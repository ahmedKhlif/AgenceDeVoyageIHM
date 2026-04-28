import {
  ArrayNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsInt,
  IsOptional,
  IsArray,
  Max,
  Min,
} from 'class-validator';

export class CreateOffreDto {
  @IsString()
  titre: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
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

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsOptional()
  chambreIds?: number[];
}

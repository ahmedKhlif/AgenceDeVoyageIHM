import {
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateChambreDto {
  @IsString()
  numero: string;

  @IsInt()
  etage: number;

  @IsNumber()
  prixParNuit: number;

  @IsInt()
  capacite: number;

  @IsBoolean()
  @IsOptional()
  disponible?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsInt()
  hotelId: number;

  @IsInt()
  typeChambreId: number;
}

import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateTypeChambreDto {
  @IsString()
  libelle: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  superficieM2: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  equipements?: string[];
}

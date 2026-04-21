import { IsString, IsOptional } from 'class-validator';

export class CreateSystemConfigDto {
  @IsString()
  cle: string;

  @IsString()
  valeur: string;

  @IsString()
  @IsOptional()
  description?: string;
}

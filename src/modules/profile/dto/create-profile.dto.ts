import { IsInt, IsString, IsOptional } from 'class-validator';

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
}

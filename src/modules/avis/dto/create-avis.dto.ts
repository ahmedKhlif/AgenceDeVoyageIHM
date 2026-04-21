import { IsInt, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateAvisDto {
  @IsInt()
  reservationId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  note: number;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsBoolean()
  @IsOptional()
  valide?: boolean;
}

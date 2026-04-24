import { IsInt, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateAvisDto {
  @IsInt()
  @IsOptional()
  reservationId?: number;

  @IsInt()
  @IsOptional()
  hotelId?: number;

  @IsString()
  @IsOptional()
  authorName?: string;

  @IsInt()
  @IsOptional()
  accountId?: number;

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


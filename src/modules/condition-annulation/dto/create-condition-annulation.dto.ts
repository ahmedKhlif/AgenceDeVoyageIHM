import { IsInt, IsNumber, IsBoolean, IsString, IsOptional } from 'class-validator';

export class CreateConditionAnnulationDto {
  @IsInt()
  delaiLimiteHeures: number;

  @IsNumber()
  fraisAnnulation: number;

  @IsBoolean()
  @IsOptional()
  remboursementTotal?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  systemConfigId: number;
}

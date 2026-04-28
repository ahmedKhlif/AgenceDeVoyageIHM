import { IsBoolean, IsOptional } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

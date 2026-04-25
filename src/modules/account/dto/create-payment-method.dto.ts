import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  cardholderName: string;

  @IsString()
  @IsIn(['visa', 'mastercard', 'amex', 'discover', 'other'])
  brand: string;

  @IsString()
  @Matches(/^\d{12,19}$/)
  cardNumber: string;

  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @IsInt()
  @Min(new Date().getFullYear())
  @Max(new Date().getFullYear() + 25)
  expiryYear: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

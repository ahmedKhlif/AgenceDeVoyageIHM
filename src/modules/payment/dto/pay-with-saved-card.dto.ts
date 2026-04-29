import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PayWithSavedCardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookingId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentMethodId: number;
}

import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateCheckoutSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalPrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookingId: number;
}

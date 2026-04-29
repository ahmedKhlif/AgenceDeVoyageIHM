import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CancelUnpaidBookingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookingId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}

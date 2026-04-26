import { Type } from 'class-transformer';
import { IsDateString, IsInt, Min } from 'class-validator';

export class CheckAvailabilityDto {
  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  children: number;
}

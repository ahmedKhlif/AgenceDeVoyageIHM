import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingDto {
  @Type(() => Number)
  @IsInt()
  hotelId: number;

  @Type(() => Number)
  @IsInt()
  roomId: number;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}

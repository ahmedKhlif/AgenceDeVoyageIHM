import { IsInt, Min } from 'class-validator';

export class AddWishlistHotelDto {
  @IsInt()
  @Min(1)
  hotelId: number;
}

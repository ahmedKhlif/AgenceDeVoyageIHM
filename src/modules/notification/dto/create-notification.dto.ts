import { IsInt, IsString, IsEnum } from 'class-validator';
import { TypeNotification } from '@prisma/client';

export class CreateNotificationDto {
  @IsInt()
  accountId: number;

  @IsString()
  message: string;

  @IsEnum(TypeNotification)
  type: TypeNotification;
}

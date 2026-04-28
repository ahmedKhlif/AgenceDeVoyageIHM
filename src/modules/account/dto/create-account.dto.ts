import { AccountRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  motDePasse: string;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;

  @IsEnum(AccountRole)
  @IsOptional()
  role?: AccountRole;
}

import { IsEmail, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  motDePasse: string;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;
}

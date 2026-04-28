import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendTestEmailDto {
  @IsEmail()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  templateSlug?: string;
}

import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateReclamationDto } from './create-reclamation.dto';

export class UpdateReclamationDto extends PartialType(CreateReclamationDto) {
  @IsString()
  @IsOptional()
  reponseAgence?: string;
}

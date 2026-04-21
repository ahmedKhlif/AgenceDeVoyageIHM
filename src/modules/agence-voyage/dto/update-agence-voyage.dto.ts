import { PartialType } from '@nestjs/mapped-types';
import { CreateAgenceVoyageDto } from './create-agence-voyage.dto';

export class UpdateAgenceVoyageDto extends PartialType(CreateAgenceVoyageDto) {}

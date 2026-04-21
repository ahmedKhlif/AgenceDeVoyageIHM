import { PartialType } from '@nestjs/mapped-types';
import { CreateAvisDto } from './create-avis.dto';

export class UpdateAvisDto extends PartialType(CreateAvisDto) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateOffreDto } from './create-offre.dto';

export class UpdateOffreDto extends PartialType(CreateOffreDto) {}

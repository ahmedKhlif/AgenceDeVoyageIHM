import { PartialType } from '@nestjs/mapped-types';
import { CreateTypeChambreDto } from './create-type-chambre.dto';

export class UpdateTypeChambreDto extends PartialType(CreateTypeChambreDto) {}

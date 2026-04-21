import { PartialType } from '@nestjs/mapped-types';
import { CreateConditionAnnulationDto } from './create-condition-annulation.dto';

export class UpdateConditionAnnulationDto extends PartialType(CreateConditionAnnulationDto) {}

import { Module } from '@nestjs/common';
import { ConditionAnnulationService } from './condition-annulation.service';
import { ConditionAnnulationController } from './condition-annulation.controller';

@Module({
  controllers: [ConditionAnnulationController],
  providers: [ConditionAnnulationService],
  exports: [ConditionAnnulationService],
})
export class ConditionAnnulationModule {}

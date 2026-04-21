import { Module } from '@nestjs/common';
import { ReclamationService } from './reclamation.service';
import { ReclamationController } from './reclamation.controller';

@Module({
  controllers: [ReclamationController],
  providers: [ReclamationService],
  exports: [ReclamationService],
})
export class ReclamationModule {}

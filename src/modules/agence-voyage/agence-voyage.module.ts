import { Module } from '@nestjs/common';
import { AgenceVoyageService } from './agence-voyage.service';
import { AgenceVoyageController } from './agence-voyage.controller';

@Module({
  controllers: [AgenceVoyageController],
  providers: [AgenceVoyageService],
  exports: [AgenceVoyageService],
})
export class AgenceVoyageModule {}

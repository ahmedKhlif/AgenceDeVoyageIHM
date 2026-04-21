import { Module } from '@nestjs/common';
import { TypeChambreService } from './type-chambre.service';
import { TypeChambreController } from './type-chambre.controller';

@Module({
  controllers: [TypeChambreController],
  providers: [TypeChambreService],
  exports: [TypeChambreService],
})
export class TypeChambreModule {}

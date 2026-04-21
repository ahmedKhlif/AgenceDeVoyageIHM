import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController, AuthController } from './account.controller';

@Module({
  controllers: [AccountController, AuthController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}

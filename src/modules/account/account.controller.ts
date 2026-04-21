import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Get()
  findAll() {
    return this.accountService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accountService.remove(id);
  }

  @Get(':accountId/profile')
  getProfile(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.accountService.getProfile(accountId);
  }

  @Patch(':accountId/profile')
  updateProfile(@Param('accountId', ParseIntPipe) accountId: number, @Body() data: any) {
    return this.accountService.updateProfile(accountId, data);
  }

  @Patch(':accountId/change-password')
  changePassword(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: { oldPassword: string; newPassword: string }
  ) {
    return this.accountService.changePassword(accountId, data.oldPassword, data.newPassword);
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly accountService: AccountService) {}

  @Post('register')
  register(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.accountService.login(body.email, body.password);
  }
}

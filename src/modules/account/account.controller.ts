import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { ConfirmPaymentMethodSessionDto } from './dto/confirm-payment-method-session.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

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
  updateProfile(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: UpdateProfileDto,
  ) {
    return this.accountService.updateProfile(accountId, data);
  }

  @Get(':accountId/payment-methods')
  listPaymentMethods(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.accountService.listPaymentMethods(accountId);
  }

  @Post(':accountId/payment-methods')
  createPaymentMethod(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.accountService.createPaymentMethodSetupSession(accountId, dto);
  }

  @Post(':accountId/payment-methods/confirm-session')
  confirmPaymentMethodSession(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() dto: ConfirmPaymentMethodSessionDto,
  ) {
    return this.accountService.confirmPaymentMethodSetupSession(
      accountId,
      dto.sessionId,
    );
  }

  @Patch(':accountId/payment-methods/:paymentMethodId')
  updatePaymentMethod(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('paymentMethodId', ParseIntPipe) paymentMethodId: number,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.accountService.updatePaymentMethod(
      accountId,
      paymentMethodId,
      dto,
    );
  }

  @Delete(':accountId/payment-methods/:paymentMethodId')
  removePaymentMethod(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('paymentMethodId', ParseIntPipe) paymentMethodId: number,
  ) {
    return this.accountService.removePaymentMethod(accountId, paymentMethodId);
  }

  @Patch(':accountId/change-password')
  changePassword(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: { oldPassword: string; newPassword: string },
  ) {
    return this.accountService.changePassword(
      accountId,
      data.oldPassword,
      data.newPassword,
    );
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

  @Post('google')
  googleLogin(
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      uid: string;
    },
  ) {
    return this.accountService.googleLogin(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.accountService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.accountService.resetPassword(dto.token, dto.newPassword);
  }
}

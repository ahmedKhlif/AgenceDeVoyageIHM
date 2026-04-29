import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CheckoutSessionSummaryDto } from './dto/checkout-session-summary.dto';
import { CancelUnpaidBookingDto } from './dto/cancel-unpaid-booking.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-checkout-session')
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentService.createCheckoutSession(dto);
  }

  @Get('checkout-session/:sessionId/summary')
  getCheckoutSessionSummary(
    @Param('sessionId') sessionId: string,
    @Query() query: CheckoutSessionSummaryDto,
  ) {
    return this.paymentService.getCheckoutSessionSummary(
      sessionId,
      query.userId,
    );
  }

  @Post('cancel-unpaid-booking')
  cancelUnpaidBooking(@Body() dto: CancelUnpaidBookingDto) {
    return this.paymentService.cancelUnpaidBooking(dto.bookingId, dto.userId);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() req: Request,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!(req.body instanceof Buffer)) {
      throw new BadRequestException(
        'Invalid webhook payload: expected raw body',
      );
    }

    return this.paymentService.handleWebhook(signature, req.body);
  }
}

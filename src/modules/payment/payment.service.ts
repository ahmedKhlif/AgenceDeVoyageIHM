import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StatutReservation } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { MailService } from '../mail/mail.service';

type HydratedReservation = {
  id: number;
  accountId: number;
  chambreId: number;
  dateArrivee: Date;
  dateDepart: Date;
  nombrePersonnes: number;
  nombreNuits: number;
  montantTotal: number;
  codeConfirmation: string;
  statut: StatutReservation;
  paymentStatus: string;
  stripeSessionId: string | null;
  paymentDate: Date | null;
  chambre: {
    numero: string;
    prixParNuit: number;
    typeChambre: { libelle: string } | null;
    hotel: { id: number; nom: string };
  };
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: any | null;
  private readonly successUrl: string;
  private readonly cancelUrl: string;
  private readonly currency: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.successUrl =
      this.configService.get<string>('STRIPE_SUCCESS_URL') ||
      'http://localhost:3000/payment/success';
    this.cancelUrl =
      this.configService.get<string>('STRIPE_CANCEL_URL') ||
      'http://localhost:3000/payment/cancel';
    this.currency = (
      this.configService.get<string>('STRIPE_CURRENCY') || 'usd'
    ).toLowerCase();

    this.stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto) {
    await this.ensureVerifiedAccount(dto.userId);
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.bookingId },
      include: {
        account: true,
        chambre: {
          include: {
            hotel: true,
            typeChambre: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new BadRequestException('Booking not found');
    }

    if (reservation.accountId !== dto.userId) {
      throw new BadRequestException(
        'Booking does not belong to the provided user',
      );
    }

    if (reservation.chambre.hotelId !== dto.tripId) {
      throw new BadRequestException('Trip does not match booking');
    }

    if (
      reservation.statut === StatutReservation.ANNULEE ||
      reservation.statut === StatutReservation.REFUSEE ||
      reservation.statut === StatutReservation.BLOQUEE ||
      reservation.statut === StatutReservation.TERMINEE
    ) {
      throw new BadRequestException(
        'This booking cannot be paid in its current status',
      );
    }

    if (reservation.statut === StatutReservation.CONFIRMEE) {
      throw new BadRequestException(
        'This booking has already been paid and confirmed',
      );
    }

    const expectedAmount = Number(reservation.montantTotal.toFixed(2));
    const receivedAmount = Number(dto.totalPrice.toFixed(2));
    if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
      throw new BadRequestException('Payment amount mismatch');
    }

    const roomSubtotal = Number(
      (reservation.chambre.prixParNuit * reservation.nombreNuits).toFixed(2),
    );
    const taxes = Number(Math.max(0, expectedAmount - roomSubtotal).toFixed(2));

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: this.appendQueryParams(this.successUrl, {
          session_id: '{CHECKOUT_SESSION_ID}',
          booking_id: reservation.id.toString(),
        }),
        cancel_url: this.appendQueryParams(this.cancelUrl, {
          booking_id: reservation.id.toString(),
        }),
        client_reference_id: reservation.id.toString(),
        customer_email: reservation.account.email,
        metadata: {
          bookingId: reservation.id.toString(),
          userId: reservation.accountId.toString(),
          tripId: reservation.chambre.hotelId.toString(),
          hotelName: reservation.chambre.hotel.nom,
          roomName:
            reservation.chambre.typeChambre?.libelle ||
            `Room ${reservation.chambre.numero}`,
          checkIn: reservation.dateArrivee.toISOString(),
          checkOut: reservation.dateDepart.toISOString(),
          guests: reservation.nombrePersonnes.toString(),
          nights: reservation.nombreNuits.toString(),
          roomSubtotal: roomSubtotal.toFixed(2),
          taxes: taxes.toFixed(2),
          totalAmount: expectedAmount.toFixed(2),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: this.currency,
              unit_amount: Math.round(roomSubtotal * 100),
              product_data: {
                name: `VoyageHub booking ${reservation.codeConfirmation}`,
                description: `${reservation.chambre.hotel.nom} - ${reservation.chambre.typeChambre?.libelle || `Room ${reservation.chambre.numero}`}`,
              },
            },
          },
          ...(taxes > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: this.currency,
                    unit_amount: Math.round(taxes * 100),
                    product_data: {
                      name: 'City taxes',
                      description: `${reservation.nombreNuits} night(s) tax`,
                    },
                  },
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to initialize Stripe checkout');
    }

    if (!session.url) {
      throw new InternalServerErrorException('Stripe checkout URL is missing');
    }

    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        stripeSessionId: session.id,
        paymentStatus: 'CHECKOUT_PENDING',
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async payWithSavedCard(
    bookingId: number,
    userId: number,
    paymentMethodId: number,
  ) {
    await this.ensureVerifiedAccount(userId);
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: bookingId },
      include: {
        account: true,
        chambre: {
          include: {
            hotel: true,
            typeChambre: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new BadRequestException('Booking not found');
    }

    if (reservation.accountId !== userId) {
      throw new BadRequestException(
        'Booking does not belong to the provided user',
      );
    }

    if (
      reservation.statut === StatutReservation.ANNULEE ||
      reservation.statut === StatutReservation.REFUSEE ||
      reservation.statut === StatutReservation.BLOQUEE ||
      reservation.statut === StatutReservation.TERMINEE ||
      reservation.statut === StatutReservation.CONFIRMEE
    ) {
      throw new BadRequestException(
        'This booking cannot be paid in its current status',
      );
    }

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        accountId: userId,
      },
    });

    if (!paymentMethod?.stripePaymentMethodId) {
      throw new BadRequestException('Saved payment method not found');
    }

    if (!reservation.account.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer is associated with this account',
      );
    }

    let paymentIntent: any;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(reservation.montantTotal * 100),
        currency: this.currency,
        customer: reservation.account.stripeCustomerId,
        payment_method: paymentMethod.stripePaymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          bookingId: reservation.id.toString(),
          userId: reservation.accountId.toString(),
          tripId: reservation.chambre.hotelId.toString(),
        },
      });
    } catch (error: any) {
      const failureMessage =
        error?.raw?.message || error?.message || 'Payment failed';
      await this.sendPaymentFailureAlert({
        bookingReference: reservation.codeConfirmation,
        hotelName: reservation.chambre.hotel.nom,
        userName: `Account #${reservation.accountId}`,
        failureReason: failureMessage,
      });
      throw new BadRequestException(failureMessage);
    }

    if (paymentIntent?.status !== 'succeeded') {
      throw new BadRequestException('Payment could not be completed');
    }

    const syntheticSessionId = `saved_card_${paymentIntent.id}`;
    const finalized = await this.finalizeReservationPayment(
      reservation.id,
      syntheticSessionId,
      paymentIntent.id,
    );

    if (!finalized.reservation || finalized.reservation.statut !== StatutReservation.CONFIRMEE) {
      throw new BadRequestException(
        'Payment was received but this reservation is not in a confirmed state',
      );
    }

    if (finalized.changed) {
      await this.notificationService.notifyReservationStatusUpdate({
        accountId: finalized.reservation.accountId,
        bookingReference: finalized.reservation.codeConfirmation,
        hotelName: finalized.reservation.chambre.hotel.nom,
        status: finalized.reservation.statut,
        checkInDate: finalized.reservation.dateArrivee,
      });

      const roomSubtotal = Number(
        (
          finalized.reservation.chambre.prixParNuit *
          finalized.reservation.nombreNuits
        ).toFixed(2),
      );
      const taxes = Number(
        Math.max(0, finalized.reservation.montantTotal - roomSubtotal).toFixed(
          2,
        ),
      );

      await this.notificationService.sendPaymentReceipt({
        accountId: finalized.reservation.accountId,
        bookingReference: finalized.reservation.codeConfirmation,
        hotelName: finalized.reservation.chambre.hotel.nom,
        checkInDate: finalized.reservation.dateArrivee,
        checkOutDate: finalized.reservation.dateDepart,
        roomSubtotal,
        taxes,
        totalAmount: finalized.reservation.montantTotal,
      });
    }

    return {
      paid: true,
      bookingId: finalized.reservation.id,
      bookingReference: finalized.reservation.codeConfirmation,
      status: finalized.reservation.statut,
    };
  }

  async cancelUnpaidBooking(bookingId: number, userId: number) {
    await this.ensureVerifiedAccount(userId);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: bookingId },
    });

    if (!reservation) {
      return { removed: false };
    }

    if (reservation.accountId !== userId) {
      throw new BadRequestException(
        'Booking does not belong to the provided user',
      );
    }

    if (reservation.statut !== StatutReservation.EN_ATTENTE) {
      return { removed: false };
    }

    if (
      reservation.paymentStatus === 'PAY_AT_HOTEL' ||
      reservation.paymentStatus === 'PAID'
    ) {
      return { removed: false };
    }

    await this.prisma.reservation.delete({
      where: { id: reservation.id },
    });

    return { removed: true };
  }

  async getCheckoutSessionSummary(sessionId: string, userId: number) {
    await this.ensureVerifiedAccount(userId);
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to fetch Stripe checkout session');
    }

    if (session.payment_status !== 'paid') {
      throw new BadRequestException(
        'Payment is not completed for this checkout session',
      );
    }

    const bookingId = this.extractBookingId(session);
    if (!bookingId) {
      throw new BadRequestException('Invalid checkout session metadata');
    }

    const reservationBeforeSync =
      await this.findReservationForSummary(bookingId);
    if (!reservationBeforeSync) {
      throw new NotFoundException('Booking not found');
    }

    if (reservationBeforeSync.accountId !== userId) {
      throw new BadRequestException(
        'Checkout session does not belong to the provided user',
      );
    }

    await this.handleCheckoutSessionCompleted(session, 'sync');

    const reservation = await this.findReservationForSummary(bookingId);
    if (!reservation) {
      throw new NotFoundException('Booking not found');
    }

    if (reservation.accountId !== userId) {
      throw new BadRequestException(
        'Checkout session does not belong to the provided user',
      );
    }

    if (reservation.statut !== StatutReservation.CONFIRMEE) {
      throw new BadRequestException(
        'Payment was received but this reservation is not in a confirmed state',
      );
    }

    const roomPrice = Number(
      (reservation.chambre.prixParNuit * reservation.nombreNuits).toFixed(2),
    );
    const taxes = Number(
      Math.max(0, reservation.montantTotal - roomPrice).toFixed(2),
    );

    return {
      sessionId,
      paymentStatus: session.payment_status,
      bookingStatus: reservation.statut,
      bookingReference: reservation.codeConfirmation,
      hotelName: reservation.chambre.hotel.nom,
      roomName:
        reservation.chambre.typeChambre?.libelle ||
        `Room ${reservation.chambre.numero}`,
      checkIn: reservation.dateArrivee,
      checkOut: reservation.dateDepart,
      nights: reservation.nombreNuits,
      guests: reservation.nombrePersonnes,
      roomPrice,
      taxes,
      totalPaid: reservation.montantTotal,
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    if (!this.webhookSecret) {
      throw new InternalServerErrorException(
        'Missing STRIPE_WEBHOOK_SECRET environment variable',
      );
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as any;
      await this.handleCheckoutSessionCompleted(session, 'webhook');
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as any;
      await this.handleCheckoutSessionFailed(session);
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any;
      await this.handlePaymentIntentFailed(paymentIntent);
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(
    session: any,
    source: 'webhook' | 'sync',
  ) {
    const bookingId = this.extractBookingId(session);
    if (!bookingId) {
      this.logger.warn(
        `Session ${session.id} received without valid bookingId`,
      );
      return;
    }

    const paymentIntentId = this.extractPaymentIntentId(session);

    let finalized: {
      changed: boolean;
      reservation: HydratedReservation | null;
    } | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        finalized = await this.finalizeReservationPayment(
          bookingId,
          session.id,
          paymentIntentId,
        );
        break;
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt < 1) {
          continue;
        }
        throw error;
      }
    }

    if (!finalized?.reservation) {
      this.logger.warn(
        `Reservation ${bookingId} not found while finalizing Stripe session ${session.id}`,
      );
      return;
    }

    if (!finalized.changed) {
      return;
    }

    await this.notificationService.notifyReservationStatusUpdate({
      accountId: finalized.reservation.accountId,
      bookingReference: finalized.reservation.codeConfirmation,
      hotelName: finalized.reservation.chambre.hotel.nom,
      status: finalized.reservation.statut,
      checkInDate: finalized.reservation.dateArrivee,
    });

    if (finalized.reservation.statut === StatutReservation.CONFIRMEE) {
      const roomSubtotal = Number(
        (
          finalized.reservation.chambre.prixParNuit *
          finalized.reservation.nombreNuits
        ).toFixed(2),
      );
      const taxes = Number(
        Math.max(0, finalized.reservation.montantTotal - roomSubtotal).toFixed(
          2,
        ),
      );

      await this.notificationService.sendPaymentReceipt({
        accountId: finalized.reservation.accountId,
        bookingReference: finalized.reservation.codeConfirmation,
        hotelName: finalized.reservation.chambre.hotel.nom,
        checkInDate: finalized.reservation.dateArrivee,
        checkOutDate: finalized.reservation.dateDepart,
        roomSubtotal,
        taxes,
        totalAmount: finalized.reservation.montantTotal,
      });
    }

    this.logger.log(
      `Reservation ${finalized.reservation.id} finalized after Stripe payment (source=${source}, status=${finalized.reservation.statut})`,
    );
  }

  private async handleCheckoutSessionFailed(session: any) {
    const bookingId = this.extractBookingId(session);
    if (!bookingId) {
      return;
    }

    const reservation = await this.findReservationForSummary(bookingId);
    if (!reservation) {
      return;
    }

    await this.sendPaymentFailureAlert({
      bookingReference: reservation.codeConfirmation,
      hotelName: reservation.chambre.hotel.nom,
      userName: `Account #${reservation.accountId}`,
      failureReason:
        session.payment_status || 'Checkout session payment failed',
    });

    await this.cleanupFailedPaymentReservation(bookingId, session.id);
  }

  private async handlePaymentIntentFailed(paymentIntent: any) {
    const bookingId = Number.parseInt(
      paymentIntent?.metadata?.bookingId || '',
      10,
    );
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return;
    }

    const reservation = await this.findReservationForSummary(bookingId);
    if (!reservation) {
      return;
    }

    await this.sendPaymentFailureAlert({
      bookingReference: reservation.codeConfirmation,
      hotelName: reservation.chambre.hotel.nom,
      userName: `Account #${reservation.accountId}`,
      failureReason:
        paymentIntent?.last_payment_error?.message ||
        paymentIntent?.status ||
        'Payment intent failed',
    });

    await this.cleanupFailedPaymentReservation(bookingId, null);
  }

  private async cleanupFailedPaymentReservation(
    bookingId: number,
    sessionId: string | null,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        statut: true,
        paymentStatus: true,
        stripeSessionId: true,
      },
    });

    if (!reservation) {
      return;
    }

    if (reservation.statut !== StatutReservation.EN_ATTENTE) {
      return;
    }

    if (
      reservation.paymentStatus === 'PAY_AT_HOTEL' ||
      reservation.paymentStatus === 'PAID'
    ) {
      return;
    }

    if (sessionId && reservation.stripeSessionId !== sessionId) {
      return;
    }

    await this.prisma.reservation.delete({
      where: { id: reservation.id },
    });
  }

  private async finalizeReservationPayment(
    bookingId: number,
    sessionId: string,
    paymentIntentId: string | null,
  ): Promise<{ changed: boolean; reservation: HydratedReservation | null }> {
    const txResult = await this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: bookingId },
        });

        if (!reservation) {
          return { record: null, changed: false };
        }

        if (
          reservation.statut === StatutReservation.CONFIRMEE &&
          reservation.paymentDate &&
          reservation.stripeSessionId === sessionId
        ) {
          return { record: reservation, changed: false };
        }

        if (
          reservation.statut === StatutReservation.ANNULEE ||
          reservation.statut === StatutReservation.REFUSEE ||
          reservation.statut === StatutReservation.TERMINEE
        ) {
          return { record: reservation, changed: false };
        }

        const conflictingReservation = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            chambreId: reservation.chambreId,
            statut: {
              in: [
                StatutReservation.CONFIRMEE,
                StatutReservation.BLOQUEE,
                StatutReservation.TERMINEE,
              ],
            },
            dateArrivee: { lt: reservation.dateDepart },
            dateDepart: { gt: reservation.dateArrivee },
          },
          select: { id: true, codeConfirmation: true },
        });

        if (conflictingReservation) {
          const record = await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              statut: StatutReservation.REFUSEE,
              paymentStatus: 'PAID_CONFLICT',
              motifBlocage: `Payment completed for session ${sessionId}, but room is no longer available (conflict booking ${conflictingReservation.codeConfirmation}).`,
              stripeSessionId: sessionId,
              stripePaymentIntentId: paymentIntentId,
              paymentDate: new Date(),
            },
          });
          return { record, changed: true };
        }

        const record = await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            statut: StatutReservation.CONFIRMEE,
            paymentStatus: 'PAID',
            stripeSessionId: sessionId,
            stripePaymentIntentId: paymentIntentId,
            paymentDate: new Date(),
            motifBlocage: null,
          },
        });
        return { record, changed: true };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    if (!txResult.record) {
      return { changed: false, reservation: null };
    }

    const hydrated = await this.findReservationForSummary(txResult.record.id);
    if (!hydrated) {
      return { changed: false, reservation: null };
    }

    return { changed: txResult.changed, reservation: hydrated };
  }

  private async findReservationForSummary(
    bookingId: number,
  ): Promise<HydratedReservation | null> {
    return this.prisma.reservation.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        accountId: true,
        chambreId: true,
        dateArrivee: true,
        dateDepart: true,
        nombrePersonnes: true,
        nombreNuits: true,
        montantTotal: true,
        codeConfirmation: true,
        statut: true,
        paymentStatus: true,
        stripeSessionId: true,
        paymentDate: true,
        chambre: {
          select: {
            numero: true,
            prixParNuit: true,
            typeChambre: {
              select: {
                libelle: true,
              },
            },
            hotel: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        },
      },
    });
  }

  private extractBookingId(session: any): number | null {
    const metadata = session.metadata || {};
    const bookingId = Number.parseInt(
      metadata.bookingId || session.client_reference_id || '',
      10,
    );

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return null;
    }

    return bookingId;
  }

  private extractPaymentIntentId(session: any): string | null {
    if (!session.payment_intent) {
      return null;
    }

    if (typeof session.payment_intent === 'string') {
      return session.payment_intent;
    }

    return session.payment_intent.id || null;
  }

  private appendQueryParams(url: string, query: Record<string, string>) {
    const serialized = Object.entries(query)
      .map(([key, value]) => {
        const serializedValue = value.includes('{')
          ? value
          : encodeURIComponent(value);
        return `${encodeURIComponent(key)}=${serializedValue}`;
      })
      .join('&');

    return url.includes('?') ? `${url}&${serialized}` : `${url}?${serialized}`;
  }

  private rethrowStripeError(error: any, fallbackMessage: string): never {
    if (error && typeof error === 'object') {
      const stripeError = error as any;
      if (stripeError.type === 'StripeAuthenticationError') {
        this.logger.error(
          'Stripe authentication failed. Check STRIPE_SECRET_KEY.',
        );
        throw new ServiceUnavailableException(
          'Payment provider is temporarily unavailable',
        );
      }
      if (stripeError.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(stripeError.message || fallbackMessage);
      }
      if (stripeError.type === 'StripeConnectionError') {
        throw new ServiceUnavailableException(
          'Payment provider connection failed',
        );
      }
    }

    this.logger.error(`${fallbackMessage}: ${error?.message || error}`);
    throw new InternalServerErrorException(fallbackMessage);
  }

  private async sendPaymentFailureAlert(input: {
    bookingReference: string;
    hotelName: string;
    userName: string;
    failureReason: string;
  }) {
    try {
      await this.mailService.sendTemplate({
        to: await this.mailService.getSupportEmail(),
        templateSlug: 'ops.payment-failure-alert',
        tokens: {
          conf_code: input.bookingReference,
          hotel_name: input.hotelName,
          user_name: input.userName,
          failure_reason: input.failureReason,
        },
        fallbackSubject: `Payment failure for booking ${input.bookingReference}`,
        fallbackBody: `${input.failureReason}`,
        actionLabel: 'Open reservations',
        actionUrl: `${this.mailService.getAppWebUrl()}/admin/reservations`,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send payment failure alert for ${input.bookingReference}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async ensureVerifiedAccount(userId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
      select: { id: true, actif: true, emailVerified: true },
    });

    if (!account || !account.actif) {
      throw new NotFoundException('Account not found');
    }
    if (!account.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing your account.',
      );
    }
  }
}

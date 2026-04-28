import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StatutReservation, TypeNotification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MailService } from '../mail/mail.service';

type NotifyInput = {
  accountId: number;
  message: string;
  type: TypeNotification;
  subject: string;
  actionPath?: string;
  actionLabel?: string;
  templateSlug?: string;
  tokens?: Record<string, string | number | null | undefined>;
  mailOnly?: boolean;
  bypassPreferences?: boolean;
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private reminderInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    Promise.all([
      this.sendCheckInReminders(),
      this.sendPostStayReviewRequests(),
    ]).catch((error: any) => {
      this.logger.error(
        `Initial reminder run failed: ${error?.message || error}`,
      );
    });

    this.reminderInterval = setInterval(
      () => {
        Promise.all([
          this.sendCheckInReminders(),
          this.sendPostStayReviewRequests(),
        ]).catch((error: any) => {
          this.logger.error(`Reminder run failed: ${error?.message || error}`);
        });
      },
      15 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  findByAccount(accountId: number) {
    return this.prisma.notification.findMany({
      where: { accountId },
      orderBy: { dateEnvoi: 'desc' },
    });
  }

  markAsRead(id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { lu: true },
    });
  }

  markAllAsRead(accountId: number) {
    return this.prisma.notification.updateMany({
      where: { accountId, lu: false },
      data: { lu: true },
    });
  }

  remove(id: number) {
    return this.prisma.notification.delete({ where: { id } });
  }

  async notifyNewHotel(hotel: { id: number; nom: string; ville: string }) {
    const recipients = await this.prisma.account.findMany({
      where: { actif: true },
      select: {
        id: true,
        profile: {
          select: {
            destinationsPreferees: true,
          },
        },
      },
    });

    const message = `New hotel added: ${hotel.nom} in ${hotel.ville}. Discover it now.`;
    const matchingRecipientIds = recipients
      .filter((entry) => {
        const preferences = entry.profile?.destinationsPreferees ?? [];
        return (
          preferences.length === 0 ||
          preferences.some(
            (value) =>
              value.toLowerCase() === hotel.ville.toLowerCase() ||
              value.toLowerCase() === hotel.nom.toLowerCase(),
          )
        );
      })
      .map((entry) => entry.id);

    await this.notifyMany(matchingRecipientIds, {
      message,
      type: TypeNotification.PROMOTION,
      subject: `New destination: ${hotel.nom}`,
      actionPath: `/hotels/${hotel.id}`,
      actionLabel: 'Open VoyageHub',
      templateSlug: 'promotion.new-destination',
      tokens: {
        hotel_name: hotel.nom,
        city: hotel.ville,
      },
    });
  }

  async notifyNewOffer(offer: {
    titre: string;
    tauxRemise: number;
    hotelId: number;
    hotelName?: string;
    hotelCity?: string;
  }) {
    const recipients = await this.prisma.account.findMany({
      where: { actif: true },
      select: {
        id: true,
        profile: {
          select: {
            destinationsPreferees: true,
          },
        },
      },
    });

    const hotelName = offer.hotelName ? ` at ${offer.hotelName}` : '';
    const message = `New special offer${hotelName}: ${offer.titre} (${offer.tauxRemise}% off).`;
    const matchingRecipientIds = recipients
      .filter((entry) => {
        const preferences = entry.profile?.destinationsPreferees ?? [];
        return (
          preferences.length === 0 ||
          preferences.some((value) => {
            const lowered = value.toLowerCase();
            return (
              lowered === (offer.hotelName || '').toLowerCase() ||
              lowered === (offer.hotelCity || '').toLowerCase()
            );
          })
        );
      })
      .map((entry) => entry.id);

    await this.notifyMany(matchingRecipientIds, {
      message,
      type: TypeNotification.PROMOTION,
      subject: `Special offer: ${offer.titre}`,
      actionPath: `/offers`,
      actionLabel: 'Explore offers',
      templateSlug: 'promotion.new-offer',
      tokens: {
        offer_title: offer.titre,
        discount: `${offer.tauxRemise}%`,
        hotel_name: offer.hotelName || '',
        hotel_name_clause: offer.hotelName ? ` at ${offer.hotelName}` : '',
      },
    });
  }

  async notifyReservationStatusUpdate(input: {
    accountId: number;
    bookingReference: string;
    hotelName: string;
    status: StatutReservation;
    checkInDate?: Date;
    checkOutDate?: Date;
    guests?: number;
    totalAmount?: number;
  }) {
    const statusLabel = this.formatReservationStatus(input.status);

    let type: TypeNotification = TypeNotification.CONFIRMATION_ANNULATION;
    let subject = `Booking update: ${statusLabel}`;
    let message = `Your reservation at ${input.hotelName} is now ${statusLabel}.`;
    let templateSlug = 'reservation.confirmed';

    if (input.status === StatutReservation.CONFIRMEE) {
      type = TypeNotification.CONFIRMATION_RESERVATION;
      subject = `Booking confirmed`;
      message = `Your reservation at ${input.hotelName} has been confirmed.`;
      templateSlug = 'reservation.confirmed';
    } else if (input.status === StatutReservation.ANNULEE) {
      type = TypeNotification.ANNULATION_RESERVATION;
      subject = `Booking cancelled`;
      message = `Your reservation at ${input.hotelName} has been cancelled.`;
      templateSlug = 'reservation.cancelled';
    }

    await this.notifyAccount({
      accountId: input.accountId,
      type,
      subject,
      message,
      actionPath: '/reservations/history',
      actionLabel: 'View reservation',
      templateSlug,
      tokens: {
        hotel_name: input.hotelName,
        conf_code: input.bookingReference,
        check_in: input.checkInDate
          ? input.checkInDate.toISOString().slice(0, 10)
          : '',
        check_out: input.checkOutDate
          ? input.checkOutDate.toISOString().slice(0, 10)
          : '',
        guests: input.guests ?? '',
        amount:
          input.totalAmount != null
            ? `${input.totalAmount.toFixed(2)} EUR`
            : '',
      },
    });
  }

  async sendPaymentReceipt(input: {
    accountId: number;
    bookingReference: string;
    hotelName: string;
    checkInDate: Date;
    checkOutDate: Date;
    roomSubtotal: number;
    taxes: number;
    totalAmount: number;
  }) {
    await this.notifyAccount({
      accountId: input.accountId,
      type: TypeNotification.CONFIRMATION_RESERVATION,
      subject: `Payment receipt for booking ${input.bookingReference}`,
      message: `Payment received for your stay at ${input.hotelName}.`,
      actionPath: '/payment/success',
      actionLabel: 'View receipt',
      templateSlug: 'reservation.payment-receipt',
      tokens: {
        conf_code: input.bookingReference,
        hotel_name: input.hotelName,
        check_in: input.checkInDate.toISOString().slice(0, 10),
        check_out: input.checkOutDate.toISOString().slice(0, 10),
        room_subtotal: `${input.roomSubtotal.toFixed(2)} EUR`,
        taxes: `${input.taxes.toFixed(2)} EUR`,
        amount: `${input.totalAmount.toFixed(2)} EUR`,
      },
      mailOnly: true,
      bypassPreferences: true,
    });
  }

  async notifyComplaintReceived(input: {
    accountId: number;
    bookingReference: string;
    ticketId: number;
    subject: string;
    status: string;
  }) {
    await this.notifyAccount({
      accountId: input.accountId,
      type: TypeNotification.RECLAMATION,
      subject: `We received your support request #${input.ticketId}`,
      message: `Support request #${input.ticketId} has been created.`,
      actionPath: '/contact',
      actionLabel: 'Open support',
      templateSlug: 'complaint.received',
      tokens: {
        conf_code: input.bookingReference,
        ticket_id: input.ticketId,
        subject: input.subject,
        status: input.status,
      },
      bypassPreferences: true,
    });
  }

  async notifyComplaintUpdated(input: {
    accountId: number;
    ticketId: number;
    status: string;
    agencyResponse?: string | null;
    closed?: boolean;
  }) {
    await this.notifyAccount({
      accountId: input.accountId,
      type: TypeNotification.RECLAMATION,
      subject: `Update on support ticket #${input.ticketId}`,
      message: `Support ticket #${input.ticketId} is now ${input.status}.`,
      actionPath: '/contact',
      actionLabel: 'Review update',
      templateSlug: input.closed ? 'complaint.closed' : 'complaint.updated',
      tokens: {
        ticket_id: input.ticketId,
        status: input.status,
        agency_response:
          input.agencyResponse || 'No response has been added yet.',
      },
      bypassPreferences: true,
    });
  }

  async sendCheckInReminders() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        statut: StatutReservation.CONFIRMEE,
        dateArrivee: {
          gt: now,
          lte: horizon,
        },
      },
      select: {
        accountId: true,
        codeConfirmation: true,
        dateArrivee: true,
        dateDepart: true,
        chambre: {
          select: {
            hotel: {
              select: {
                nom: true,
              },
            },
          },
        },
      },
    });

    for (const reservation of reservations) {
      const checkIn = reservation.dateArrivee.toISOString().slice(0, 10);
      const reminderToken = `at ${reservation.chambre.hotel.nom} is on ${checkIn}`;
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          accountId: reservation.accountId,
          type: TypeNotification.RAPPEL,
          message: {
            contains: reminderToken,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (alreadySent) {
        continue;
      }

      await this.notifyAccount({
        accountId: reservation.accountId,
        type: TypeNotification.RAPPEL,
        subject: `Reminder: upcoming check-in`,
        message: `Reminder: your check-in ${reminderToken}.`,
        actionPath: '/reservations/history',
        actionLabel: 'Review booking',
        templateSlug: 'reservation.checkin-reminder',
        tokens: {
          hotel_name: reservation.chambre.hotel.nom,
          check_in: reservation.dateArrivee.toISOString().slice(0, 10),
          check_out: reservation.dateDepart.toISOString().slice(0, 10),
          conf_code: reservation.codeConfirmation,
        },
      });
    }
  }

  async sendPostStayReviewRequests() {
    const now = new Date();
    const lookback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        statut: {
          in: [StatutReservation.CONFIRMEE, StatutReservation.TERMINEE],
        },
        dateDepart: {
          gte: lookback,
          lt: now,
        },
        avis: {
          none: {},
        },
      },
      select: {
        id: true,
        accountId: true,
        codeConfirmation: true,
        dateArrivee: true,
        dateDepart: true,
        chambre: {
          select: {
            hotel: {
              select: {
                nom: true,
              },
            },
          },
        },
      },
    });

    for (const reservation of reservations) {
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          accountId: reservation.accountId,
          type: TypeNotification.RAPPEL,
          message: {
            contains: `review request ${reservation.codeConfirmation}`,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (alreadySent) {
        continue;
      }

      const notification = await this.prisma.notification.create({
        data: {
          accountId: reservation.accountId,
          message: `Post-stay review request ${reservation.codeConfirmation}`,
          type: TypeNotification.RAPPEL,
        },
      });

      const account = await this.prisma.account.findUnique({
        where: { id: reservation.accountId },
        include: { profile: true },
      });

      if (!account?.actif) {
        continue;
      }

      try {
        await this.mailService.sendTemplate({
          to: account.email,
          templateSlug: 'reservation.review-request',
          tokens: {
            user_name: account.profile?.prenom || account.email.split('@')[0],
            hotel_name: reservation.chambre.hotel.nom,
            conf_code: reservation.codeConfirmation,
          },
          actionLabel: 'Write a review',
          actionUrl: `${this.mailService.getAppWebUrl()}/hotels`,
          fallbackSubject: `How was your stay at ${reservation.chambre.hotel.nom}?`,
          fallbackBody: 'We would love to hear your feedback.',
        });
      } catch (error) {
        this.logger.warn(
          `Failed to send review request for ${reservation.codeConfirmation}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.logger.debug(`Sent review request notification ${notification.id}`);
    }
  }

  private async notifyMany(
    accountIds: number[],
    payload: Omit<NotifyInput, 'accountId'>,
  ) {
    await Promise.all(
      [...new Set(accountIds)].map((accountId) =>
        this.notifyAccount({
          accountId,
          ...payload,
        }),
      ),
    );
  }

  private async notifyAccount(payload: NotifyInput) {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.accountId },
      include: { profile: true },
    });

    if (!account || !account.actif) {
      return null;
    }

    const allowsPromotion = account.profile?.notificationsPromotion ?? false;
    const allowsReservation = account.profile?.notificationsReservation ?? true;
    const isPromotionType = payload.type === TypeNotification.PROMOTION;

    if (
      !payload.bypassPreferences &&
      ((isPromotionType && !allowsPromotion) ||
        (!isPromotionType && !allowsReservation))
    ) {
      return null;
    }

    const notification = payload.mailOnly
      ? null
      : await this.prisma.notification.create({
          data: {
            accountId: payload.accountId,
            message: payload.message,
            type: payload.type,
          },
        });

    const actionUrl = this.resolveActionUrl(payload.actionPath);
    const text = actionUrl
      ? `${payload.message}\n\nOpen: ${actionUrl}`
      : payload.message;

    try {
      await this.mailService.sendTemplate({
        to: account.email,
        templateSlug: payload.templateSlug || 'reservation.confirmed',
        tokens: {
          user_name: account.profile?.prenom || account.email.split('@')[0],
          action_url: actionUrl,
          ...payload.tokens,
        },
        fallbackSubject: payload.subject,
        fallbackBody: text,
        actionLabel: payload.actionLabel,
        actionUrl,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send notification mail to ${account.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return notification;
  }

  private resolveActionUrl(actionPath?: string) {
    if (!actionPath) {
      return '';
    }

    const base = this.mailService.getAppWebUrl();
    return `${base}${actionPath.startsWith('/') ? actionPath : `/${actionPath}`}`;
  }

  private formatReservationStatus(status: StatutReservation) {
    switch (status) {
      case StatutReservation.CONFIRMEE:
        return 'confirmed';
      case StatutReservation.ANNULEE:
        return 'cancelled';
      case StatutReservation.BLOQUEE:
        return 'blocked';
      case StatutReservation.REFUSEE:
        return 'refused';
      case StatutReservation.TERMINEE:
        return 'completed';
      case StatutReservation.EN_ATTENTE:
      default:
        return 'pending';
    }
  }
}

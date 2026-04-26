import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StatutReservation, TypeNotification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { EmailService } from './email.service';

type NotifyInput = {
  accountId: number;
  message: string;
  type: TypeNotification;
  subject: string;
  actionPath?: string;
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private reminderInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.sendCheckInReminders().catch((error: any) => {
      this.logger.error(`Initial reminder run failed: ${error?.message || error}`);
    });

    this.reminderInterval = setInterval(() => {
      this.sendCheckInReminders().catch((error: any) => {
        this.logger.error(`Reminder run failed: ${error?.message || error}`);
      });
    }, 15 * 60 * 1000);
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
    return this.prisma.notification.update({ where: { id }, data: { lu: true } });
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
      select: { id: true },
    });

    const message = `New hotel added: ${hotel.nom} in ${hotel.ville}. Discover it now.`;
    await this.notifyMany(
      recipients.map((entry) => entry.id),
      {
        message,
        type: TypeNotification.PROMOTION,
        subject: `New destination: ${hotel.nom}`,
        actionPath: `/hotels/${hotel.id}`,
      },
    );
  }

  async notifyNewOffer(offer: { titre: string; tauxRemise: number; hotelId: number; hotelName?: string }) {
    const recipients = await this.prisma.account.findMany({
      where: { actif: true },
      select: { id: true },
    });

    const hotelName = offer.hotelName ? ` at ${offer.hotelName}` : '';
    const message = `New special offer${hotelName}: ${offer.titre} (${offer.tauxRemise}% off).`;

    await this.notifyMany(
      recipients.map((entry) => entry.id),
      {
        message,
        type: TypeNotification.PROMOTION,
        subject: `Special offer: ${offer.titre}`,
        actionPath: `/offers`,
      },
    );
  }

  async notifyReservationStatusUpdate(input: {
    accountId: number;
    bookingReference: string;
    hotelName: string;
    status: StatutReservation;
    checkInDate?: Date;
  }) {
    const statusLabel = this.formatReservationStatus(input.status);

    let type: TypeNotification = TypeNotification.CONFIRMATION_ANNULATION;
    let subject = `Booking update: ${statusLabel}`;
    let message = `Booking ${input.bookingReference} at ${input.hotelName} is now ${statusLabel}.`;

    if (input.status === StatutReservation.CONFIRMEE) {
      type = TypeNotification.CONFIRMATION_RESERVATION;
      subject = `Booking confirmed: ${input.bookingReference}`;
      message = `Your booking ${input.bookingReference} at ${input.hotelName} has been confirmed.`;
    } else if (input.status === StatutReservation.ANNULEE) {
      type = TypeNotification.ANNULATION_RESERVATION;
      subject = `Booking cancelled: ${input.bookingReference}`;
      message = `Your booking ${input.bookingReference} at ${input.hotelName} has been cancelled.`;
    }

    await this.notifyAccount({
      accountId: input.accountId,
      type,
      subject,
      message,
      actionPath: '/reservations/history',
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
      include: {
        account: { include: { profile: true } },
        chambre: { include: { hotel: true } },
      },
    });

    for (const reservation of reservations) {
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          accountId: reservation.accountId,
          type: TypeNotification.RAPPEL,
          message: {
            contains: reservation.codeConfirmation,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (alreadySent) {
        continue;
      }

      const checkIn = reservation.dateArrivee.toISOString().slice(0, 10);
      await this.notifyAccount({
        accountId: reservation.accountId,
        type: TypeNotification.RAPPEL,
        subject: `Reminder: upcoming check-in (${reservation.codeConfirmation})`,
        message: `Reminder: your check-in for booking ${reservation.codeConfirmation} at ${reservation.chambre.hotel.nom} is on ${checkIn}.`,
        actionPath: '/reservations/history',
      });
    }
  }

  private async notifyMany(accountIds: number[], payload: Omit<NotifyInput, 'accountId'>) {
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

    if ((isPromotionType && !allowsPromotion) || (!isPromotionType && !allowsReservation)) {
      return null;
    }

    const notification = await this.prisma.notification.create({
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

    await this.emailService.send({
      to: account.email,
      subject: payload.subject,
      text,
      html: this.renderEmailHtml(payload.subject, payload.message, actionUrl),
    });

    return notification;
  }

  private resolveActionUrl(actionPath?: string) {
    if (!actionPath) {
      return '';
    }

    const base = process.env.APP_WEB_URL || 'http://localhost:3000';
    return `${base}${actionPath.startsWith('/') ? actionPath : `/${actionPath}`}`;
  }

  private renderEmailHtml(subject: string, message: string, actionUrl?: string) {
    const actionBlock = actionUrl
      ? `<p style="margin:20px 0 0;"><a href="${actionUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#005051;color:#ffffff;text-decoration:none;font-weight:700;">Open VoyageHub</a></p>`
      : '';

    return `
      <div style="font-family:Inter,Arial,sans-serif;padding:20px;background:#f8fafc;color:#1f2937;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
          <h2 style="margin:0 0 10px;color:#015081;">${subject}</h2>
          <p style="margin:0;line-height:1.6;color:#475569;">${message}</p>
          ${actionBlock}
        </div>
      </div>
    `;
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

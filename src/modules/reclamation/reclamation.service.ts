import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';
import { StatutReclamation } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReclamationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateReclamationDto) {
    const complaint = await this.prisma.reclamation.create({
      data: dto,
      include: {
        reservation: {
          include: {
            account: {
              include: { profile: true },
            },
          },
        },
      },
    });

    await this.notificationService.notifyComplaintReceived({
      accountId: complaint.reservation.accountId,
      bookingReference: complaint.reservation.codeConfirmation,
      ticketId: complaint.id,
      subject: complaint.sujet,
      status: complaint.statut,
    });

    try {
      await this.mailService.sendTemplate({
        to: await this.mailService.getSupportEmail(),
        templateSlug: 'ops.new-complaint-alert',
        tokens: {
          ticket_id: complaint.id,
          conf_code: complaint.reservation.codeConfirmation,
          user_name:
            complaint.reservation.account.profile?.prenom ||
            complaint.reservation.account.email.split('@')[0],
          subject: complaint.sujet,
        },
        actionLabel: 'Open complaints',
        actionUrl: `${this.mailService.getAppWebUrl()}/admin/complaints`,
        fallbackSubject: `New complaint received: ticket #${complaint.id}`,
        fallbackBody: `A new support request has been created for booking ${complaint.reservation.codeConfirmation}.`,
      });
    } catch {
      // Keep complaint creation successful even if the internal alert fails.
    }

    return complaint;
  }

  findAll() {
    return this.prisma.reclamation.findMany({
      include: { reservation: true, agenceVoyage: true },
    });
  }

  findOne(id: number) {
    return this.prisma.reclamation.findUnique({
      where: { id },
      include: { reservation: true, agenceVoyage: true },
    });
  }

  findByAgence(agenceVoyageId: number) {
    return this.prisma.reclamation.findMany({ where: { agenceVoyageId } });
  }

  async update(id: number, dto: UpdateReclamationDto) {
    const existing = await this.prisma.reclamation.findUnique({
      where: { id },
      include: {
        reservation: true,
      },
    });

    const updated = await this.prisma.reclamation.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.statut === StatutReclamation.RESOLUE
          ? { dateResolution: new Date() }
          : {}),
      },
      include: {
        reservation: true,
      },
    });

    const shouldNotify =
      !!existing &&
      (dto.statut !== undefined || dto.reponseAgence !== undefined) &&
      (existing.statut !== updated.statut ||
        existing.reponseAgence !== updated.reponseAgence);

    if (shouldNotify) {
      await this.notificationService.notifyComplaintUpdated({
        accountId: updated.reservation.accountId,
        ticketId: updated.id,
        status: updated.statut,
        agencyResponse: updated.reponseAgence,
        closed: updated.statut === StatutReclamation.FERMEE,
      });
    }

    return updated;
  }

  updateStatut(id: number, statut: StatutReclamation, reponseAgence?: string) {
    return this.update(id, {
      statut,
      ...(reponseAgence ? { reponseAgence } : {}),
    });
  }

  remove(id: number) {
    return this.prisma.reclamation.delete({ where: { id } });
  }
}

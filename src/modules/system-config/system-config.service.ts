import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

const defaultSystemConfigs: CreateSystemConfigDto[] = [
  {
    cle: 'site_name',
    valeur: 'VoyageHub',
    description: 'The name of the platform displayed across the application.',
  },
  {
    cle: 'default_currency',
    valeur: 'EUR',
    description: 'Default currency for all pricing and transactions.',
  },
  {
    cle: 'max_booking_advance_days',
    valeur: '365',
    description: 'Maximum number of days in advance a reservation can be made.',
  },
  {
    cle: 'cancellation_deadline_hours',
    valeur: '48',
    description: 'Minimum hours before check-in for free cancellation.',
  },
  {
    cle: 'commission_rate',
    valeur: '12',
    description: 'Agency commission rate (%) on each booking.',
  },
  {
    cle: 'support_email',
    valeur: 'support@voyagehub.com',
    description: 'Customer support email address.',
  },
  {
    cle: 'maintenance_mode',
    valeur: 'false',
    description: 'When true, the platform shows a maintenance page.',
  },
  {
    cle: 'max_guests_per_room',
    valeur: '6',
    description: 'Maximum number of guests allowed per room booking.',
  },
  {
    cle: 'mail_sender_name',
    valeur: 'VoyageHub',
    description: 'Sender display name used in transactional emails.',
  },
  {
    cle: 'mail_reply_to',
    valeur: 'support@voyagehub.com',
    description: 'Reply-to address for support and transactional emails.',
  },
  {
    cle: 'app_web_url',
    valeur: 'http://localhost:3000',
    description: 'Public web URL used in email links.',
  },
];

@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  create(dto: CreateSystemConfigDto) {
    return this.prisma.systemConfig.create({ data: dto });
  }

  findAll() {
    return this.ensureDefaults().then(() =>
      this.prisma.systemConfig.findMany({
        include: { conditionsAnnulation: true },
      }),
    );
  }

  findByCle(cle: string) {
    return this.ensureDefaults().then(() =>
      this.prisma.systemConfig.findUnique({ where: { cle } }),
    );
  }

  update(id: number, dto: UpdateSystemConfigDto) {
    return this.prisma.systemConfig.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.systemConfig.delete({ where: { id } });
  }

  private async ensureDefaults() {
    await Promise.all(
      defaultSystemConfigs.map((config) =>
        this.prisma.systemConfig.upsert({
          where: { cle: config.cle },
          create: config,
          update: {
            description: config.description,
          },
        }),
      ),
    );
  }
}

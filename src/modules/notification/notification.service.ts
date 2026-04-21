import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

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

  remove(id: number) {
    return this.prisma.notification.delete({ where: { id } });
  }
}

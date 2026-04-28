import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [totalReservations, totalRevenue, activeHotels] = await Promise.all([
      this.prisma.reservation.count(),
      this.prisma.reservation.aggregate({
        _sum: { montantTotal: true },
      }),
      this.prisma.hotel.count({ where: { actif: true } }),
    ]);

    return {
      totalReservations,
      totalRevenue: totalRevenue._sum.montantTotal || 0,
      activeHotels,
      // Add more stats as needed
    };
  }

  async getReservationChart() {
    // Get reservations for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        dateCreation: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        dateCreation: true,
      },
    });

    // Group by day
    const chartData = [0, 0, 0, 0, 0, 0, 0]; // Last 7 days
    reservations.forEach((res) => {
      const dayIndex = Math.floor(
        (new Date().getTime() - res.dateCreation.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (dayIndex >= 0 && dayIndex < 7) {
        chartData[6 - dayIndex]++;
      }
    });

    return chartData;
  }
}

import { StatutReservation } from '@prisma/client';
import { ReservationService } from './reservation.service';

describe('ReservationService', () => {
  let service: ReservationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new ReservationService(
      prisma,
      {
        notifyReservationStatusUpdate: jest.fn(),
      } as any,
      {
        sendTemplate: jest.fn(),
      } as any,
    );
  });

  it('applies overlapping start/end filters for calendar pagination queries', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      hotelId: 3,
      status: StatutReservation.CONFIRMEE,
      search: 'azure',
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-07-01T00:00:00.000Z',
    });

    const where = prisma.reservation.findMany.mock.calls[0][0].where;

    expect(where.chambre).toEqual({ hotelId: 3 });
    expect(where.statut).toBe(StatutReservation.CONFIRMEE);
    expect(where.AND).toEqual([
      { dateArrivee: { lt: new Date('2026-07-01T00:00:00.000Z') } },
      { dateDepart: { gt: new Date('2026-06-01T00:00:00.000Z') } },
    ]);
    expect(where.OR).toHaveLength(3);
  });

  it('includes the account filter when fetching calendar reservations for a client', async () => {
    await service.findByAccount(42, {
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-07-01T00:00:00.000Z',
      hotelId: 8,
    });

    const where = prisma.reservation.findMany.mock.calls[0][0].where;

    expect(where.accountId).toBe(42);
    expect(where.chambre).toEqual({ hotelId: 8 });
    expect(where.AND).toEqual([
      { dateArrivee: { lt: new Date('2026-07-01T00:00:00.000Z') } },
      { dateDepart: { gt: new Date('2026-06-01T00:00:00.000Z') } },
    ]);
  });
});

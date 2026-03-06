import { PrismaClient } from '@prisma/client';
import { BOOKING_FREE_MINS, BOOKING_FREE_MINS_SUBSCRIBED, PENALTY_HOURS, MAX_ACTIVE_BOOKINGS, MAX_ACTIVE_SESSIONS } from '../config';

export class BookingService {
  constructor(private db: PrismaClient) {}

  async createBooking(userId: string, cellId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.hasDebt) throw new Error(`User has debt: ${user.debtAmount}`);

    const activeBookings = await this.db.booking.count({ where: { userId, status: 'ACTIVE' } });
    if (activeBookings >= MAX_ACTIVE_BOOKINGS) throw new Error('Max active bookings reached');

    const activeSessions = await this.db.session.count({ where: { userId, endAt: null } });
    if (activeSessions >= MAX_ACTIVE_SESSIONS) throw new Error('Max active sessions reached');

    const cell = await this.db.cell.findUnique({ where: { id: cellId } });
    if (!cell || cell.status !== 'FREE') throw new Error('Cell is not available');

    const now = new Date();
    const penaltyBooking = await this.db.booking.findFirst({
      where: {
        userId,
        penaltyUntil: { gt: now },
        status: { in: ['CANCELLED', 'EXPIRED'] },
      },
    });
    const isFree = penaltyBooking === null;

    const sub = await this.db.subscription.findFirst({
      where: { userId, isActive: true, endAt: { gt: now } },
    });
    const freeMins = sub ? BOOKING_FREE_MINS_SUBSCRIBED : BOOKING_FREE_MINS;
    const endsAt = new Date(now.getTime() + freeMins * 60 * 1000);

    const booking = await this.db.booking.create({
      data: { userId, cellId, status: 'ACTIVE', isFree, endsAt },
    });
    await this.db.cell.update({ where: { id: cellId }, data: { status: 'BUSY' } });
    return booking;
  }

  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) throw new Error('Booking not found');
    if (booking.status !== 'ACTIVE') throw new Error('Booking is not active');

    const now = new Date();
    const penaltyUntil = new Date(now.getTime() + PENALTY_HOURS * 60 * 60 * 1000);

    await this.db.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', penaltyUntil },
    });
    await this.db.cell.update({ where: { id: booking.cellId }, data: { status: 'FREE' } });
    return penaltyUntil;
  }

  async expireBooking(bookingId: string) {
    const booking = await this.db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== 'ACTIVE') return null;

    const now = new Date();
    if (booking.endsAt > now) return null;

    await this.db.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } });

    const activeSession = await this.db.session.findFirst({
      where: { bookingId, endAt: null },
    });
    if (!activeSession) {
      await this.db.cell.update({ where: { id: booking.cellId }, data: { status: 'FREE' } });
    }
    return booking;
  }
}

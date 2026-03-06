import { PrismaClient, Tariff } from '@prisma/client';
import { DOOR_OPEN_FRAUD_SECONDS } from '../config';

export class SessionService {
  constructor(private db: PrismaClient) {}

  async startSession(userId: string, cellId: string, bookingId?: string | null) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.hasDebt) throw new Error(`User has debt: ${user.debtAmount}`);

    const activeSessions = await this.db.session.count({ where: { userId, endAt: null } });
    if (activeSessions >= 2) throw new Error('Max active sessions reached');

    const cell = await this.db.cell.findUnique({ where: { id: cellId } });
    if (!cell) throw new Error('Cell not found');

    if (bookingId) {
      const booking = await this.db.booking.findUnique({ where: { id: bookingId } });
      if (booking && booking.status === 'ACTIVE') {
        await this.db.booking.update({ where: { id: bookingId }, data: { status: 'CONVERTED' } });
      }
    }

    const now = new Date();
    const session = await this.db.session.create({
      data: { userId, cellId, bookingId: bookingId || null, startAt: now },
    });
    await this.db.cell.update({ where: { id: cellId }, data: { status: 'BUSY' } });
    return session;
  }

  async endSession(sessionId: string, doorClosed: boolean, chargerDisconnected: boolean) {
    if (!doorClosed) throw new Error('Door must be closed before ending session');
    if (!chargerDisconnected) throw new Error('Charger must be disconnected before ending session');

    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { cell: { include: { locker: true } } },
    });
    if (!session) throw new Error('Session not found');
    if (session.endAt !== null) throw new Error('Session already ended');

    const now = new Date();
    const durationMins = (now.getTime() - session.startAt.getTime()) / 60000;

    const tariff = await this.getTariff(session.userId, now);
    const cost = this.calculateCost(session.startAt, now, tariff);

    const ended = await this.db.session.update({
      where: { id: sessionId },
      data: { endAt: now, durationMins, cost },
    });

    await this.db.cell.update({ where: { id: session.cellId }, data: { status: 'FREE' } });

    if (cost > 0) {
      const { PaymentService } = await import('./payment');
      const paymentSvc = new PaymentService(this.db);
      await paymentSvc.charge(session.userId, cost, sessionId);
    }

    return ended;
  }

  async getTariff(userId: string, now: Date): Promise<Tariff | null> {
    const sub = await this.db.subscription.findFirst({
      where: { userId, isActive: true, endAt: { gt: now } },
    });
    if (sub) {
      const tariff = await this.db.tariff.findUnique({ where: { id: sub.tariffId } });
      if (tariff) return tariff;
    }

    const hour = now.getHours();
    const isNight = hour >= 22 || hour < 6;
    const tariff = await this.db.tariff.findFirst({
      where: { isSubscription: false, isNight },
    });
    if (tariff) return tariff;
    return this.db.tariff.findFirst({ where: { isSubscription: false } });
  }

  calculateCost(start: Date, end: Date, tariff: Tariff | null): number {
    if (!tariff) return 0;
    const durationMins = (end.getTime() - start.getTime()) / 60000;
    const freeMins = tariff.freeMins ?? 0;
    const billableMins = Math.max(0, durationMins - freeMins);
    let cost = billableMins * tariff.pricePerMinute;
    if (tariff.discountPct && tariff.discountPct > 0) {
      cost = cost * (1 - tariff.discountPct / 100);
    }
    return Math.round(cost * 100) / 100;
  }

  async forceCancelSession(sessionId: string) {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.endAt !== null) return;

    const now = new Date();
    const elapsed = (now.getTime() - session.startAt.getTime()) / 1000;
    if (elapsed < DOOR_OPEN_FRAUD_SECONDS) return;

    const durationMins = elapsed / 60;
    const tariff = await this.getTariff(session.userId, now);
    const cost = this.calculateCost(session.startAt, now, tariff);

    await this.db.session.update({
      where: { id: sessionId },
      data: { endAt: now, durationMins, cost },
    });
    await this.db.cell.update({ where: { id: session.cellId }, data: { status: 'FREE' } });

    if (cost > 0) {
      const { PaymentService } = await import('./payment');
      const paymentSvc = new PaymentService(this.db);
      await paymentSvc.charge(session.userId, cost, sessionId);
    }
  }
}

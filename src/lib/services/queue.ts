import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification';
import { BOOKING_FREE_MINS_SUBSCRIBED } from '../config';

export class QueueService {
  constructor(private db: PrismaClient) {}

  async joinQueue(userId: string, lockerId: string) {
    const existing = await this.db.waitQueue.findFirst({ where: { userId, lockerId } });
    if (existing) return existing;

    const count = await this.db.waitQueue.count({ where: { lockerId } });
    const position = count + 1;
    return this.db.waitQueue.create({ data: { userId, lockerId, position } });
  }

  async leaveQueue(userId: string, lockerId: string): Promise<void> {
    const entry = await this.db.waitQueue.findFirst({ where: { userId, lockerId } });
    if (!entry) return;
    await this.db.waitQueue.delete({ where: { id: entry.id } });
    const remaining = await this.db.waitQueue.findMany({
      where: { lockerId },
      orderBy: { createdAt: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.db.waitQueue.update({ where: { id: remaining[i].id }, data: { position: i + 1 } });
    }
  }

  async notifyNext(lockerId: string): Promise<void> {
    const nextEntry = await this.db.waitQueue.findFirst({
      where: { lockerId },
      orderBy: { position: 'asc' },
    });
    if (!nextEntry) return;

    const notifSvc = new NotificationService(this.db);
    await notifSvc.sendQueueTurn(nextEntry.userId, lockerId);

    const cell = await this.db.cell.findFirst({ where: { lockerId, status: 'FREE' } });
    if (cell) {
      const now = new Date();
      const endsAt = new Date(now.getTime() + BOOKING_FREE_MINS_SUBSCRIBED * 60 * 1000);
      await this.db.booking.create({
        data: { userId: nextEntry.userId, cellId: cell.id, status: 'ACTIVE', isFree: true, endsAt },
      });
      await this.db.cell.update({ where: { id: cell.id }, data: { status: 'BUSY' } });
    }

    await this.db.waitQueue.delete({ where: { id: nextEntry.id } });
    const remaining = await this.db.waitQueue.findMany({
      where: { lockerId },
      orderBy: { createdAt: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.db.waitQueue.update({ where: { id: remaining[i].id }, data: { position: i + 1 } });
    }
  }
}

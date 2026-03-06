import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';
import { NotificationService } from '@/lib/services/notification';

async function expireOldBookings() {
  const now = new Date();
  const expired = await prisma.booking.findMany({ where: { status: 'ACTIVE', endsAt: { lt: now } } });
  const svc = new BookingService(prisma);
  for (const b of expired) await svc.expireBooking(b.id);
}

async function checkOpenDoors() {
  const threshold = new Date(Date.now() - 10 * 60 * 1000);
  const longSessions = await prisma.session.findMany({ where: { endAt: null, startAt: { lt: threshold } } });
  const notif = new NotificationService(prisma);
  for (const s of longSessions) {
    const minutes = Math.floor((Date.now() - s.startAt.getTime()) / 60000);
    await notif.sendOpenDoorReminder(s.userId, minutes);
  }
}

async function checkDoubleRentals() {
  const activeSessions = await prisma.session.findMany({ where: { endAt: null } });
  const counts: Record<string, number> = {};
  for (const s of activeSessions) counts[s.userId] = (counts[s.userId] || 0) + 1;
  const notif = new NotificationService(prisma);
  for (const [userId, count] of Object.entries(counts)) {
    if (count >= 2) await notif.sendRentalReminder(userId);
  }
}

async function checkAnomalies() {
  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const anomalies = await prisma.session.findMany({ where: { endAt: null, startAt: { lt: threshold } } });
  const notif = new NotificationService(prisma);
  for (const s of anomalies) await notif.notifyAdminAnomaly(s.id);
}

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const results: Record<string, string> = {};
  for (const [name, fn] of [
    ['expire-bookings', expireOldBookings],
    ['check-open-doors', checkOpenDoors],
    ['check-double-rentals', checkDoubleRentals],
    ['check-anomalies', checkAnomalies],
  ] as [string, () => Promise<void>][]) {
    try {
      await fn();
      results[name] = 'ok';
    } catch (e) {
      results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const overall = Object.values(results).every((v) => v === 'ok') ? 'ok' : 'partial';
  return NextResponse.json({ status: overall, task: 'run-all', results });
}

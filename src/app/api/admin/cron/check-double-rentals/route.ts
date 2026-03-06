import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { NotificationService } from '@/lib/services/notification';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const activeSessions = await prisma.session.findMany({ where: { endAt: null } });
  const counts: Record<string, number> = {};
  for (const s of activeSessions) counts[s.userId] = (counts[s.userId] || 0) + 1;
  const notif = new NotificationService(prisma);
  for (const [userId, count] of Object.entries(counts)) {
    if (count >= 2) await notif.sendRentalReminder(userId);
  }
  return NextResponse.json({ status: 'ok', task: 'check-double-rentals' });
}

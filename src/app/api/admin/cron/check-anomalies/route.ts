import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { NotificationService } from '@/lib/services/notification';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const anomalies = await prisma.session.findMany({ where: { endAt: null, startAt: { lt: threshold } } });
  const notif = new NotificationService(prisma);
  for (const s of anomalies) await notif.notifyAdminAnomaly(s.id);
  return NextResponse.json({ status: 'ok', task: 'check-anomalies' });
}

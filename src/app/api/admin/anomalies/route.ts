import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const longSessions = await prisma.session.findMany({
    where: { endAt: null, startAt: { lt: threshold } },
    include: { user: true, cell: { include: { locker: true } } },
  });

  return NextResponse.json(
    longSessions.map((s) => ({
      sessionId: s.id,
      userId: s.userId,
      userMaxId: s.user?.maxId ?? null,
      cellId: s.cellId,
      locker: s.cell?.locker?.name ?? null,
      startAt: s.startAt,
      durationHours: Math.round(((Date.now() - s.startAt.getTime()) / 3600000) * 100) / 100,
    })),
  );
}

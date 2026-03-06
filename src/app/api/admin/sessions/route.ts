import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const userId = searchParams.get('user_id') || undefined;
  const activeOnly = searchParams.get('active_only') === 'true';
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (activeOnly) where.endAt = null;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: true, cell: { include: { locker: true } } },
    }),
    prisma.session.count({ where }),
  ]);

  return NextResponse.json({
    items: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userMaxId: s.user?.maxId ?? null,
      locker: s.cell?.locker?.name ?? null,
      startAt: s.startAt,
      endAt: s.endAt,
      durationMins: s.durationMins,
      cost: s.cost,
      isPaid: s.isPaid,
    })),
    total,
  });
}

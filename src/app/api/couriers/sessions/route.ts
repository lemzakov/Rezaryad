import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.session.count({ where: { userId: user!.id } }),
  ]);

  return NextResponse.json({
    items: sessions.map((s) => ({
      id: s.id,
      startAt: s.startAt,
      endAt: s.endAt,
      durationMins: s.durationMins,
      cost: s.cost,
      isPaid: s.isPaid,
    })),
    total,
    page,
    limit,
  });
}

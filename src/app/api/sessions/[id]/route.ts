import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { cell: { include: { locker: true } } },
  });
  if (!session || session.userId !== user!.id) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    startAt: session.startAt,
    endAt: session.endAt,
    durationMins: session.durationMins,
    cost: session.cost,
    isPaid: session.isPaid,
    cell: {
      number: session.cell.number,
      locker: session.cell.locker ? { name: session.cell.locker.name } : null,
    },
  });
}

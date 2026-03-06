import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const booking = await prisma.booking.findFirst({
    where: { userId: user!.id, status: 'ACTIVE' },
    include: { cell: { include: { locker: true } } },
  });

  if (!booking) return NextResponse.json(null);

  return NextResponse.json({
    id: booking.id,
    cellId: booking.cellId,
    cell: {
      number: booking.cell.number,
      locker: { name: booking.cell.locker?.name, address: booking.cell.locker?.address },
    },
    status: booking.status,
    isFree: booking.isFree,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
  });
}

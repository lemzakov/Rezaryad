import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const lockers = await prisma.locker.findMany({ include: { cells: true } });
  const result = await Promise.all(
    lockers.map(async (locker) => {
      const cellIds = locker.cells.map((c) => c.id);
      const totalSessions = cellIds.length
        ? await prisma.session.count({ where: { cellId: { in: cellIds } } })
        : 0;
      const activeSessions = cellIds.length
        ? await prisma.session.count({ where: { cellId: { in: cellIds }, endAt: null } })
        : 0;
      const freeCells = locker.cells.filter((c) => c.status === 'FREE').length;
      return {
        id: locker.id,
        name: locker.name,
        address: locker.address,
        totalCells: locker.cells.length,
        freeCells,
        totalSessions,
        activeSessions,
      };
    }),
  );
  return NextResponse.json(result);
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const lockers = await prisma.locker.findMany({
    where: { isActive: true },
    include: { cells: true },
  });
  return NextResponse.json(
    lockers.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lon: l.lon,
      freeCells: l.cells.filter((c) => c.status === 'FREE').length,
      totalCells: l.cells.length,
    })),
  );
}

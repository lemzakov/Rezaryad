import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locker = await prisma.locker.findUnique({
    where: { id },
    include: { cells: true },
  });
  if (!locker) return NextResponse.json({ detail: 'Locker not found' }, { status: 404 });
  return NextResponse.json({
    id: locker.id,
    name: locker.name,
    address: locker.address,
    lat: locker.lat,
    lon: locker.lon,
    qrCode: locker.qrCode,
    isActive: locker.isActive,
    cells: locker.cells.map((c) => ({ id: c.id, number: c.number, status: c.status, hasCharger: c.hasCharger })),
    freeCells: locker.cells.filter((c) => c.status === 'FREE').length,
  });
}

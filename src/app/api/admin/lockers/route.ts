import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const lockers = await prisma.locker.findMany({ include: { cells: true } });
  return NextResponse.json(
    lockers.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lon: l.lon,
      qrCode: l.qrCode,
      isActive: l.isActive,
      cellCount: l.cells.length,
    })),
  );
}

export async function POST(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { name, address, lat, lon, qrCode } = body;
  if (!name || !address || lat == null || lon == null || !qrCode) {
    return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
  }

  const locker = await prisma.locker.create({
    data: { name, address, lat, lon, qrCode, isActive: true },
  });
  return NextResponse.json({ id: locker.id, name: locker.name, qrCode: locker.qrCode }, { status: 201 });
}

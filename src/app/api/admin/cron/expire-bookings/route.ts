import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const now = new Date();
  const expired = await prisma.booking.findMany({ where: { status: 'ACTIVE', endsAt: { lt: now } } });
  const svc = new BookingService(prisma);
  for (const b of expired) await svc.expireBooking(b.id);
  return NextResponse.json({ status: 'ok', task: 'expire-bookings' });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { cellId } = await req.json();
  const svc = new BookingService(prisma);
  try {
    const booking = await svc.createBooking(user!.id, cellId);
    return NextResponse.json({
      id: booking.id,
      cellId: booking.cellId,
      status: booking.status,
      isFree: booking.isFree,
      endsAt: booking.endsAt,
      createdAt: booking.createdAt,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}

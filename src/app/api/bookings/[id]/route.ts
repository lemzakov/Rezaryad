import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';
import { prisma } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const svc = new BookingService(prisma);
  try {
    const penaltyUntil = await svc.cancelBooking(id, user!.id);
    return NextResponse.json({ cancelled: true, penaltyUntil });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}

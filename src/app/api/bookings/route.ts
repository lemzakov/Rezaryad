import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { cellId } = await req.json();
  const svc = new BookingService(supabase);
  try {
    const booking = await svc.createBooking(user.id, cellId);
    return NextResponse.json(
      {
        id: booking.id,
        cellId: booking.cell_id,
        status: booking.status,
        isFree: booking.is_free,
        endsAt: booking.ends_at,
        createdAt: booking.created_at,
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}


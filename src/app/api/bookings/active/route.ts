import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, cells(number, lockers(name, address))')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!booking) return NextResponse.json(null);

  return NextResponse.json({
    id: booking.id,
    cellId: booking.cell_id,
    cell: {
      number: booking.cells?.number,
      locker: {
        name: booking.cells?.lockers?.name,
        address: booking.cells?.lockers?.address,
      },
    },
    status: booking.status,
    isFree: booking.is_free,
    endsAt: booking.ends_at,
    createdAt: booking.created_at,
  });
}


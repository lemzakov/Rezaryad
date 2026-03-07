import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'ACTIVE')
    .lt('ends_at', now)
    .returns<{ id: string }[]>();
  const svc = new BookingService(supabase);
  for (const b of expired ?? []) await svc.expireBooking(b.id);
  return NextResponse.json({ status: 'ok', task: 'expire-bookings' });
}


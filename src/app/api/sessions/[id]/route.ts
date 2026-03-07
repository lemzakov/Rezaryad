import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const { data: session } = await supabase
    .from('sessions')
    .select('*, cells(number, lockers(name))')
    .eq('id', id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    startAt: session.start_at,
    endAt: session.end_at,
    durationMins: session.duration_mins,
    cost: session.cost,
    isPaid: session.is_paid,
    cell: {
      number: session.cells?.number,
      locker: session.cells?.lockers ? { name: session.cells.lockers.name } : null,
    },
  });
}


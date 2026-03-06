import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { SessionService } from '@/lib/services/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;

  const { data: existing } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  const { doorClosed, chargerDisconnected } = await req.json();
  const svc = new SessionService(supabase);
  try {
    const session = await svc.endSession(id, doorClosed, chargerDisconnected);
    return NextResponse.json({
      id: session.id,
      endAt: session.end_at,
      durationMins: session.duration_mins,
      cost: session.cost,
      isPaid: session.is_paid,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}


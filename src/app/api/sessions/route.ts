import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { SessionService } from '@/lib/services/session';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { cellId, bookingId } = await req.json();
  const svc = new SessionService(supabase);
  try {
    const session = await svc.startSession(user.id, cellId, bookingId);
    return NextResponse.json(
      { id: session.id, startAt: session.start_at, cellId: session.cell_id },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}


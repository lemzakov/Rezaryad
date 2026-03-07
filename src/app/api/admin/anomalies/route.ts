import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

interface SessionWithRelations {
  id: string;
  user_id: string;
  cell_id: string;
  start_at: string;
  users: { max_id: string } | null;
  cells: { lockers: { name: string } | null } | null;
}

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: longSessions } = await supabase
    .from('sessions')
    .select('id, user_id, cell_id, start_at, users(max_id), cells(id, lockers(name))')
    .is('end_at', null)
    .lt('start_at', threshold) as { data: SessionWithRelations[] | null };

  return NextResponse.json(
    (longSessions ?? []).map((s) => ({
      sessionId: s.id,
      userId: s.user_id,
      userMaxId: s.users?.max_id ?? null,
      cellId: s.cell_id,
      locker: s.cells?.lockers?.name ?? null,
      startAt: s.start_at,
      durationHours:
        Math.round(((Date.now() - new Date(s.start_at).getTime()) / 3600000) * 100) / 100,
    })),
  );
}



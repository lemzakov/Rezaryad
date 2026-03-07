import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, cells(id, number, locker_id, lockers(id, name))')
    .eq('user_id', id)
    .order('start_at', { ascending: false });

  // Get courier phone for display
  const { data: user } = await supabase
    .from('users')
    .select('phone, max_id')
    .eq('id', id)
    .maybeSingle();
  const courierPhone = user?.phone ?? user?.max_id ?? '—';

  type SessionRow = {
    id: string;
    user_id: string;
    cell_id: string;
    start_at: string;
    end_at: string | null;
    duration_mins: number | null;
    cost: number | null;
    cells: {
      id: string;
      number: number;
      locker_id: string;
      lockers: { id: string; name: string } | null;
    } | null;
  };

  return NextResponse.json(
    (sessions ?? [] as SessionRow[]).map((s: SessionRow) => ({
      id: s.id,
      courier_id: s.user_id,
      courier_phone: courierPhone,
      locker_id: s.cells?.locker_id ?? null,
      locker_name: s.cells?.lockers?.name ?? '—',
      cell_id: s.cell_id,
      cell_number: s.cells?.number ?? null,
      started_at: s.start_at,
      ended_at: s.end_at ?? null,
      duration_minutes: s.duration_mins != null ? Math.round(Number(s.duration_mins)) : null,
      cost: s.cost != null ? Math.round(Number(s.cost) * 100) / 100 : null,
      status: !s.end_at ? 'ACTIVE' : 'COMPLETED',
    })),
  );
}

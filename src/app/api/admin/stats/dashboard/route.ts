import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  // Revenue today
  const { data: todayPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'SUCCESS')
    .gte('created_at', todayStartIso);
  const revenue_today = (todayPayments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  // Sessions today
  const { count: sessions_today } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .gte('start_at', todayStartIso);

  // Active couriers (users with at least one session in last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('start_at', weekAgo);
  const active_couriers = new Set((activeSessions ?? []).map((s) => s.user_id)).size;

  // Recent anomalies (long sessions > 2h)
  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: longSessions } = await supabase
    .from('sessions')
    .select('id, user_id, cell_id, start_at, users(phone, max_id), cells(number, locker_id, lockers(name))')
    .is('end_at', null)
    .lt('start_at', threshold)
    .limit(10);

  type SessionRow = {
    id: string;
    user_id: string;
    start_at: string;
    users: { phone: string | null; max_id: string } | null;
    cells: { number: number; locker_id: string; lockers: { name: string } | null } | null;
  };

  const recent_anomalies = ((longSessions ?? []) as unknown as SessionRow[]).map((s, idx) => ({
    id: idx,
    type: 'LONG_SESSION' as const,
    session_id: s.id,
    courier_id: s.user_id,
    courier_phone: s.users?.phone ?? s.users?.max_id ?? '—',
    locker_name: s.cells?.lockers?.name ?? '—',
    cell_number: s.cells?.number ?? null,
    started_at: s.start_at,
    duration_minutes: Math.round((Date.now() - new Date(s.start_at).getTime()) / 60000),
  }));

  return NextResponse.json({
    revenue_today: Math.round(revenue_today * 100) / 100,
    active_couriers,
    sessions_today: sessions_today ?? 0,
    recent_anomalies,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

interface SessionRow {
  id: string;
  user_id: string;
  cell_id: string;
  start_at: string;
  users: { phone: string | null; max_id: string } | null;
  cells: { number: number; locker_id: string; lockers: { name: string } | null } | null;
}

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Long sessions (active for > 2 hours)
  const { data: longRaw } = await supabase
    .from('sessions')
    .select('id, user_id, cell_id, start_at, users(phone, max_id), cells(number, locker_id, lockers(name))')
    .is('end_at', null)
    .lt('start_at', threshold) as { data: SessionRow[] | null };

  const long_sessions = (longRaw ?? []).map((s, idx) => ({
    id: idx,
    type: 'LONG_SESSION',
    session_id: s.id,
    courier_id: s.user_id,
    courier_phone: s.users?.phone ?? s.users?.max_id ?? '—',
    locker_name: s.cells?.lockers?.name ?? '—',
    cell_number: s.cells?.number ?? null,
    started_at: s.start_at,
    duration_minutes: Math.round((Date.now() - new Date(s.start_at).getTime()) / 60000),
  }));

  // Open doors: cells with BUSY status but no active session
  const { data: busyCells } = await supabase
    .from('cells')
    .select('id, number, locker_id, lockers(name), updated_at')
    .eq('status', 'BUSY');

  const openDoors = [];
  let odIdx = 0;
  for (const cell of busyCells ?? []) {
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('cell_id', cell.id)
      .is('end_at', null);
    if ((count ?? 0) === 0) {
      openDoors.push({
        id: odIdx++,
        type: 'OPEN_DOOR',
        locker_id: cell.locker_id,
        locker_name: (cell as unknown as { lockers: { name: string } | null }).lockers?.name ?? '—',
        cell_id: cell.id,
        cell_number: cell.number,
        since: (cell as unknown as { updated_at: string }).updated_at ?? null,
      });
    }
  }

  // Debtors
  const { data: debtors } = await supabase
    .from('users')
    .select('id, phone, max_id, debt_amount')
    .eq('has_debt', true)
    .gt('debt_amount', 0);

  const debtorList = (debtors ?? []).map((u, idx) => ({
    id: idx,
    type: 'DEBT',
    courier_id: u.id,
    courier_phone: u.phone ?? u.max_id ?? '—',
    debt_amount: Math.round(Number(u.debt_amount) * 100) / 100,
  }));

  return NextResponse.json({
    long_sessions,
    open_doors: openDoors,
    debtors: debtorList,
  });
}




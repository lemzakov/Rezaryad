import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const courierId = searchParams.get('courier_id') || searchParams.get('user_id') || undefined;
  const lockerId = searchParams.get('locker_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const skip = (page - 1) * limit;

  let q = supabase
    .from('sessions')
    .select(
      '*, users(id, max_id, phone), cells(id, number, locker_id, lockers(id, name))',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (courierId) q = q.eq('user_id', courierId);
  if (status === 'ACTIVE') q = q.is('end_at', null);
  else if (status === 'COMPLETED') q = q.not('end_at', 'is', null);
  if (dateFrom) q = q.gte('start_at', dateFrom);
  if (dateTo) q = q.lte('start_at', dateTo + 'T23:59:59Z');

  const { data: sessions, count: total } = await q;

  // Filter by locker after fetch if needed (cells belong to lockers)
  const allItems = (sessions ?? []).filter((s) => {
    if (lockerId && s.cells?.locker_id !== lockerId) return false;
    return true;
  });

  return NextResponse.json(
    allItems.map((s) => {
      const isActive = !s.end_at;
      const sessionStatus = isActive ? 'ACTIVE' : 'COMPLETED';
      return {
        id: s.id,
        courier_id: s.user_id,
        courier_phone: s.users?.phone ?? s.users?.max_id ?? '—',
        locker_id: s.cells?.locker_id ?? null,
        locker_name: s.cells?.lockers?.name ?? '—',
        cell_id: s.cell_id,
        cell_number: s.cells?.number ?? null,
        started_at: s.start_at,
        ended_at: s.end_at ?? null,
        duration_minutes: s.duration_mins != null ? Math.round(Number(s.duration_mins)) : null,
        cost: s.cost != null ? Math.round(Number(s.cost) * 100) / 100 : null,
        status: sessionStatus,
      };
    }),
    { headers: { 'X-Total-Count': String(total ?? 0) } },
  );
}


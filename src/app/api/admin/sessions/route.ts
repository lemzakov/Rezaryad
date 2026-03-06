import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const userId = searchParams.get('user_id') || undefined;
  const activeOnly = searchParams.get('active_only') === 'true';
  const skip = (page - 1) * limit;

  let q = supabase
    .from('sessions')
    .select('*, users(max_id), cells(id, locker_id, lockers(name))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (userId) q = q.eq('user_id', userId);
  if (activeOnly) q = q.is('end_at', null);

  const { data: sessions, count: total } = await q;

  return NextResponse.json({
    items: (sessions ?? []).map((s) => ({
      id: s.id,
      userId: s.user_id,
      userMaxId: s.users?.max_id ?? null,
      locker: s.cells?.lockers?.name ?? null,
      startAt: s.start_at,
      endAt: s.end_at,
      durationMins: s.duration_mins,
      cost: s.cost,
      isPaid: s.is_paid,
    })),
    total: total ?? 0,
  });
}


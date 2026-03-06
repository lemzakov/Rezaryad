import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const skip = (page - 1) * limit;

  const { data: sessions, count: total } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  return NextResponse.json({
    items: (sessions ?? []).map((s) => ({
      id: s.id,
      startAt: s.start_at,
      endAt: s.end_at,
      durationMins: s.duration_mins,
      cost: s.cost,
      isPaid: s.is_paid,
    })),
    total: total ?? 0,
    page,
    limit,
  });
}


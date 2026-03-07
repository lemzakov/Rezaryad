import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;
  const { data: u } = await supabase
    .from('users')
    .select('id, max_id, phone, is_verified, has_debt, debt_amount, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!u) return NextResponse.json({ detail: 'Courier not found' }, { status: 404 });

  const [
    { count: totalSessions },
    { count: activeSessions },
    { data: lastSession },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .is('end_at', null),
    supabase
      .from('sessions')
      .select('start_at')
      .eq('user_id', id)
      .order('start_at', { ascending: false })
      .limit(1),
    supabase
      .from('payments')
      .select('amount')
      .eq('user_id', id)
      .eq('status', 'SUCCESS'),
  ]);

  const total_spent = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return NextResponse.json({
    id: u.id,
    max_id: u.max_id,
    phone: u.phone ?? '—',
    is_verified: u.is_verified,
    has_debt: u.has_debt,
    debt_amount: Math.round(Number(u.debt_amount) * 100) / 100,
    active_sessions: activeSessions ?? 0,
    total_spent: Math.round(total_spent * 100) / 100,
    session_count: totalSessions ?? 0,
    last_activity: (lastSession ?? [])[0]?.start_at ?? null,
  });
}

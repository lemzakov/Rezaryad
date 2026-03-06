import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const [
    { count: totalSessions },
    { count: activeSessions },
    { count: totalUsers },
    { count: verifiedUsers },
    { count: debtUsers },
  ] = await Promise.all([
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).is('end_at', null),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('has_debt', true),
  ]);

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'SUCCESS');
  const totalRevenue = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const { data: debtorsList } = await supabase
    .from('users')
    .select('debt_amount')
    .eq('has_debt', true);
  const totalDebt = (debtorsList ?? []).reduce((sum, u) => sum + (u.debt_amount ?? 0), 0);

  return NextResponse.json({
    totalSessions: totalSessions ?? 0,
    activeSessions: activeSessions ?? 0,
    totalUsers: totalUsers ?? 0,
    verifiedUsers: verifiedUsers ?? 0,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    debtUsers: debtUsers ?? 0,
    totalDebt: Math.round(totalDebt * 100) / 100,
  });
}


import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const skip = (page - 1) * limit;

  const { data: users, count: total } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  const result = await Promise.all(
    (users ?? []).map(async (u) => {
      const { count: sessionCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id);
      return {
        id: u.id,
        maxId: u.max_id,
        phone: u.phone,
        isVerified: u.is_verified,
        hasDebt: u.has_debt,
        debtAmount: u.debt_amount,
        sessionCount: sessionCount ?? 0,
        createdAt: u.created_at,
      };
    }),
  );

  return NextResponse.json({ items: result, total: total ?? 0 });
}


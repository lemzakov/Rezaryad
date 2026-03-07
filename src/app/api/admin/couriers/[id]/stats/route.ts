import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;

  const [{ data: sessions }, { data: payments }] = await Promise.all([
    supabase
      .from('sessions')
      .select('start_at, end_at, duration_mins')
      .eq('user_id', id)
      .not('end_at', 'is', null),
    supabase
      .from('payments')
      .select('amount')
      .eq('user_id', id)
      .eq('status', 'SUCCESS'),
  ]);

  const sessionList = sessions ?? [];
  const total_spent = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const totalDuration = sessionList.reduce((sum, s) => sum + Number(s.duration_mins ?? 0), 0);
  const avg_duration = sessionList.length > 0 ? totalDuration / sessionList.length : 0;

  const sorted = [...sessionList].sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
  );

  return NextResponse.json({
    total_spent: Math.round(total_spent * 100) / 100,
    session_count: sessionList.length,
    avg_duration_minutes: Math.round(avg_duration * 100) / 100,
    last_activity: sorted[0]?.start_at ?? null,
  });
}

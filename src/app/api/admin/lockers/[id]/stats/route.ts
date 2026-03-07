import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;

  // Get all cells for this locker
  const { data: cells } = await supabase
    .from('cells')
    .select('id, status')
    .eq('locker_id', id);
  const cellIds = (cells ?? []).map((c) => c.id);

  // Total and free cells
  const totalCells = cellIds.length;
  const freeCells = (cells ?? []).filter((c) => c.status === 'FREE').length;
  const occupancyPercent = totalCells > 0
    ? Math.round(((totalCells - freeCells) / totalCells) * 100)
    : 0;

  if (cellIds.length === 0) {
    return NextResponse.json({
      revenue: 0,
      session_count: 0,
      avg_duration_minutes: 0,
      occupancy_percent: occupancyPercent,
      daily_revenue: [],
    });
  }

  // Sessions for this locker
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, start_at, end_at, duration_mins, cost')
    .in('cell_id', cellIds)
    .not('end_at', 'is', null);

  const sessionList = sessions ?? [];
  const revenue = sessionList.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const totalDuration = sessionList.reduce((sum, s) => sum + (s.duration_mins ?? 0), 0);
  const avgDuration = sessionList.length > 0 ? totalDuration / sessionList.length : 0;

  // Build daily revenue for last 30 days
  const dailyMap: Record<string, { revenue: number; sessions: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = { revenue: 0, sessions: 0 };
  }
  for (const s of sessionList) {
    const day = s.start_at.slice(0, 10);
    if (dailyMap[day]) {
      dailyMap[day].revenue += s.cost ?? 0;
      dailyMap[day].sessions += 1;
    }
  }
  const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    sessions: v.sessions,
  }));

  return NextResponse.json({
    revenue: Math.round(revenue * 100) / 100,
    session_count: sessionList.length,
    avg_duration_minutes: Math.round(avgDuration * 100) / 100,
    occupancy_percent: occupancyPercent,
    daily_revenue: dailyRevenue,
  });
}

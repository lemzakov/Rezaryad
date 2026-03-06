import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { data: lockers } = await supabase.from('lockers').select('*, cells(*)');

  const result = await Promise.all(
    (lockers ?? []).map(async (locker) => {
      const cellIds: string[] = (locker.cells ?? []).map((c: { id: string }) => c.id);

      let totalSessions = 0;
      let activeSessions = 0;
      if (cellIds.length > 0) {
        const [{ count: ts }, { count: activeCount }] = await Promise.all([
          supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .in('cell_id', cellIds),
          supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .in('cell_id', cellIds)
            .is('end_at', null),
        ]);
        totalSessions = ts ?? 0;
        activeSessions = activeCount ?? 0;
      }

      const cells: { status: string }[] = locker.cells ?? [];
      const freeCells = cells.filter((c) => c.status === 'FREE').length;

      return {
        id: locker.id,
        name: locker.name,
        address: locker.address,
        totalCells: cells.length,
        freeCells,
        totalSessions,
        activeSessions,
      };
    }),
  );

  return NextResponse.json(result);
}


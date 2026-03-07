import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const { data: lockers } = await supabase
    .from('lockers')
    .select('*, cells(*)')
    .eq('is_active', true);

  return NextResponse.json(
    (lockers ?? []).map((l) => {
      const cells: { status: string }[] = l.cells ?? [];
      return {
        id: l.id,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lon: l.lon,
        freeCells: cells.filter((c) => c.status === 'FREE').length,
        totalCells: cells.length,
      };
    }),
  );
}


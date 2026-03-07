import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { data: lockers } = await supabase.from('lockers').select('*, cells(*)');
  return NextResponse.json(
    (lockers ?? []).map((l) => {
      const cells: { status: string }[] = l.cells ?? [];
      const freeCells = cells.filter((c) => c.status === 'FREE').length;
      const activeCells = cells.filter((c) => c.status === 'BUSY').length;
      return {
        id: l.id,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lon: l.lon,
        qr_code: l.qr_code,
        is_active: l.is_active,
        total_cells: cells.length,
        free_cells: freeCells,
        active_cells: activeCells,
      };
    }),
  );
}

export async function POST(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { name, address, lat, lon, qrCode } = body;
  if (!name || !address || lat == null || lon == null || !qrCode) {
    return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
  }

  const { data: locker, error: insertError } = await supabase
    .from('lockers')
    .insert({ name, address, lat, lon, qr_code: qrCode, is_active: true })
    .select()
    .single();
  if (insertError) return NextResponse.json({ detail: insertError.message }, { status: 500 });

  return NextResponse.json(
    { id: locker.id, name: locker.name, qrCode: locker.qr_code },
    { status: 201 },
  );
}


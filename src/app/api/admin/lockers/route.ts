import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { data: lockers } = await supabase.from('lockers').select('*, cells(*)');
  return NextResponse.json(
    (lockers ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lon: l.lon,
      qrCode: l.qr_code,
      isActive: l.is_active,
      cellCount: (l.cells ?? []).length,
    })),
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


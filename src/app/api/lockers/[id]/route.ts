import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: locker } = await supabase
    .from('lockers')
    .select('*, cells(*)')
    .eq('id', id)
    .maybeSingle();

  if (!locker) return NextResponse.json({ detail: 'Locker not found' }, { status: 404 });

  const cells: { id: string; number: number; status: string; has_charger: boolean }[] =
    locker.cells ?? [];
  return NextResponse.json({
    id: locker.id,
    name: locker.name,
    address: locker.address,
    lat: locker.lat,
    lon: locker.lon,
    qrCode: locker.qr_code,
    isActive: locker.is_active,
    cells: cells.map((c) => ({
      id: c.id,
      number: c.number,
      status: c.status,
      hasCharger: c.has_charger,
    })),
    freeCells: cells.filter((c) => c.status === 'FREE').length,
  });
}


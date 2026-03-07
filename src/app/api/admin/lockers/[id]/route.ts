import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;
  const { data: locker } = await supabase
    .from('lockers')
    .select('*, cells(*)')
    .eq('id', id)
    .maybeSingle();
  if (!locker) return NextResponse.json({ detail: 'Locker not found' }, { status: 404 });

  const cells: { status: string }[] = locker.cells ?? [];
  const freeCells = cells.filter((c) => c.status === 'FREE').length;
  const activeCells = cells.filter((c) => c.status === 'BUSY').length;

  return NextResponse.json({
    id: locker.id,
    name: locker.name,
    address: locker.address,
    lat: locker.lat,
    lon: locker.lon,
    qr_code: locker.qr_code,
    is_active: locker.is_active,
    total_cells: cells.length,
    free_cells: freeCells,
    active_cells: activeCells,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;
  const { data: existing } = await supabase
    .from('lockers')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ detail: 'Locker not found' }, { status: 404 });

  const body = await req.json();
  const updates: { name?: string; address?: string; is_active?: boolean } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.address !== undefined) updates.address = body.address;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  const { data: updated, error: updateError } = await supabase
    .from('lockers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ detail: updateError.message }, { status: 500 });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    isActive: updated.is_active,
  });
}

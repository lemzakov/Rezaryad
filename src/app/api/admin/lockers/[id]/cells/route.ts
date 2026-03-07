import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;
  const { data: cells } = await supabase
    .from('cells')
    .select('*')
    .eq('locker_id', id)
    .order('number');

  return NextResponse.json(
    (cells ?? []).map((c) => ({
      id: c.id,
      locker_id: c.locker_id,
      number: c.number,
      status: c.status,
    })),
  );
}

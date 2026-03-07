import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;

  const { data: user } = await supabase
    .from('users')
    .select('id, max_id, name, registration_status')
    .eq('id', id)
    .maybeSingle();

  if (!user) return NextResponse.json({ detail: 'Courier not found' }, { status: 404 });

  if (user.registration_status === 'ACTIVE') {
    return NextResponse.json({ detail: 'Courier is already active' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      registration_status: 'ACTIVE',
      is_verified: true,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ detail: 'Failed to approve courier' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Courier approved and activated' });
}

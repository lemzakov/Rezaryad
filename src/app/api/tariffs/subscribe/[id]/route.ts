import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();
  if (!sub || sub.user_id !== user.id) {
    return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
  }
  await supabase
    .from('subscriptions')
    .update({ is_active: false, auto_renew: false })
    .eq('id', id);
  return NextResponse.json({ cancelled: true });
}


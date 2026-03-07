import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const { data: card } = await supabase
    .from('payment_cards')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();
  if (!card || card.user_id !== user.id) {
    return NextResponse.json({ detail: 'Card not found' }, { status: 404 });
  }
  await supabase.from('payment_cards').update({ is_active: false }).eq('id', id);
  return NextResponse.json({ deleted: true });
}


import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { cardToken, lastFour } = await req.json();
  const { data: card, error: insertError } = await supabase
    .from('payment_cards')
    .insert({ user_id: user.id, card_token: cardToken, last_four: lastFour, is_active: true })
    .select()
    .single();
  if (insertError) return NextResponse.json({ detail: insertError.message }, { status: 500 });
  return NextResponse.json({ id: card.id, lastFour: card.last_four }, { status: 201 });
}


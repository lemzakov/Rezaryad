import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { tariffId, autoRenew = false } = await req.json();
  const { data: tariff } = await supabase
    .from('tariffs')
    .select('*')
    .eq('id', tariffId)
    .maybeSingle();
  if (!tariff || !tariff.is_subscription) {
    return NextResponse.json({ detail: 'Tariff not available for subscription' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (existing) return NextResponse.json({ detail: 'Already have an active subscription' }, { status: 400 });

  const days = tariff.subscription_period || 30;
  const now = new Date();
  const endAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const { data: sub, error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      tariff_id: tariffId,
      start_at: now.toISOString(),
      end_at: endAt.toISOString(),
      is_active: true,
      auto_renew: autoRenew,
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ detail: 'Failed to create subscription' }, { status: 500 });

  return NextResponse.json(
    {
      id: sub.id,
      tariffId: sub.tariff_id,
      endAt: sub.end_at,
      autoRenew: sub.auto_renew,
    },
    { status: 201 },
  );
}


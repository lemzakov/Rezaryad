import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const { data: tariffs } = await supabase.from('tariffs').select('*');
  return NextResponse.json(
    (tariffs ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      pricePerMinute: t.price_per_minute,
      isSubscription: t.is_subscription,
      subscriptionPeriod: t.subscription_period,
      freeMins: t.free_mins,
      discountPct: t.discount_pct,
      isNight: t.is_night,
    })),
  );
}


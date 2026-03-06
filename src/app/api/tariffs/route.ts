import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const tariffs = await prisma.tariff.findMany();
  return NextResponse.json(
    tariffs.map((t) => ({
      id: t.id,
      name: t.name,
      pricePerMinute: t.pricePerMinute,
      isSubscription: t.isSubscription,
      subscriptionPeriod: t.subscriptionPeriod,
      freeMins: t.freeMins,
      discountPct: t.discountPct,
      isNight: t.isNight,
    })),
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { tariffId, autoRenew = false } = await req.json();
  const tariff = await prisma.tariff.findUnique({ where: { id: tariffId } });
  if (!tariff || !tariff.isSubscription) {
    return NextResponse.json({ detail: 'Tariff not available for subscription' }, { status: 400 });
  }

  const existing = await prisma.subscription.findFirst({ where: { userId: user!.id, isActive: true } });
  if (existing) return NextResponse.json({ detail: 'Already have an active subscription' }, { status: 400 });

  const days = tariff.subscriptionPeriod || 30;
  const now = new Date();
  const endAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sub = await prisma.subscription.create({
    data: { userId: user!.id, tariffId, startAt: now, endAt, isActive: true, autoRenew },
  });
  return NextResponse.json({ id: sub.id, tariffId: sub.tariffId, endAt: sub.endAt, autoRenew: sub.autoRenew }, { status: 201 });
}

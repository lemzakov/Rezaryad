import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { cardToken, lastFour } = await req.json();
  const card = await prisma.paymentCard.create({
    data: { userId: user!.id, cardToken, lastFour, isActive: true },
  });
  return NextResponse.json({ id: card.id, lastFour: card.lastFour }, { status: 201 });
}

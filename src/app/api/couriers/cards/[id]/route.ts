import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const card = await prisma.paymentCard.findUnique({ where: { id } });
  if (!card || card.userId !== user!.id) {
    return NextResponse.json({ detail: 'Card not found' }, { status: 404 });
  }
  await prisma.paymentCard.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ deleted: true });
}

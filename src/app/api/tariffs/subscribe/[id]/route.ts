import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub || sub.userId !== user!.id) {
    return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
  }
  await prisma.subscription.update({ where: { id }, data: { isActive: false, autoRenew: false } });
  return NextResponse.json({ cancelled: true });
}

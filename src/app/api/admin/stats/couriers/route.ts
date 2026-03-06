import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const skip = (page - 1) * limit;

  const users = await prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } });
  const result = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      maxId: u.maxId,
      phone: u.phone,
      isVerified: u.isVerified,
      hasDebt: u.hasDebt,
      debtAmount: u.debtAmount,
      sessionCount: await prisma.session.count({ where: { userId: u.id } }),
      createdAt: u.createdAt,
    })),
  );
  return NextResponse.json({ items: result, total: await prisma.user.count() });
}

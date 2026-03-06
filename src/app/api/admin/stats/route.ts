import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const totalSessions = await prisma.session.count();
  const activeSessions = await prisma.session.count({ where: { endAt: null } });
  const totalUsers = await prisma.user.count();
  const verifiedUsers = await prisma.user.count({ where: { isVerified: true } });

  const payments = await prisma.payment.findMany({ where: { status: 'SUCCESS' } });
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  const debtUsers = await prisma.user.count({ where: { hasDebt: true } });
  const debtorsList = await prisma.user.findMany({ where: { hasDebt: true } });
  const totalDebt = debtorsList.reduce((sum, u) => sum + u.debtAmount, 0);

  return NextResponse.json({
    totalSessions,
    activeSessions,
    totalUsers,
    verifiedUsers,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    debtUsers,
    totalDebt: Math.round(totalDebt * 100) / 100,
  });
}

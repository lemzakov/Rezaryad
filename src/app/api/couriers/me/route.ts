import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  return NextResponse.json({
    id: user!.id,
    maxId: user!.maxId,
    phone: user!.phone,
    language: user!.language,
    isVerified: user!.isVerified,
    hasDebt: user!.hasDebt,
    debtAmount: user!.debtAmount,
    createdAt: user!.createdAt,
  });
}

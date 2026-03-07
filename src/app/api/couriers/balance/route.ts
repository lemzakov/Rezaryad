import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  return NextResponse.json({ hasDebt: user.has_debt, debtAmount: user.debt_amount });
}


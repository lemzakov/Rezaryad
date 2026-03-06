import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearer } from './jwt';
import { supabase } from './db';
import type { DbUser, DbAdminUser } from './types';

export async function getAuthenticatedUser(
  req: NextRequest,
): Promise<{ user: DbUser; error: null } | { user: null; error: NextResponse }> {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return { user: null, error: NextResponse.json({ detail: 'Not authenticated' }, { status: 401 }) };
  }
  try {
    const payload = await verifyToken(token);
    const userId = payload.sub as string;
    if (!userId) {
      return { user: null, error: NextResponse.json({ detail: 'Invalid token' }, { status: 401 }) };
    }
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle<DbUser>();
    if (!user) {
      return { user: null, error: NextResponse.json({ detail: 'User not found' }, { status: 401 }) };
    }
    return { user, error: null };
  } catch {
    return { user: null, error: NextResponse.json({ detail: 'Invalid token' }, { status: 401 }) };
  }
}

export async function getAuthenticatedAdmin(
  req: NextRequest,
): Promise<{ admin: DbAdminUser; error: null } | { admin: null; error: NextResponse }> {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return { admin: null, error: NextResponse.json({ detail: 'Not authenticated' }, { status: 401 }) };
  }
  try {
    const payload = await verifyToken(token);
    const adminId = payload.sub as string;
    const role = payload.role as string;
    if (!adminId || role !== 'admin') {
      return { admin: null, error: NextResponse.json({ detail: 'Admin access required' }, { status: 403 }) };
    }
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', adminId)
      .maybeSingle<DbAdminUser>();
    if (!admin) {
      return { admin: null, error: NextResponse.json({ detail: 'Admin not found' }, { status: 401 }) };
    }
    return { admin, error: null };
  } catch {
    return { admin: null, error: NextResponse.json({ detail: 'Invalid token' }, { status: 401 }) };
  }
}

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('CRON_SECRET is not set: cron endpoints are unprotected');
    }
    return null;
  }
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  return null;
}


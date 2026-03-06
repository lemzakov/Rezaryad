import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearer } from './jwt';
import { prisma } from './db';

export async function getAuthenticatedUser(req: NextRequest) {
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { user: null, error: NextResponse.json({ detail: 'User not found' }, { status: 401 }) };
    }
    return { user, error: null };
  } catch {
    return { user: null, error: NextResponse.json({ detail: 'Invalid token' }, { status: 401 }) };
  }
}

export async function getAuthenticatedAdmin(req: NextRequest) {
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
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
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
  if (!cronSecret) return null;
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

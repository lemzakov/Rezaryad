import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createAdminToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();
    if (!login || !password) {
      return NextResponse.json({ detail: 'Missing credentials' }, { status: 400 });
    }
    const admin = await prisma.adminUser.findUnique({ where: { login } });
    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }
    const token = await createAdminToken(admin.id);
    return NextResponse.json({ access_token: token, token_type: 'bearer' });
  } catch {
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db';
import { createAdminToken } from '@/lib/jwt';
import type { DbAdminUser } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();
    if (!login || !password) {
      return NextResponse.json({ detail: 'Missing credentials' }, { status: 400 });
    }
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('login', login)
      .maybeSingle<DbAdminUser>();
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }
    const token = await createAdminToken(admin.id);
    return NextResponse.json({ access_token: token, token_type: 'bearer' });
  } catch {
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}


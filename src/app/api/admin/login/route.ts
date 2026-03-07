import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db';
import { createAdminToken } from '@/lib/jwt';
import type { DbAdminUser } from '@/lib/types';

const isDev = process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();
    if (!login || !password) {
      return NextResponse.json({ detail: 'Missing credentials' }, { status: 400 });
    }

    const { data: admin, error: dbError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('login', login)
      .maybeSingle<DbAdminUser>();

    if (dbError) {
      console.error('[admin/login] Supabase error:', dbError.message, dbError.code);
      // In dev, surface the real DB error so it shows up in the debug panel.
      if (isDev) {
        return NextResponse.json(
          { detail: `Database error: ${dbError.message} (code: ${dbError.code})` },
          { status: 503 },
        );
      }
      return NextResponse.json({ detail: 'Service unavailable' }, { status: 503 });
    }

    if (!admin) {
      console.warn(`[admin/login] No admin user found for login="${login}"`);
      if (isDev) {
        return NextResponse.json(
          { detail: `User "${login}" not found in admin_users table. Run npm run create-admin to seed.` },
          { status: 401 },
        );
      }
      return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      console.warn(`[admin/login] Wrong password for login="${login}"`);
      return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createAdminToken(admin.id);
    return NextResponse.json({ access_token: token, token_type: 'bearer' });
  } catch (err) {
    console.error('[admin/login] Unexpected error:', err);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}


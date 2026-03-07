import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const supabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.rezaryad_SUPABASE_URL,
  );
  const supabaseKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.rezaryad_SUPABASE_SERVICE_ROLE_KEY,
  );
  const secret = Boolean(process.env.SECRET_KEY || process.env.rezaryad_SUPABASE_JWT_SECRET);
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
    SECRET_KEY: secret,
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    MAX_BOT_TOKEN: Boolean(process.env.MAX_BOT_TOKEN),
  };
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

  // Try to count admin users so the debug panel can report whether the DB is seeded.
  let adminCount: number | string = 'unavailable';
  let dbStatus = 'unknown';
  try {
    const { count, error } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true });
    if (error) {
      dbStatus = `error: ${error.message}`;
    } else {
      adminCount = count ?? 0;
      dbStatus = 'ok';
    }
  } catch (err) {
    dbStatus = `exception: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    status: missing.length === 0 && dbStatus === 'ok' ? 'ok' : 'misconfigured',
    env_vars: checks,
    missing,
    db: {
      status: dbStatus,
      admin_count: adminCount,
      seeded: typeof adminCount === 'number' && adminCount > 0,
    },
  });
}


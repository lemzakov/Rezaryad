import { NextResponse } from 'next/server';

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
  return NextResponse.json({
    status: missing.length === 0 ? 'ok' : 'misconfigured',
    env_vars: checks,
    missing,
  });
}


import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = Boolean(
    process.env.DATABASE_URL ||
    process.env.rezaryad_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.rezaryad_POSTGRES_URL,
  );
  const secret = Boolean(process.env.SECRET_KEY || process.env.rezaryad_SUPABASE_JWT_SECRET);
  const checks = {
    DATABASE_URL: dbUrl,
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

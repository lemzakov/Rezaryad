#!/usr/bin/env node
/**
 * Create or update the admin user in the database.
 *
 * Usage:
 *   ADMIN_LOGIN=admin ADMIN_PASSWORD=secret node scripts/create-admin.mjs
 *
 * All connection settings are read from environment variables (same as the app):
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (never expose in the browser)
 *   ADMIN_LOGIN                — desired admin username
 *   ADMIN_PASSWORD             — desired admin password (will be bcrypt-hashed)
 */

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local if present (optional convenience) ──────────────────────
try {
  const { readFileSync } = await import('fs');
  const { resolve } = await import('path');
  const envPath = resolve(process.cwd(), '.env.local');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env.local not present — that's fine
}

// ── Validate inputs ────────────────────────────────────────────────────────
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.rezaryad_SUPABASE_URL || '';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.rezaryad_SUPABASE_SERVICE_ROLE_KEY || '';
const adminLogin = process.env.ADMIN_LOGIN || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

if (!supabaseUrl || !serviceRoleKey) {
  // Soft-fail: during Vercel build the DB may not be available yet (env not injected).
  // We warn and exit cleanly so the build is not blocked.
  console.warn(
    '[create-admin] ⚠ Skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
      '  Set these in Vercel → Settings → Environment Variables to auto-create the admin on deploy.',
  );
  process.exit(0);
}
if (!adminLogin || !adminPassword) {
  // Soft-fail: ADMIN_LOGIN/ADMIN_PASSWORD are optional at build time.
  console.warn(
    '[create-admin] ⚠ Skipped: ADMIN_LOGIN or ADMIN_PASSWORD is not set.\n' +
      '  Set these in Vercel → Settings → Environment Variables to auto-create the admin on deploy.\n' +
      '  Or run manually: ADMIN_LOGIN=admin ADMIN_PASSWORD=secret node scripts/create-admin.mjs',
  );
  process.exit(0);
}
if (adminPassword.length < 8) {
  console.error('✗ ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

// ── Hash password & upsert ─────────────────────────────────────────────────
const supabase = createClient(supabaseUrl, serviceRoleKey);
const passwordHash = bcrypt.hashSync(adminPassword, 10);

/** Returns true when the Supabase error indicates the table does not exist yet. */
function isTableMissingError(err) {
  if (!err) return false;
  // PostgREST error when table is absent from the schema cache
  return (
    (typeof err.message === 'string' && err.message.includes('schema cache')) ||
    err.code === 'PGRST204' ||
    err.code === 'PGRST116'
  );
}

const { data: existing, error: lookupError } = await supabase
  .from('admin_users')
  .select('id, login')
  .eq('login', adminLogin)
  .maybeSingle();

if (lookupError) {
  if (isTableMissingError(lookupError)) {
    console.warn(
      '[create-admin] ⚠ Skipped: admin_users table not found in the database.\n' +
        '  Make sure DATABASE_URL is set so the schema is created automatically, or\n' +
        '  run supabase/schema.sql in the Supabase SQL editor, then redeploy.',
    );
    process.exit(0);
  }
  console.error('✗ Failed to look up admin:', lookupError.message);
  process.exit(1);
}

if (existing) {
  const { error } = await supabase
    .from('admin_users')
    .update({ password_hash: passwordHash })
    .eq('id', existing.id);
  if (error) {
    if (isTableMissingError(error)) {
      console.warn('[create-admin] ⚠ Skipped: admin_users table not found. Run schema.sql first.');
      process.exit(0);
    }
    console.error('✗ Failed to update admin:', error.message);
    process.exit(1);
  }
  console.log(`✓ Updated password for admin user "${adminLogin}" (id: ${existing.id})`);
} else {
  const { data, error } = await supabase
    .from('admin_users')
    .insert({ login: adminLogin, password_hash: passwordHash })
    .select('id')
    .single();
  if (error) {
    if (isTableMissingError(error)) {
      console.warn('[create-admin] ⚠ Skipped: admin_users table not found. Run schema.sql first.');
      process.exit(0);
    }
    console.error('✗ Failed to create admin:', error.message);
    process.exit(1);
  }
  console.log(`✓ Created admin user "${adminLogin}" (id: ${data.id})`);
}

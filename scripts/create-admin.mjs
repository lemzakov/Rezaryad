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
  console.error(
    '✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      '  Copy .env.example to .env.local and fill in your Supabase credentials.',
  );
  process.exit(1);
}
if (!adminLogin || !adminPassword) {
  console.error(
    '✗ ADMIN_LOGIN and ADMIN_PASSWORD must be set.\n' +
      '  Example: ADMIN_LOGIN=admin ADMIN_PASSWORD=secret node scripts/create-admin.mjs',
  );
  process.exit(1);
}
if (adminPassword.length < 8) {
  console.error('✗ ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

// ── Hash password & upsert ─────────────────────────────────────────────────
const supabase = createClient(supabaseUrl, serviceRoleKey);
const passwordHash = bcrypt.hashSync(adminPassword, 10);

const { data: existing } = await supabase
  .from('admin_users')
  .select('id, login')
  .eq('login', adminLogin)
  .maybeSingle();

if (existing) {
  const { error } = await supabase
    .from('admin_users')
    .update({ password_hash: passwordHash })
    .eq('id', existing.id);
  if (error) {
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
    console.error('✗ Failed to create admin:', error.message);
    process.exit(1);
  }
  console.log(`✓ Created admin user "${adminLogin}" (id: ${data.id})`);
}

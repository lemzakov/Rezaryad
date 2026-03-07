#!/usr/bin/env node
/**
 * Initialize the database schema and seed data.
 *
 * Run automatically as part of the build (postbuild).
 * Safe to re-run: all DDL uses CREATE ... IF NOT EXISTS / DO ... END blocks.
 * Seed data uses ON CONFLICT DO NOTHING so duplicate rows are safe.
 *
 * Connection is read from these env vars (first one found wins):
 *   rezaryad_POSTGRES_URL_NON_POOLING  — direct Supabase connection (required for DDL)
 *   rezaryad_POSTGRES_URL              — pooler URL (fallback, DDL may fail with pgbouncer)
 *   DATABASE_URL                       — generic fallback
 *
 * Both are set automatically by Vercel when you connect a Supabase integration.
 *
 * Optional:
 *   SEED_DB=true  — force re-run of supabase/seed.sql even if schema already existed
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local if present ─────────────────────────────────────────────
try {
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

const databaseUrl =
  process.env.rezaryad_POSTGRES_URL_NON_POOLING ||
  process.env.rezaryad_POSTGRES_URL ||
  process.env.DATABASE_URL ||
  '';

if (!databaseUrl) {
  console.warn(
    '[setup-db] ⚠ Skipped: no PostgreSQL connection string found.\n' +
      '  Expected one of: rezaryad_POSTGRES_URL_NON_POOLING, rezaryad_POSTGRES_URL, DATABASE_URL\n' +
      '  These are set automatically when you connect a Supabase integration in Vercel.',
  );
  process.exit(0);
}

// ── Connect ────────────────────────────────────────────────────────────────
const { Client } = require('pg');
const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('[setup-db] Connected to PostgreSQL.');
} catch (err) {
  console.error('[setup-db] ✗ Failed to connect to PostgreSQL:', err.message);
  // Soft-fail: DB might be unreachable during build in some environments.
  process.exit(0);
}

// ── Check if schema already exists ────────────────────────────────────────
let schemaExists = false;
try {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_users'
    ) AS exists`,
  );
  schemaExists = result.rows[0]?.exists === true;
} catch (err) {
  console.error('[setup-db] ✗ Failed to check schema:', err.message);
  await client.end();
  process.exit(0);
}

if (schemaExists) {
  console.log('[setup-db] ✓ Schema already exists, skipping DDL.');
} else {
  // ── Run schema.sql ─────────────────────────────────────────────────────
  const schemaPath = resolve(__dirname, '..', 'supabase', 'schema.sql');
  let schemaSql;
  try {
    schemaSql = readFileSync(schemaPath, 'utf8');
  } catch {
    console.error(`[setup-db] ✗ Could not read ${schemaPath}`);
    await client.end();
    process.exit(0);
  }

  try {
    await client.query(schemaSql);
    console.log('[setup-db] ✓ Schema created successfully.');
  } catch (err) {
    console.error('[setup-db] ✗ Failed to apply schema.sql:', err.message);
    await client.end();
    // Non-zero exit so the operator knows seeding was incomplete.
    process.exit(1);
  }

  // ── Run seed.sql automatically on first init ───────────────────────────
  await runSeed('Seed data inserted.');
}

// ── Force re-seed if SEED_DB=true (even when schema already existed) ───────
if (schemaExists && process.env.SEED_DB === 'true') {
  await runSeed('Seed data re-applied (SEED_DB=true).');
}

await client.end();

/** Read and execute supabase/seed.sql. Errors are non-fatal. */
async function runSeed(successMessage) {
  const seedPath = resolve(__dirname, '..', 'supabase', 'seed.sql');
  let seedSql;
  try {
    seedSql = readFileSync(seedPath, 'utf8');
  } catch {
    console.warn(`[setup-db] ⚠ seed.sql not found at ${seedPath}, skipping.`);
    return;
  }
  try {
    await client.query(seedSql);
    console.log(`[setup-db] ✓ ${successMessage}`);
  } catch (err) {
    // Seed errors (e.g. duplicate key) are non-fatal.
    console.warn('[setup-db] ⚠ Seed partially failed (may already be seeded):', err.message);
  }
}

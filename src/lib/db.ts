import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.rezaryad_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.rezaryad_SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!supabaseUrl && process.env.NODE_ENV === 'production') {
  console.error('[db] NEXT_PUBLIC_SUPABASE_URL is not set');
}
if (!supabaseServiceKey && process.env.NODE_ENV === 'production') {
  console.error('[db] SUPABASE_SERVICE_ROLE_KEY is not set');
}

// Global singleton — avoids creating a new client on every hot-reload in dev.
// Using untyped client; individual queries declare their types via .returns<T>()
// and .single<T>() to keep TypeScript safety without the complex Database schema.
const globalForSupabase = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>> | undefined;
};

function makeClient() {
  // During the Next.js build, env vars may not be present. We use placeholder
  // values so that module initialization succeeds; actual requests will only
  // run at runtime when the real values are available.
  const url = supabaseUrl || 'https://placeholder.supabase.co';
  const key = supabaseServiceKey || 'placeholder-key';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: ReturnType<typeof createClient<any>> =
  globalForSupabase.supabase ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase;
}





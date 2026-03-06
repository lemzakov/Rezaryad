// Supabase connection (resolved from several possible env var names)
export const SUPABASE_URL: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.rezaryad_SUPABASE_URL ||
  '';

export const SUPABASE_SERVICE_ROLE_KEY: string =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.rezaryad_SUPABASE_SERVICE_ROLE_KEY ||
  '';

// Public anon key — used only if you need a public (RLS-gated) client
export const SUPABASE_ANON_KEY: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.rezaryad_SUPABASE_ANON_KEY ||
  '';

export const MAX_BOT_TOKEN: string = process.env.MAX_BOT_TOKEN || '';

export const SECRET_KEY: string =
  process.env.SECRET_KEY ||
  process.env.rezaryad_SUPABASE_JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'changeme-dev-only');

if (process.env.NODE_ENV !== 'production' && !process.env.SECRET_KEY && !process.env.rezaryad_SUPABASE_JWT_SECRET) {
  console.warn('[config] SECRET_KEY is not set — using insecure default. Set SECRET_KEY before deploying to production.');
}

export const ACQUIRING_API_KEY: string = process.env.ACQUIRING_API_KEY || '';
export const ACQUIRING_BASE_URL: string =
  process.env.ACQUIRING_BASE_URL || 'https://api.acquiring.example.com';

export const GOSUSLUGI_CLIENT_ID: string = process.env.GOSUSLUGI_CLIENT_ID || '';
export const GOSUSLUGI_CLIENT_SECRET: string = process.env.GOSUSLUGI_CLIENT_SECRET || '';

export const ADMIN_PASSWORD: string = process.env.ADMIN_PASSWORD || '';

export const ALGORITHM = 'HS256';
export const ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7; // 7 days

export const MAX_API_BASE = 'https://botapi.max.ru';

export const BOOKING_FREE_MINS = 5;
export const BOOKING_FREE_MINS_SUBSCRIBED = 10;
export const PENALTY_HOURS = 2;
export const DOOR_OPEN_FRAUD_SECONDS = 30;
export const MAX_ACTIVE_SESSIONS = 2;
export const MAX_ACTIVE_BOOKINGS = 1;

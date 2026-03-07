import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';
import { MAX_BOT_TOKEN, MAX_API_BASE } from '@/lib/config';

// GET /api/admin/max/subscribers — list all MAX subscribers with recent messages
export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  // Get all users with MAX IDs
  const { data: users } = await supabase
    .from('users')
    .select('id, max_id, name, phone, language, is_verified, registration_status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  // Get recent messages for these users
  const { data: messages } = await supabase
    .from('max_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  // Get active webhook subscriptions from MAX API
  let subscriptions: unknown = null;
  if (MAX_BOT_TOKEN) {
    try {
      const resp = await fetch(
        `${MAX_API_BASE}/subscriptions?access_token=${MAX_BOT_TOKEN}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (resp.ok) {
        subscriptions = await resp.json();
      }
    } catch {
      // ignore — subscriptions will be null
    }
  }

  return NextResponse.json({
    subscribers: users ?? [],
    messages: messages ?? [],
    subscriptions,
  });
}

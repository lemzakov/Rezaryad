import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';
import { MAX_BOT_TOKEN, MAX_API_BASE } from '@/lib/config';

// POST /api/admin/max/send — send a test message to a subscriber
export async function POST(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  if (!MAX_BOT_TOKEN) {
    return NextResponse.json({ detail: 'MAX_BOT_TOKEN not configured' }, { status: 503 });
  }

  const { maxId, text } = await req.json();

  if (!maxId || typeof maxId !== 'string') {
    return NextResponse.json({ detail: 'maxId is required' }, { status: 400 });
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ detail: 'text is required' }, { status: 400 });
  }

  // Find user by MAX ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('max_id', maxId)
    .maybeSingle();

  const trimmedText = text.trim().slice(0, 1000);

  // Send message via MAX API
  try {
    const payload = {
      recipient: { chat_id: maxId },
      body: { type: 'text', text: trimmedText },
    };
    const resp = await fetch(
      `${MAX_API_BASE}/messages?access_token=${MAX_BOT_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      },
    );
    const maxResp = await resp.json().catch(() => null);

    if (!resp.ok) {
      return NextResponse.json(
        { detail: 'MAX API error', maxResponse: maxResp },
        { status: 502 },
      );
    }

    // Log the outbound message
    await supabase.from('max_messages').insert({
      user_id: user?.id ?? null,
      max_id: maxId,
      direction: 'OUT',
      text: trimmedText,
    });

    return NextResponse.json({ success: true, maxResponse: maxResp });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

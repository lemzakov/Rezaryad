import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/server-auth';
import { MAX_BOT_TOKEN, MAX_API_BASE } from '@/lib/config';

export async function POST(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  if (!MAX_BOT_TOKEN) {
    return NextResponse.json(
      { detail: 'MAX_BOT_TOKEN is not configured on the server.' },
      { status: 400 },
    );
  }

  const body = await req.json();
  const { webhookUrl } = body;

  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return NextResponse.json({ detail: 'webhookUrl is required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${MAX_API_BASE}/subscriptions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: MAX_BOT_TOKEN },
        body: JSON.stringify({
          url: webhookUrl,
          update_types: ['message_created', 'message_callback', 'bot_started'],
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { detail: `Max API returned ${res.status}`, maxResponse: data },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, maxResponse: data });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Request failed' },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  if (!MAX_BOT_TOKEN) {
    return NextResponse.json(
      { detail: 'MAX_BOT_TOKEN is not configured on the server.' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${MAX_API_BASE}/subscriptions`,
      {
        method: 'GET',
        headers: { Authorization: MAX_BOT_TOKEN },
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { detail: `Max API returned ${res.status}`, maxResponse: data },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, subscriptions: data });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Request failed' },
      { status: 502 },
    );
  }
}

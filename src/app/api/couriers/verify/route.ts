import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { GOSUSLUGI_CLIENT_ID, GOSUSLUGI_CLIENT_SECRET } from '@/lib/config';

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { code } = await req.json();
  try {
    const resp = await fetch('https://esia.gosuslugi.ru/access-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOSUSLUGI_CLIENT_ID,
        client_secret: GOSUSLUGI_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json();
      await supabase
        .from('users')
        .update({ is_verified: true, verification_data: data })
        .eq('id', user.id);
      return NextResponse.json({ verified: true });
    }
    return NextResponse.json({ detail: 'Verification failed' }, { status: 400 });
  } catch {
    return NextResponse.json({ detail: 'Verification service unavailable' }, { status: 503 });
  }
}


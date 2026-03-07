import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabase } from '@/lib/db';
import { createAccessToken } from '@/lib/jwt';
import { MAX_BOT_TOKEN } from '@/lib/config';

function verifyMaxInitData(initData: string, botToken: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Missing hash');
  params.delete('hash');

  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== receivedHash) throw new Error('Invalid signature');
  return Object.fromEntries(sortedEntries);
}

export async function POST(req: NextRequest) {
  if (!MAX_BOT_TOKEN) return NextResponse.json({ detail: 'Bot token not configured' }, { status: 503 });

  try {
    const { initData } = await req.json();
    const params = verifyMaxInitData(initData, MAX_BOT_TOKEN);

    const userParam = params.user;
    if (!userParam) return NextResponse.json({ detail: 'No user data in initData' }, { status: 400 });

    const userData = JSON.parse(userParam);
    const maxId = String(userData.id || '');
    if (!maxId) return NextResponse.json({ detail: 'Missing user id' }, { status: 400 });

    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('max_id', maxId)
      .maybeSingle();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ max_id: maxId, language: 'RU' })
        .select('id')
        .single();
      user = newUser;
    }

    if (!user) return NextResponse.json({ detail: 'Failed to create user' }, { status: 500 });

    const token = await createAccessToken({ sub: user.id });
    return NextResponse.json({ access_token: token, token_type: 'bearer' });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 401 });
  }
}


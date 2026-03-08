import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';
import { MAX_BOT_TOKEN, MAX_API_BASE } from '@/lib/config';

const APPROVAL_MSGS: Record<string, string> = {
  RU: '🎉 Ваш аккаунт курьера одобрен! Добро пожаловать в команду Rezaryad.\n\nТеперь вы можете арендовать ячейки и пользоваться всеми функциями приложения.',
  UZ: "🎉 Kuryer hisobingiz tasdiqlandi! Rezaryad jamoasiga xush kelibsiz.\n\nEndi kataklar ijaralashingiz va ilovaning barcha funksiyalaridan foydalanishingiz mumkin.",
  TJ: '🎉 Ҳисоби курьери шумо тасдиқ шуд! Хуш омадед ба дастаи Rezaryad.\n\nАкнун шумо метавонед ячейкаҳо иҷора кунед ва аз ҳамаи имкониятҳои барнома истифода баред.',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;

  const { data: user } = await supabase
    .from('users')
    .select('id, max_id, name, language, registration_status')
    .eq('id', id)
    .maybeSingle();

  if (!user) return NextResponse.json({ detail: 'Courier not found' }, { status: 404 });

  if (user.registration_status === 'ACTIVE') {
    return NextResponse.json({ detail: 'Courier is already active' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      registration_status: 'ACTIVE',
      is_verified: true,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ detail: 'Failed to approve courier' }, { status: 500 });
  }

  // Notify the courier via MAX messenger
  if (MAX_BOT_TOKEN && user.max_id) {
    const supportedLangs = ['RU', 'UZ', 'TJ'] as const;
    const lang = supportedLangs.includes(user.language as typeof supportedLangs[number])
      ? (user.language as typeof supportedLangs[number])
      : 'RU';
    const text = APPROVAL_MSGS[lang];
    try {
      await fetch(`${MAX_API_BASE}/messages?user_id=${encodeURIComponent(user.max_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: MAX_BOT_TOKEN },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (notifyErr) {
      // Non-fatal – approval already succeeded
      console.error('[approve] Failed to send approval notification:', notifyErr);
    }
  }

  return NextResponse.json({ success: true, message: 'Courier approved and activated' });
}


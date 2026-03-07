import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { NotificationService } from '@/lib/services/notification';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, user_id, start_at')
    .is('end_at', null)
    .lt('start_at', threshold)
    .returns<{ id: string; user_id: string; start_at: string }[]>();

  const notif = new NotificationService(supabase);
  for (const s of sessions ?? []) {
    const minutes = Math.floor((Date.now() - new Date(s.start_at).getTime()) / 60000);
    await notif.sendOpenDoorReminder(s.user_id, minutes);
  }
  return NextResponse.json({ status: 'ok', task: 'check-open-doors' });
}


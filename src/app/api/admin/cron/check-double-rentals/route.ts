import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { NotificationService } from '@/lib/services/notification';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .is('end_at', null)
    .returns<{ user_id: string }[]>();

  const counts: Record<string, number> = {};
  for (const s of activeSessions ?? []) counts[s.user_id] = (counts[s.user_id] || 0) + 1;

  const notif = new NotificationService(supabase);
  for (const [userId, count] of Object.entries(counts)) {
    if (count >= 2) await notif.sendRentalReminder(userId);
  }
  return NextResponse.json({ status: 'ok', task: 'check-double-rentals' });
}


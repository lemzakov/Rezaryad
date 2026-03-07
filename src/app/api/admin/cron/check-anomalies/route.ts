import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { NotificationService } from '@/lib/services/notification';

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: anomalies } = await supabase
    .from('sessions')
    .select('id')
    .is('end_at', null)
    .lt('start_at', threshold)
    .returns<{ id: string }[]>();

  const notif = new NotificationService(supabase);
  for (const s of anomalies ?? []) await notif.notifyAdminAnomaly(s.id);
  return NextResponse.json({ status: 'ok', task: 'check-anomalies' });
}


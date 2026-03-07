import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyCronAuth } from '@/lib/server-auth';
import { BookingService } from '@/lib/services/booking';
import { NotificationService } from '@/lib/services/notification';

async function expireOldBookings() {
  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'ACTIVE')
    .lt('ends_at', now)
    .returns<{ id: string }[]>();
  const svc = new BookingService(supabase);
  for (const b of expired ?? []) await svc.expireBooking(b.id);
}

async function checkOpenDoors() {
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
}

async function checkDoubleRentals() {
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
}

async function checkAnomalies() {
  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: anomalies } = await supabase
    .from('sessions')
    .select('id')
    .is('end_at', null)
    .lt('start_at', threshold)
    .returns<{ id: string }[]>();
  const notif = new NotificationService(supabase);
  for (const s of anomalies ?? []) await notif.notifyAdminAnomaly(s.id);
}

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const results: Record<string, string> = {};
  for (const [name, fn] of [
    ['expire-bookings', expireOldBookings],
    ['check-open-doors', checkOpenDoors],
    ['check-double-rentals', checkDoubleRentals],
    ['check-anomalies', checkAnomalies],
  ] as [string, () => Promise<void>][]) {
    try {
      await fn();
      results[name] = 'ok';
    } catch (e) {
      results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const overall = Object.values(results).every((v) => v === 'ok') ? 'ok' : 'partial';
  return NextResponse.json({ status: overall, task: 'run-all', results });
}


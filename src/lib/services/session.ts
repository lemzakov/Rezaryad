import { SupabaseClient } from '@supabase/supabase-js';
import { DOOR_OPEN_FRAUD_SECONDS } from '../config';
import type { DbSession, DbTariff } from '../types';

export class SessionService {
  constructor(private db: SupabaseClient) {}

  async startSession(userId: string, cellId: string, bookingId?: string | null): Promise<DbSession> {
    const { data: user } = await this.db.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user) throw new Error('User not found');
    if (user.has_debt) throw new Error(`User has debt: ${user.debt_amount}`);

    const { count: activeSessions } = await this.db
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('end_at', null);
    if ((activeSessions ?? 0) >= 2) throw new Error('Max active sessions reached');

    const { data: cell } = await this.db.from('cells').select('id').eq('id', cellId).maybeSingle();
    if (!cell) throw new Error('Cell not found');

    if (bookingId) {
      const { data: booking } = await this.db
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .maybeSingle();
      if (booking && booking.status === 'ACTIVE') {
        await this.db.from('bookings').update({ status: 'CONVERTED' }).eq('id', bookingId);
      }
    }

    const now = new Date();
    const { data: session, error } = await this.db
      .from('sessions')
      .insert({
        user_id: userId,
        cell_id: cellId,
        booking_id: bookingId || null,
        start_at: now.toISOString(),
      })
      .select()
      .single<DbSession>();
    if (error) throw new Error(error.message);

    await this.db.from('cells').update({ status: 'BUSY' }).eq('id', cellId);
    return session;
  }

  async endSession(
    sessionId: string,
    doorClosed: boolean,
    chargerDisconnected: boolean,
  ): Promise<DbSession> {
    if (!doorClosed) throw new Error('Door must be closed before ending session');
    if (!chargerDisconnected) throw new Error('Charger must be disconnected before ending session');

    const { data: session } = await this.db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle<DbSession>();
    if (!session) throw new Error('Session not found');
    if (session.end_at !== null) throw new Error('Session already ended');

    const now = new Date();
    const startAt = new Date(session.start_at);
    const durationMins = (now.getTime() - startAt.getTime()) / 60000;

    const tariff = await this.getTariff(session.user_id, now);
    const cost = this.calculateCost(startAt, now, tariff);

    const { data: ended, error } = await this.db
      .from('sessions')
      .update({ end_at: now.toISOString(), duration_mins: durationMins, cost })
      .eq('id', sessionId)
      .select()
      .single<DbSession>();
    if (error) throw new Error(error.message);

    await this.db.from('cells').update({ status: 'FREE' }).eq('id', session.cell_id);

    if (cost > 0) {
      const { PaymentService } = await import('./payment');
      const paymentSvc = new PaymentService(this.db);
      await paymentSvc.charge(session.user_id, cost, sessionId);
    }

    return ended;
  }

  async getTariff(userId: string, now: Date): Promise<DbTariff | null> {
    const { data: sub } = await this.db
      .from('subscriptions')
      .select('tariff_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('end_at', now.toISOString())
      .maybeSingle();

    if (sub) {
      const { data: tariff } = await this.db
        .from('tariffs')
        .select('*')
        .eq('id', sub.tariff_id)
        .maybeSingle<DbTariff>();
      if (tariff) return tariff;
    }

    const hour = now.getHours();
    const isNight = hour >= 22 || hour < 6;
    const { data: tariff } = await this.db
      .from('tariffs')
      .select('*')
      .eq('is_subscription', false)
      .eq('is_night', isNight)
      .maybeSingle<DbTariff>();
    if (tariff) return tariff;

    const { data: fallback } = await this.db
      .from('tariffs')
      .select('*')
      .eq('is_subscription', false)
      .maybeSingle<DbTariff>();
    return fallback;
  }

  calculateCost(start: Date, end: Date, tariff: DbTariff | null): number {
    if (!tariff) return 0;
    const durationMins = (end.getTime() - start.getTime()) / 60000;
    const freeMins = tariff.free_mins ?? 0;
    const billableMins = Math.max(0, durationMins - freeMins);
    let cost = billableMins * tariff.price_per_minute;
    if (tariff.discount_pct && tariff.discount_pct > 0) {
      cost = cost * (1 - tariff.discount_pct / 100);
    }
    return Math.round(cost * 100) / 100;
  }

  async forceCancelSession(sessionId: string): Promise<void> {
    const { data: session } = await this.db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle<DbSession>();
    if (!session || session.end_at !== null) return;

    const now = new Date();
    const startAt = new Date(session.start_at);
    const elapsed = (now.getTime() - startAt.getTime()) / 1000;
    if (elapsed < DOOR_OPEN_FRAUD_SECONDS) return;

    const durationMins = elapsed / 60;
    const tariff = await this.getTariff(session.user_id, now);
    const cost = this.calculateCost(startAt, now, tariff);

    await this.db
      .from('sessions')
      .update({ end_at: now.toISOString(), duration_mins: durationMins, cost })
      .eq('id', sessionId);
    await this.db.from('cells').update({ status: 'FREE' }).eq('id', session.cell_id);

    if (cost > 0) {
      const { PaymentService } = await import('./payment');
      const paymentSvc = new PaymentService(this.db);
      await paymentSvc.charge(session.user_id, cost, sessionId);
    }
  }
}


import { SupabaseClient } from '@supabase/supabase-js';
import {
  BOOKING_FREE_MINS,
  BOOKING_FREE_MINS_SUBSCRIBED,
  PENALTY_HOURS,
  MAX_ACTIVE_BOOKINGS,
  MAX_ACTIVE_SESSIONS,
} from '../config';
import type { DbBooking } from '../types';

export class BookingService {
  constructor(private db: SupabaseClient) {}

  async createBooking(userId: string, cellId: string): Promise<DbBooking> {
    const { data: user } = await this.db
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!user) throw new Error('User not found');
    if (user.has_debt) throw new Error(`User has debt: ${user.debt_amount}`);

    const { count: activeBookings } = await this.db
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');
    if ((activeBookings ?? 0) >= MAX_ACTIVE_BOOKINGS) throw new Error('Max active bookings reached');

    const { count: activeSessions } = await this.db
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('end_at', null);
    if ((activeSessions ?? 0) >= MAX_ACTIVE_SESSIONS) throw new Error('Max active sessions reached');

    const { data: cell } = await this.db
      .from('cells')
      .select('*')
      .eq('id', cellId)
      .maybeSingle();
    if (!cell || cell.status !== 'FREE') throw new Error('Cell is not available');

    const now = new Date();
    const { data: penaltyBooking } = await this.db
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['CANCELLED', 'EXPIRED'])
      .gt('penalty_until', now.toISOString())
      .maybeSingle();
    const isFree = penaltyBooking === null;

    const { data: sub } = await this.db
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('end_at', now.toISOString())
      .maybeSingle();
    const freeMins = sub ? BOOKING_FREE_MINS_SUBSCRIBED : BOOKING_FREE_MINS;
    const endsAt = new Date(now.getTime() + freeMins * 60 * 1000);

    const { data: booking, error } = await this.db
      .from('bookings')
      .insert({
        user_id: userId,
        cell_id: cellId,
        status: 'ACTIVE',
        is_free: isFree,
        ends_at: endsAt.toISOString(),
      })
      .select()
      .single<DbBooking>();
    if (error) throw new Error(error.message);

    await this.db.from('cells').update({ status: 'BUSY' }).eq('id', cellId);
    return booking;
  }

  async cancelBooking(bookingId: string, userId: string): Promise<Date> {
    const { data: booking } = await this.db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle<DbBooking>();
    if (!booking || booking.user_id !== userId) throw new Error('Booking not found');
    if (booking.status !== 'ACTIVE') throw new Error('Booking is not active');

    const now = new Date();
    const penaltyUntil = new Date(now.getTime() + PENALTY_HOURS * 60 * 60 * 1000);

    await this.db
      .from('bookings')
      .update({ status: 'CANCELLED', penalty_until: penaltyUntil.toISOString() })
      .eq('id', bookingId);
    await this.db.from('cells').update({ status: 'FREE' }).eq('id', booking.cell_id);
    return penaltyUntil;
  }

  async expireBooking(bookingId: string): Promise<DbBooking | null> {
    const { data: booking } = await this.db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle<DbBooking>();
    if (!booking || booking.status !== 'ACTIVE') return null;

    const now = new Date();
    if (new Date(booking.ends_at) > now) return null;

    await this.db.from('bookings').update({ status: 'EXPIRED' }).eq('id', bookingId);

    const { data: activeSession } = await this.db
      .from('sessions')
      .select('id')
      .eq('booking_id', bookingId)
      .is('end_at', null)
      .maybeSingle();
    if (!activeSession) {
      await this.db.from('cells').update({ status: 'FREE' }).eq('id', booking.cell_id);
    }
    return booking;
  }
}


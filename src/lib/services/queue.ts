import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationService } from './notification';
import { BOOKING_FREE_MINS_SUBSCRIBED } from '../config';
import type { DbWaitQueue } from '../types';

export class QueueService {
  constructor(private db: SupabaseClient) {}

  async joinQueue(userId: string, lockerId: string): Promise<DbWaitQueue> {
    const { data: existing } = await this.db
      .from('wait_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('locker_id', lockerId)
      .maybeSingle<DbWaitQueue>();
    if (existing) return existing;

    const { count } = await this.db
      .from('wait_queue')
      .select('*', { count: 'exact', head: true })
      .eq('locker_id', lockerId);
    const position = (count ?? 0) + 1;

    const { data: entry, error } = await this.db
      .from('wait_queue')
      .insert({ user_id: userId, locker_id: lockerId, position })
      .select()
      .single<DbWaitQueue>();
    if (error) throw new Error(error.message);
    return entry;
  }

  async leaveQueue(userId: string, lockerId: string): Promise<void> {
    const { data: entry } = await this.db
      .from('wait_queue')
      .select('id')
      .eq('user_id', userId)
      .eq('locker_id', lockerId)
      .maybeSingle();
    if (!entry) return;

    await this.db.from('wait_queue').delete().eq('id', entry.id);
    await this.reorderQueue(lockerId);
  }

  async notifyNext(lockerId: string): Promise<void> {
    const { data: nextEntry } = await this.db
      .from('wait_queue')
      .select('*')
      .eq('locker_id', lockerId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle<DbWaitQueue>();
    if (!nextEntry) return;

    const notifSvc = new NotificationService(this.db);
    await notifSvc.sendQueueTurn(nextEntry.user_id, lockerId);

    const { data: cell } = await this.db
      .from('cells')
      .select('id')
      .eq('locker_id', lockerId)
      .eq('status', 'FREE')
      .maybeSingle();
    if (cell) {
      const now = new Date();
      const endsAt = new Date(now.getTime() + BOOKING_FREE_MINS_SUBSCRIBED * 60 * 1000);
      await this.db.from('bookings').insert({
        user_id: nextEntry.user_id,
        cell_id: cell.id,
        status: 'ACTIVE',
        is_free: true,
        ends_at: endsAt.toISOString(),
      });
      await this.db.from('cells').update({ status: 'BUSY' }).eq('id', cell.id);
    }

    await this.db.from('wait_queue').delete().eq('id', nextEntry.id);
    await this.reorderQueue(lockerId);
  }

  private async reorderQueue(lockerId: string): Promise<void> {
    const { data: remaining } = await this.db
      .from('wait_queue')
      .select('id')
      .eq('locker_id', lockerId)
      .order('created_at', { ascending: true });
    if (!remaining) return;
    for (let i = 0; i < remaining.length; i++) {
      await this.db.from('wait_queue').update({ position: i + 1 }).eq('id', remaining[i].id);
    }
  }
}


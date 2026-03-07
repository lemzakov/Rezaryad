import { SupabaseClient } from '@supabase/supabase-js';
import { ACQUIRING_API_KEY, ACQUIRING_BASE_URL } from '../config';

export class PaymentService {
  constructor(private db: SupabaseClient) {}

  async charge(
    userId: string,
    amount: number,
    sessionId?: string | null,
  ): Promise<Record<string, unknown>> {
    const { data: user } = await this.db.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user) throw new Error('User not found');

    const { data: card } = await this.db
      .from('payment_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    const { data: payment, error } = await this.db
      .from('payments')
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        amount,
        status: 'PENDING',
        card_token: card?.card_token || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (!card) return this.handleInsufficientFunds(sessionId, amount, userId, payment.id);

    let success = false;
    try {
      success = await this.callAcquiring(card.card_token, amount, payment.id);
    } catch {
      success = false;
    }

    if (success) {
      await this.db.from('payments').update({ status: 'SUCCESS' }).eq('id', payment.id);
      if (sessionId) {
        await this.db.from('sessions').update({ is_paid: true }).eq('id', sessionId);
      }
      return { status: 'success', payment_id: payment.id };
    }
    return this.handleInsufficientFunds(sessionId, amount, userId, payment.id);
  }

  private async callAcquiring(
    cardToken: string,
    amount: number,
    paymentId: string,
  ): Promise<boolean> {
    try {
      const resp = await fetch(`${ACQUIRING_BASE_URL}/charge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACQUIRING_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ card_token: cardToken, amount, order_id: paymentId }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      return data.status === 'success';
    } catch {
      return false;
    }
  }

  private async handleInsufficientFunds(
    _sessionId: string | null | undefined,
    amount: number,
    userId: string,
    paymentId: string,
  ): Promise<Record<string, unknown>> {
    await this.db.from('payments').update({ status: 'FAILED' }).eq('id', paymentId);
    const { data: user } = await this.db.from('users').select('debt_amount').eq('id', userId).maybeSingle();
    const newDebt = (user?.debt_amount ?? 0) + amount;
    await this.db
      .from('users')
      .update({ has_debt: true, debt_amount: newDebt })
      .eq('id', userId);
    return { status: 'debt', debt_amount: newDebt };
  }

  async processDebt(userId: string): Promise<boolean> {
    const { data: user } = await this.db.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user || !user.has_debt || user.debt_amount <= 0) return true;

    const { data: card } = await this.db
      .from('payment_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (!card) return false;

    const { data: payment, error } = await this.db
      .from('payments')
      .insert({
        user_id: userId,
        amount: user.debt_amount,
        status: 'PENDING',
        card_token: card.card_token,
      })
      .select()
      .single();
    if (error) return false;

    const success = await this.callAcquiring(card.card_token, user.debt_amount, payment.id);
    if (success) {
      await this.db.from('payments').update({ status: 'SUCCESS' }).eq('id', payment.id);
      await this.db
        .from('users')
        .update({ has_debt: false, debt_amount: 0 })
        .eq('id', userId);
      return true;
    }
    await this.db.from('payments').update({ status: 'FAILED' }).eq('id', payment.id);
    return false;
  }
}


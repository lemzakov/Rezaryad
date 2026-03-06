import { PrismaClient } from '@prisma/client';
import { ACQUIRING_API_KEY, ACQUIRING_BASE_URL } from '../config';

export class PaymentService {
  constructor(private db: PrismaClient) {}

  async charge(userId: string, amount: number, sessionId?: string | null): Promise<Record<string, unknown>> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const card = await this.db.paymentCard.findFirst({ where: { userId, isActive: true } });

    const payment = await this.db.payment.create({
      data: {
        userId,
        sessionId: sessionId || null,
        amount,
        status: 'PENDING',
        cardToken: card?.cardToken || null,
      },
    });

    if (!card) return this.handleInsufficientFunds(sessionId, amount, userId, payment.id);

    let success = false;
    try {
      success = await this.callAcquiring(card.cardToken, amount, payment.id);
    } catch {
      success = false;
    }

    if (success) {
      await this.db.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS' } });
      if (sessionId) {
        await this.db.session.update({ where: { id: sessionId }, data: { isPaid: true } });
      }
      return { status: 'success', payment_id: payment.id };
    } else {
      return this.handleInsufficientFunds(sessionId, amount, userId, payment.id);
    }
  }

  private async callAcquiring(cardToken: string, amount: number, paymentId: string): Promise<boolean> {
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
    sessionId: string | null | undefined,
    amount: number,
    userId: string,
    paymentId: string,
  ): Promise<Record<string, unknown>> {
    await this.db.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
    const user = await this.db.user.findUnique({ where: { id: userId } });
    const newDebt = (user?.debtAmount ?? 0) + amount;
    await this.db.user.update({
      where: { id: userId },
      data: { hasDebt: true, debtAmount: newDebt },
    });
    return { status: 'debt', debt_amount: newDebt };
  }

  async processDebt(userId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || !user.hasDebt || user.debtAmount <= 0) return true;

    const card = await this.db.paymentCard.findFirst({ where: { userId, isActive: true } });
    if (!card) return false;

    const payment = await this.db.payment.create({
      data: { userId, amount: user.debtAmount, status: 'PENDING', cardToken: card.cardToken },
    });

    const success = await this.callAcquiring(card.cardToken, user.debtAmount, payment.id);
    if (success) {
      await this.db.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS' } });
      await this.db.user.update({ where: { id: userId }, data: { hasDebt: false, debtAmount: 0 } });
      return true;
    } else {
      await this.db.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      return false;
    }
  }
}

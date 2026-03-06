import { PrismaClient } from '@prisma/client';
import { MAX_BOT_TOKEN, MAX_API_BASE } from '../config';

async function sendMessage(chatId: string, text: string, keyboard?: unknown): Promise<void> {
  const payload: Record<string, unknown> = {
    recipient: { chat_id: chatId },
    body: { type: 'text', text },
  };
  if (keyboard) {
    (payload.body as Record<string, unknown>).attachments = [keyboard];
  }
  try {
    await fetch(`${MAX_API_BASE}/messages?access_token=${MAX_BOT_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // silently ignore notification errors
  }
}

export class NotificationService {
  constructor(private db: PrismaClient) {}

  private async getUserChat(userId: string): Promise<{ maxId: string | null; language: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    return { maxId: user?.maxId ?? null, language: user?.language ?? 'RU' };
  }

  private async record(userId: string, type: string, message: string): Promise<void> {
    await this.db.notification.create({ data: { userId, type, message } });
  }

  async sendOpenDoorReminder(userId: string, minutes: number): Promise<void> {
    const { maxId, language } = await this.getUserChat(userId);
    if (!maxId) return;
    const msgs: Record<string, string> = {
      RU: `⚠️ Дверца вашей ячейки открыта уже ${minutes} минут. Пожалуйста, закройте её.`,
      UZ: `⚠️ Katak eshigingiz ${minutes} daqiqadan beri ochiq. Iltimos, yoping.`,
      TJ: `⚠️ Дари ячейкаи шумо ${minutes} дақиқа аст кушода аст. Лутфан пӯшед.`,
    };
    const msg = msgs[language] || msgs.RU;
    await sendMessage(maxId, msg);
    await this.record(userId, 'open_door_reminder', msg);
  }

  async sendRentalReminder(userId: string): Promise<void> {
    const { maxId, language } = await this.getUserChat(userId);
    if (!maxId) return;
    const msgs: Record<string, string> = {
      RU: '⏰ Напоминание: у вас 2 активные аренды. Не забудьте завершить сессии.',
      UZ: '⏰ Eslatma: sizda 2 ta faol ijara bor. Sessiyalarni yakunlashni unutmang.',
      TJ: '⏰ Ёдоварӣ: Шумо 2 иҷораи фаъол доред. Сессияҳоро хотима додан фаромӯш накунед.',
    };
    const msg = msgs[language] || msgs.RU;
    await sendMessage(maxId, msg);
    await this.record(userId, 'rental_reminder', msg);
  }

  async sendQueueTurn(userId: string, lockerId: string): Promise<void> {
    const { maxId, language } = await this.getUserChat(userId);
    if (!maxId) return;
    const locker = await this.db.locker.findUnique({ where: { id: lockerId } });
    const lockerName = locker?.name ?? '?';
    const msgs: Record<string, string> = {
      RU: `🎉 Ваша очередь! Свободная ячейка в ${lockerName}. У вас 10 минут на бесплатное бронирование.`,
      UZ: `🎉 Sizning navbatingiz! ${lockerName}da bo'sh katak bor. Sizda bepul bron uchun 10 daqiqa bor.`,
      TJ: `🎉 Навбати шумо! Дар ${lockerName} ячейкаи озод аст. Барои бронии ройгон 10 дақиқа доред.`,
    };
    const msg = msgs[language] || msgs.RU;
    await sendMessage(maxId, msg);
    await this.record(userId, 'queue_turn', msg);
  }

  async notifyAdminAnomaly(sessionId: string): Promise<void> {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session) return;
    console.warn(`⚠️ Anomaly: session ${sessionId}, user ${session.userId}, started ${session.startAt}`);
  }
}

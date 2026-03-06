import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BookingService } from '@/lib/services/booking';
import { SessionService } from '@/lib/services/session';
import { QueueService } from '@/lib/services/queue';
import { PaymentService } from '@/lib/services/payment';
import { MAX_BOT_TOKEN, MAX_API_BASE, BOOKING_FREE_MINS, BOOKING_FREE_MINS_SUBSCRIBED } from '@/lib/config';

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
  } catch { /* ignore */ }
}

async function answerCallback(callbackId: string, text: string): Promise<void> {
  try {
    await fetch(`${MAX_API_BASE}/answers?access_token=${MAX_BOT_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_id: callbackId, message: { text } }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* ignore */ }
}

function inlineKeyboard(buttons: { type: string; text: string; payload?: string; url?: string }[][]): unknown {
  return { type: 'inline_keyboard', payload: { buttons } };
}

function btn(text: string, payload: string) { return { type: 'callback', text, payload }; }

const MSGS: Record<string, Record<string, string>> = {
  welcome: { RU: '👋 Добро пожаловать в Rezaryad!\nВыберите язык:', UZ: "👋 Rezaryad xizmatiga xush kelibsiz!\nTilni tanlang:", TJ: '👋 Хуш омадед ба Rezaryad!\nЗабонро интихоб кунед:' },
  main_menu: { RU: '🏠 Главное меню', UZ: '🏠 Asosiy menyu', TJ: '🏠 Менюи асосӣ' },
  scan_qr: { RU: '📷 Отсканируйте QR-код на шкафчике:', UZ: '📷 Shkafchadagi QR-kodni skanerlang:', TJ: '📷 QR-рамзи қуттиро скан кунед:' },
  no_free_cells: { RU: '😔 Нет свободных ячеек. Хотите встать в очередь?', UZ: "😔 Bo'sh kataklar yo'q. Navbatga turishni xohlaysizmi?", TJ: '😔 Ячейкаҳои озод нест. Мехоҳед дар навбат бистед?' },
  error_generic: { RU: '❌ Произошла ошибка. Попробуйте позже.', UZ: "❌ Xatolik yuz berdi. Keyinroq urinib ko'ring.", TJ: '❌ Хато рух дод. Баъдтар кӯшиш кунед.' },
  has_debt: { RU: '🚫 У вас есть долг: {amount} руб. Сначала погасите задолженность.', UZ: "🚫 Sizda qarz bor: {amount} so'm. Avval qarzni to'lang.", TJ: '🚫 Шумо қарз доред: {amount} сомонӣ. Аввал қарзро пардозед.' },
  not_verified: { RU: '🔐 Для аренды необходимо пройти верификацию через Госуслуги.', UZ: "🔐 Ijara olish uchun Gosuslugi orqali tasdiqlash kerak.", TJ: '🔐 Барои иҷора тасдиқшавӣ тавассути Gosuslugi лозим аст.' },
  max_bookings: { RU: '🚫 У вас уже есть активное бронирование.', UZ: '🚫 Sizda allaqachon faol bron mavjud.', TJ: '🚫 Шумо аллакай бронировании фаъол доред.' },
  max_sessions: { RU: '🚫 Достигнут лимит активных аренд (максимум 2).', UZ: '🚫 Faol ijaralar chegarasiga yetildi (maksimum 2).', TJ: '🚫 Ба ҳадди аксари иҷораҳои фаъол расидед (максимум 2).' },
  queue_joined: { RU: '⏳ Вы добавлены в очередь. Ваша позиция: #{position}', UZ: "⏳ Navbatga qo'shildingiz. Sizning o'rningiz: #{position}", TJ: '⏳ Шумо ба навбат илова шудед. Мавқеи шумо: #{position}' },
  debt_cleared: { RU: '✅ Задолженность погашена! Теперь вы можете арендовать ячейки.', UZ: "✅ Qarz to'landi! Endi kataklar ijaraga olishingiz mumkin.", TJ: '✅ Қарз пардохт шуд! Акнун шумо метавонед ячейкаҳо иҷора кунед.' },
};

function getMsg(key: string, lang: string, vars: Record<string, unknown> = {}): string {
  const l = ['RU', 'UZ', 'TJ'].includes(lang) ? lang : 'RU';
  let tmpl = MSGS[key]?.[l] || MSGS[key]?.['RU'] || '';
  for (const [k, v] of Object.entries(vars)) tmpl = tmpl.replace(`{${k}}`, String(v));
  return tmpl;
}

function mainMenuKb(lang: string) {
  const labels = (
    lang === 'UZ' ? ["🗺 Shkafchalar xaritasi", '📷 QR skanerlash', '👤 Shaxsiy kabinet'] :
    lang === 'TJ' ? ['🗺 Харитаи қуттиҳо', '📷 Сканерзии QR', '👤 Кабинети шахсӣ'] :
    ['🗺 Карта шкафчиков', '📷 Сканировать QR', '👤 Личный кабинет']
  );
  return inlineKeyboard([[btn(labels[0], 'menu:map')], [btn(labels[1], 'menu:scan_qr')], [btn(labels[2], 'menu:cabinet')]]);
}

function langKb() { return inlineKeyboard([[btn('🇷🇺 Русский', 'lang:RU'), btn("🇺🇿 O'zbek", 'lang:UZ'), btn('🇹🇯 Тоҷикӣ', 'lang:TJ')]]); }
function sessionKb(lang: string, sessionId: string) { const label = lang === 'UZ' ? '🔒 Yakunlash' : lang === 'TJ' ? '🔒 Хотима додан' : '🔒 Завершить аренду'; return inlineKeyboard([[btn(label, `session:end:${sessionId}`)]]); }
function cabinetKb(lang: string) { const l = lang === 'UZ' ? ['📋 Mening sessiyalarim', '💳 Mening kartalarim', '🔔 Obuna', '⬅️ Orqaga'] : lang === 'TJ' ? ['📋 Сессияҳои ман', '💳 Картаҳои ман', '🔔 Обуна', '⬅️ Бозгашт'] : ['📋 Мои сессии', '💳 Мои карты', '🔔 Подписка', '⬅️ Назад']; return inlineKeyboard([[btn(l[0], 'cabinet:sessions'), btn(l[1], 'cabinet:cards')], [btn(l[2], 'cabinet:subscription')], [btn(l[3], 'menu:main')]]); }
function queueJoinKb(lang: string, lockerId: string) { const [yes, no] = lang === 'UZ' ? ["✅ Ha, qo'shish", "❌ Yo'q"] : lang === 'TJ' ? ['✅ Бале, илова кун', '❌ Не'] : ['✅ Да, встать', '❌ Нет']; return inlineKeyboard([[btn(yes, `queue:confirm:${lockerId}`), btn(no, 'menu:main')]]); }
function debtKb(lang: string) { const label = lang === 'UZ' ? "💳 Qarzni to'lash" : lang === 'TJ' ? '💳 Пардохти қарз' : '💳 Погасить долг'; return inlineKeyboard([[btn(label, 'debt:pay')]]); }
function confirmBookingKb(lang: string, cellId: string) { const [yes, no] = lang === 'UZ' ? ['✅ Tasdiqlash', '❌ Bekor qilish'] : lang === 'TJ' ? ['✅ Тасдиқ кардан', '❌ Бекор кардан'] : ['✅ Подтвердить', '❌ Отмена']; return inlineKeyboard([[btn(yes, `book:confirm:${cellId}`), btn(no, 'book:cancel')]]); }
function lockerKb(lang: string, lockerId: string, hasFreeCells: boolean) { if (hasFreeCells) { const label = lang === 'UZ' ? '📋 Bron qilish' : lang === 'TJ' ? '📋 Бронировон кардан' : '📋 Забронировать'; return inlineKeyboard([[btn(label, `book:locker:${lockerId}`)]]); } else { const label = lang === 'UZ' ? '⏳ Navbatga turish' : lang === 'TJ' ? '⏳ Ба навбат гузоштан' : '⏳ Встать в очередь'; return inlineKeyboard([[btn(label, `queue:join:${lockerId}`)]]); } }

async function getOrCreateUser(maxId: string) {
  let user = await prisma.user.findUnique({ where: { maxId } });
  if (!user) user = await prisma.user.create({ data: { maxId, language: 'RU' } });
  return user;
}

async function handleMessage(update: Record<string, unknown>) {
  const msg = (update.message || {}) as Record<string, unknown>;
  const sender = (msg.sender || {}) as Record<string, unknown>;
  const maxId = String(sender.user_id || '');
  const chatId = String(((msg.recipient || {}) as Record<string, unknown>).chat_id || maxId);
  const body = (msg.body || {}) as Record<string, unknown>;
  const text = String(body.text || '').trim();
  if (!maxId) return;

  const user = await getOrCreateUser(maxId);
  const lang = user.language;

  if (text.toLowerCase() === '/start' || text.toLowerCase() === 'start') {
    await sendMessage(chatId, getMsg('welcome', lang), langKb());
    return;
  }
  if (text.toLowerCase() === '/menu') {
    await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang));
    return;
  }
  if (text.length > 6 && !text.startsWith('/')) {
    const locker = await prisma.locker.findUnique({ where: { qrCode: text }, include: { cells: true } });
    if (locker) {
      const freeCells = locker.cells.filter((c) => c.status === 'FREE');
      const tariffs = await prisma.tariff.findMany({ where: { isSubscription: false } });
      const currency = (({ RU: 'руб/мин', UZ: "so'm/daq", TJ: 'сомонӣ/дақ' }) as Record<string, string>)[lang] || 'руб/мин';
      const tariffLines = tariffs.map((t) => `  • ${t.name}: ${t.pricePerMinute} ${currency}`).join('\n');
      if (freeCells.length === 0) {
        await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, locker.id));
      } else {
        const infoText = `🔋 Шкафчик: ${locker.name}\n📍 Адрес: ${locker.address}\n🟢 Свободных ячеек: ${freeCells.length}\n\n💰 Тарифы:\n${tariffLines || '—'}`;
        await sendMessage(chatId, infoText, lockerKb(lang, locker.id, true));
      }
      return;
    }
  }
  await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang));
}

async function handleCallback(update: Record<string, unknown>) {
  const cb = (update.callback || {}) as Record<string, unknown>;
  const callbackId = String(cb.callback_id || '');
  const payload = String(cb.payload || '');
  const sender = (cb.user || {}) as Record<string, unknown>;
  const maxId = String(sender.user_id || '');
  const chatId = String(
    ((cb.message as Record<string, unknown>)?.recipient as Record<string, unknown>)?.chat_id || maxId
  );

  if (!maxId) return;
  const user = await getOrCreateUser(maxId);
  const lang = user.language;
  const parts = payload.split(':');

  try {
    if (parts[0] === 'lang') {
      const newLang = parts[1];
      if (['RU', 'UZ', 'TJ'].includes(newLang)) {
        await prisma.user.update({ where: { id: user.id }, data: { language: newLang as 'RU' | 'UZ' | 'TJ' } });
        await answerCallback(callbackId, getMsg('main_menu', newLang));
        await sendMessage(chatId, getMsg('main_menu', newLang), mainMenuKb(newLang));
      }
    } else if (parts[0] === 'menu') {
      const action = parts[1];
      if (action === 'main') await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang));
      else if (action === 'scan_qr') await sendMessage(chatId, getMsg('scan_qr', lang));
      else if (action === 'map') {
        const lockers = await prisma.locker.findMany({ where: { isActive: true } });
        const lines = lockers.map((l) => `📍 ${l.name} — ${l.address}`).join('\n');
        await sendMessage(chatId, lines ? `🗺 Шкафчики:\n${lines}` : 'Нет активных шкафчиков');
      } else if (action === 'cabinet') {
        const totalSessions = await prisma.session.count({ where: { userId: user.id } });
        const activeSessions = await prisma.session.count({ where: { userId: user.id, endAt: null } });
        const cabinetText = `👤 Личный кабинет\n\n📊 Статистика:\n💳 Долг: ${user.debtAmount.toFixed(2)}\n✅ Сессий всего: ${totalSessions}\n🔋 Активных аренд: ${activeSessions}`;
        await sendMessage(chatId, cabinetText, cabinetKb(lang));
      }
    } else if (parts[0] === 'cabinet') {
      const action = parts[1];
      if (action === 'sessions') {
        const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 });
        if (sessions.length) {
          const lines = sessions.map((s) => {
            const dur = s.durationMins != null ? s.durationMins.toFixed(1) : '—';
            const cost = s.cost != null ? s.cost.toFixed(2) : '0.00';
            return `📅 ${s.startAt.toLocaleDateString()} | ⏱${dur}мин | 💰${cost}`;
          });
          await sendMessage(chatId, '📋 Ваши сессии:\n' + lines.join('\n'));
        } else await sendMessage(chatId, 'Нет сессий');
      } else if (action === 'cards') {
        const cards = await prisma.paymentCard.findMany({ where: { userId: user.id, isActive: true } });
        if (cards.length) await sendMessage(chatId, 'Ваши карты:\n' + cards.map((c) => `💳 **** ${c.lastFour}`).join('\n'));
        else await sendMessage(chatId, 'Карты не привязаны');
      } else if (action === 'subscription') {
        const sub = await prisma.subscription.findFirst({ where: { userId: user.id, isActive: true } });
        if (sub) await sendMessage(chatId, `✅ Подписка активна до ${sub.endAt.toLocaleDateString()}`);
        else await sendMessage(chatId, '❌ Нет активной подписки');
      }
    } else if (parts[0] === 'book' && parts[1] === 'locker') {
      const lockerId = parts[2];
      if (user.hasDebt) { await sendMessage(chatId, getMsg('has_debt', lang, { amount: user.debtAmount.toFixed(2) }), debtKb(lang)); return; }
      if (!user.isVerified) { await sendMessage(chatId, getMsg('not_verified', lang)); return; }
      const activeBookings = await prisma.booking.count({ where: { userId: user.id, status: 'ACTIVE' } });
      if (activeBookings >= 1) { await sendMessage(chatId, getMsg('max_bookings', lang)); return; }
      const activeSessions = await prisma.session.count({ where: { userId: user.id, endAt: null } });
      if (activeSessions >= 2) { await sendMessage(chatId, getMsg('max_sessions', lang)); return; }
      const cell = await prisma.cell.findFirst({ where: { lockerId, status: 'FREE' } });
      if (!cell) { await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, lockerId)); return; }
      const locker = await prisma.locker.findUnique({ where: { id: lockerId } });
      const sub = await prisma.subscription.findFirst({ where: { userId: user.id, isActive: true } });
      const freeMins = sub ? BOOKING_FREE_MINS_SUBSCRIBED : BOOKING_FREE_MINS;
      await sendMessage(chatId, `📋 Подтвердить бронирование?\n🔋 Ячейка #${cell.number} в ${locker?.name || '—'}\n⏱ Бесплатно: ${freeMins} мин`, confirmBookingKb(lang, cell.id));
    } else if (parts[0] === 'book' && parts[1] === 'confirm') {
      const cellId = parts[2];
      const svc = new BookingService(prisma);
      try {
        const booking = await svc.createBooking(user.id, cellId);
        const cell = await prisma.cell.findUnique({ where: { id: cellId }, include: { locker: true } });
        await answerCallback(callbackId, '✅');
        await sendMessage(chatId, `✅ Бронирование создано!\n⏰ Действует до: ${booking.endsAt.toLocaleTimeString()}\nЯчейка #${cell?.number || '?'}`, sessionKb(lang, 'pending'));
      } catch (e) { await sendMessage(chatId, String(e)); }
    } else if (parts[0] === 'book' && parts[1] === 'cancel') {
      await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang));
    } else if (parts[0] === 'session' && parts[1] === 'end') {
      const sessionId = parts[2];
      if (sessionId === 'pending') {
        const booking = await prisma.booking.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });
        if (booking) {
          const svc = new SessionService(prisma);
          const session = await svc.startSession(user.id, booking.cellId, booking.id);
          await answerCallback(callbackId, `🔓 Сессия началась в ${session.startAt.toLocaleTimeString()}`);
          await sendMessage(chatId, `🔓 Ячейка открыта! Сессия началась.\n⏱ Начало: ${session.startAt.toLocaleTimeString()}`, sessionKb(lang, session.id));
        }
        return;
      }
      const svc = new SessionService(prisma);
      try {
        const ended = await svc.endSession(sessionId, true, true);
        await answerCallback(callbackId, '✅');
        await sendMessage(chatId, `✅ Сессия завершена!\n⏱ Длительность: ${ended.durationMins?.toFixed(1) || '0'} мин\n💰 Стоимость: ${ended.cost?.toFixed(2) || '0.00'} руб`);
      } catch (e) { await sendMessage(chatId, String(e)); }
    } else if (parts[0] === 'queue') {
      const action = parts[1];
      const lockerId = parts[2];
      if (action === 'join') await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, lockerId));
      else if (action === 'confirm') {
        const svc = new QueueService(prisma);
        const entry = await svc.joinQueue(user.id, lockerId);
        await answerCallback(callbackId, '✅');
        await sendMessage(chatId, getMsg('queue_joined', lang, { position: entry.position }));
      }
    } else if (parts[0] === 'debt' && parts[1] === 'pay') {
      const svc = new PaymentService(prisma);
      const result = await svc.processDebt(user.id);
      await sendMessage(chatId, result ? getMsg('debt_cleared', lang) : getMsg('error_generic', lang));
    }
  } catch (e) {
    console.error('Callback handler error:', e);
    await sendMessage(chatId, getMsg('error_generic', lang));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updateType = body.update_type || '';
    if (updateType === 'message_created') await handleMessage(body);
    else if (updateType === 'message_callback') await handleCallback(body);
  } catch (e) {
    console.error('Webhook handler error:', e);
  }
  return NextResponse.json({ ok: true });
}

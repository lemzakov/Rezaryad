import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { BookingService } from '@/lib/services/booking';
import { SessionService } from '@/lib/services/session';
import { QueueService } from '@/lib/services/queue';
import { PaymentService } from '@/lib/services/payment';
import { MAX_BOT_TOKEN, MAX_API_BASE, BOOKING_FREE_MINS, BOOKING_FREE_MINS_SUBSCRIBED } from '@/lib/config';
import type { DbUser } from '@/lib/types';

type LogCtx = { userId: string; maxId: string };

async function sendMessage(chatId: string, text: string, keyboard?: unknown, logCtx?: LogCtx): Promise<void> {
  const payload: Record<string, unknown> = { text };
  if (keyboard) {
    payload.attachments = [keyboard];
  }
  try {
    await fetch(`${MAX_API_BASE}/messages?chat_id=${encodeURIComponent(chatId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: MAX_BOT_TOKEN },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (logCtx) {
      void supabase.from('max_messages').insert({
        user_id: logCtx.userId,
        max_id: logCtx.maxId,
        direction: 'OUT' as const,
        text: text.slice(0, 1000),
      });
    }
  } catch (e) {
    console.error('sendMessage error:', e instanceof Error ? e.message : String(e));
  }
}

async function answerCallback(callbackId: string, text: string): Promise<void> {
  try {
    await fetch(`${MAX_API_BASE}/answers?callback_id=${encodeURIComponent(callbackId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: MAX_BOT_TOKEN },
      body: JSON.stringify({ notification: text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('answerCallback error:', e instanceof Error ? e.message : String(e));
  }
}

function inlineKeyboard(buttons: { type: string; text: string; payload?: string; url?: string }[][]): unknown {
  return { type: 'inline_keyboard', payload: { buttons } };
}

function btn(text: string, payload: string) { return { type: 'callback', text, payload }; }

const MSGS: Record<string, Record<string, string>> = {
  welcome: {
    RU: '👋 Добро пожаловать в Rezaryad!\n🆔 Ваш MAX ID: {maxId}\nВыберите язык:',
    UZ: "👋 Rezaryad xizmatiga xush kelibsiz!\n🆔 Sizning MAX ID: {maxId}\nTilni tanlang:",
    TJ: '👋 Хуш омадед ба Rezaryad!\n🆔 MAX ID-и шумо: {maxId}\nЗабонро интихоб кунед:',
  },
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
  onboarding_ask_name: {
    RU: '📝 Регистрация курьера\n\nШаг 1/2: Введите ваше полное имя (Фамилия Имя):',
    UZ: "📝 Kuryer ro'yxatdan o'tish\n\n1/2-qadam: To'liq ismingizni kiriting (Familiya Ism):",
    TJ: '📝 Сабти номи курьер\n\nҚадами 1/2: Номи пурраи худро ворид кунед (Насаб Ном):',
  },
  onboarding_ask_phone: {
    RU: '📱 Шаг 2/2: Введите ваш номер телефона (например: +7XXXXXXXXXX):',
    UZ: "📱 2/2-qadam: Telefon raqamingizni kiriting (masalan: +998XXXXXXXXX):",
    TJ: '📱 Қадами 2/2: Рақами телефони худро ворид кунед (масалан: +992XXXXXXXXX):',
  },
  onboarding_done: {
    RU: '✅ Заявка на регистрацию принята!\n\nАдминистратор рассмотрит вашу заявку и активирует аккаунт. Мы уведомим вас.',
    UZ: "✅ Ro'yxatdan o'tish uchun ariza qabul qilindi!\n\nAdministrator arizangizni ko'rib chiqadi va hisobingizni faollashtiradi.",
    TJ: '✅ Дархости сабти ном қабул шуд!\n\nМудир дархости шуморо баррасӣ карда, ҳисобро фаъол мекунад.',
  },
  onboarding_name_too_short: {
    RU: '⚠️ Имя слишком короткое. Введите полное имя (минимум 2 символа):',
    UZ: "⚠️ Ism juda qisqa. To'liq ismingizni kiriting (kamida 2 ta belgi):",
    TJ: '⚠️ Ном хеле кӯтоҳ аст. Номи пурраро ворид кунед (ҳадди ақал 2 аломат):',
  },
  onboarding_phone_invalid: {
    RU: '⚠️ Неверный формат номера. Введите номер в формате +7XXXXXXXXXX:',
    UZ: "⚠️ Noto'g'ri raqam formati. Raqamni +998XXXXXXXXX formatida kiriting:",
    TJ: '⚠️ Формати нодурусти рақам. Рақамро дар формати +992XXXXXXXXX ворид кунед:',
  },
  already_registered: {
    RU: '✅ Вы уже зарегистрированы как курьер.',
    UZ: "✅ Siz allaqachon kuryer sifatida ro'yxatdan o'tgansiz.",
    TJ: '✅ Шумо аллакай ҳамчун курьер сабти ном шудаед.',
  },
  pending_registration: {
    RU: '⏳ Ваша заявка уже ожидает рассмотрения администратором.',
    UZ: '⏳ Arizangiz allaqachon administrator tomonidan ko\'rib chiqilmoqda.',
    TJ: '⏳ Дархости шумо аллакай аз ҷониби мудир дида истодааст.',
  },
};

function getMsg(key: string, lang: string, vars: Record<string, unknown> = {}): string {
  const l = ['RU', 'UZ', 'TJ'].includes(lang) ? lang : 'RU';
  let tmpl = MSGS[key]?.[l] || MSGS[key]?.['RU'] || '';
  for (const [k, v] of Object.entries(vars)) tmpl = tmpl.replace(`{${k}}`, String(v));
  return tmpl;
}

function mainMenuKb(lang: string, isRegistered = true) {
  const labels = (
    lang === 'UZ' ? ["🗺 Shkafchalar xaritasi", '📷 QR skanerlash', '👤 Shaxsiy kabinet', "📝 Ro'yxatdan o'tish"] :
    lang === 'TJ' ? ['🗺 Харитаи қуттиҳо', '📷 Сканерзии QR', '👤 Кабинети шахсӣ', '📝 Сабти ном'] :
    ['🗺 Карта шкафчиков', '📷 Сканировать QR', '👤 Личный кабинет', '📝 Регистрация']
  );
  const rows = isRegistered
    ? [[btn(labels[0], 'menu:map')], [btn(labels[1], 'menu:scan_qr')], [btn(labels[2], 'menu:cabinet')]]
    : [[btn(labels[3], 'register:start')], [btn(labels[0], 'menu:map')], [btn(labels[1], 'menu:scan_qr')], [btn(labels[2], 'menu:cabinet')]];
  return inlineKeyboard(rows);
}

function langKb() { return inlineKeyboard([[btn('🇷🇺 Русский', 'lang:RU'), btn("🇺🇿 O'zbek", 'lang:UZ'), btn('🇹🇯 Тоҷикӣ', 'lang:TJ')]]); }
function sessionKb(lang: string, sessionId: string) { const label = lang === 'UZ' ? '🔒 Yakunlash' : lang === 'TJ' ? '🔒 Хотима додан' : '🔒 Завершить аренду'; return inlineKeyboard([[btn(label, `session:end:${sessionId}`)]]); }
function cabinetKb(lang: string) { const l = lang === 'UZ' ? ['📋 Mening sessiyalarim', '💳 Mening kartalarim', '🔔 Obuna', '⬅️ Orqaga'] : lang === 'TJ' ? ['📋 Сессияҳои ман', '💳 Картаҳои ман', '🔔 Обуна', '⬅️ Бозгашт'] : ['📋 Мои сессии', '💳 Мои карты', '🔔 Подписка', '⬅️ Назад']; return inlineKeyboard([[btn(l[0], 'cabinet:sessions'), btn(l[1], 'cabinet:cards')], [btn(l[2], 'cabinet:subscription')], [btn(l[3], 'menu:main')]]); }
function queueJoinKb(lang: string, lockerId: string) { const [yes, no] = lang === 'UZ' ? ["✅ Ha, qo'shish", "❌ Yo'q"] : lang === 'TJ' ? ['✅ Бале, илова кун', '❌ Не'] : ['✅ Да, встать', '❌ Нет']; return inlineKeyboard([[btn(yes, `queue:confirm:${lockerId}`), btn(no, 'menu:main')]]); }
function debtKb(lang: string) { const label = lang === 'UZ' ? "💳 Qarzni to'lash" : lang === 'TJ' ? '💳 Пардохти қарз' : '💳 Погасить долг'; return inlineKeyboard([[btn(label, 'debt:pay')]]); }
function confirmBookingKb(lang: string, cellId: string) { const [yes, no] = lang === 'UZ' ? ['✅ Tasdiqlash', '❌ Bekor qilish'] : lang === 'TJ' ? ['✅ Тасдиқ кардан', '❌ Бекор кардан'] : ['✅ Подтвердить', '❌ Отмена']; return inlineKeyboard([[btn(yes, `book:confirm:${cellId}`), btn(no, 'book:cancel')]]); }
function lockerKb(lang: string, lockerId: string, hasFreeCells: boolean) { if (hasFreeCells) { const label = lang === 'UZ' ? '📋 Bron qilish' : lang === 'TJ' ? '📋 Бронировон кардан' : '📋 Забронировать'; return inlineKeyboard([[btn(label, `book:locker:${lockerId}`)]]); } else { const label = lang === 'UZ' ? '⏳ Navbatga turish' : lang === 'TJ' ? '⏳ Ба навбат гузоштан' : '⏳ Встать в очередь'; return inlineKeyboard([[btn(label, `queue:join:${lockerId}`)]]); } }

/** Returns true when the user has completed or submitted courier registration */
function isCourierRegistered(user: DbUser): boolean {
  return user.is_verified || user.registration_status === 'PENDING_REGISTRATION';
}

async function getOrCreateUser(maxId: string): Promise<DbUser> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('max_id', maxId)
    .maybeSingle<DbUser>();
  if (existing) return existing;

  const { data: created } = await supabase
    .from('users')
    .insert({ max_id: maxId, language: 'RU' })
    .select()
    .single<DbUser>();
  if (!created) throw new Error('Failed to create user');
  return created;
}

async function handleBotStarted(update: Record<string, unknown>) {
  const chatId = String(update.chat_id || '');
  const userObj = (update.user || {}) as Record<string, unknown>;
  const maxId = String(userObj.user_id || '');
  if (!maxId || !chatId) return;

  const user = await getOrCreateUser(maxId);
  const lang = user.language;
  const log: LogCtx = { userId: user.id, maxId };
  await sendMessage(chatId, getMsg('welcome', lang, { maxId }), langKb(), log);
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
  const log: LogCtx = { userId: user.id, maxId };

  // Log incoming message for debug panel
  if (text) {
    void supabase.from('max_messages').insert({
      user_id: user.id,
      max_id: maxId,
      direction: 'IN' as const,
      text: text.slice(0, 1000),
    });
  }

  // Handle onboarding conversation states
  if (user.bot_state === 'ONBOARDING_NAME') {
    if (text.trim().length < 2) {
      await sendMessage(chatId, getMsg('onboarding_name_too_short', lang), undefined, log);
      return;
    }
    await supabase.from('users').update({ name: text.trim(), bot_state: 'ONBOARDING_PHONE' }).eq('id', user.id);
    await sendMessage(chatId, getMsg('onboarding_ask_phone', lang), undefined, log);
    return;
  }

  if (user.bot_state === 'ONBOARDING_PHONE') {
    const phoneRegex = /^\+\d{7,15}$/;
    if (!phoneRegex.test(text.trim())) {
      await sendMessage(chatId, getMsg('onboarding_phone_invalid', lang), undefined, log);
      return;
    }
    await supabase.from('users').update({
      phone: text.trim(),
      bot_state: null,
      registration_status: 'PENDING_REGISTRATION',
    }).eq('id', user.id);
    await sendMessage(chatId, getMsg('onboarding_done', lang), mainMenuKb(lang, false), log);
    return;
  }
  if (text.toLowerCase() === '/start' || text.toLowerCase() === 'start') {
    const isRegistered = isCourierRegistered(user);
    await sendMessage(chatId, getMsg('welcome', lang, { maxId }), langKb(), log);
    if (!isRegistered) {
      await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang, false), log);
    }
    return;
  }
  if (text.toLowerCase() === '/menu') {
    const isRegistered = isCourierRegistered(user);
    await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang, isRegistered), log);
    return;
  }
  if (text.length > 6 && !text.startsWith('/')) {
    const { data: locker } = await supabase
      .from('lockers')
      .select('*, cells(*)')
      .eq('qr_code', text)
      .maybeSingle();
    if (locker) {
      const cells: { status: string }[] = locker.cells ?? [];
      const freeCells = cells.filter((c) => c.status === 'FREE');
      const { data: tariffs } = await supabase
        .from('tariffs')
        .select('*')
        .eq('is_subscription', false);
      const currency = (({ RU: 'руб/мин', UZ: "so'm/daq", TJ: 'сомонӣ/дақ' }) as Record<string, string>)[lang] || 'руб/мин';
      const tariffLines = (tariffs ?? []).map((t) => `  • ${t.name}: ${t.price_per_minute} ${currency}`).join('\n');
      if (freeCells.length === 0) {
        await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, locker.id), log);
      } else {
        const infoText = `🔋 Шкафчик: ${locker.name}\n📍 Адрес: ${locker.address}\n🟢 Свободных ячеек: ${freeCells.length}\n\n💰 Тарифы:\n${tariffLines || '—'}`;
        await sendMessage(chatId, infoText, lockerKb(lang, locker.id, true), log);
      }
      return;
    }
  }
  const isRegistered = isCourierRegistered(user);
  await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang, isRegistered), log);
}

async function handleCallback(update: Record<string, unknown>) {
  const cb = (update.callback || {}) as Record<string, unknown>;
  const callbackId = String(cb.callback_id || '');
  const payload = String(cb.payload || '');
  const sender = (cb.user || {}) as Record<string, unknown>;
  const maxId = String(sender.user_id || '');
  const chatId = String(
    ((cb.message as Record<string, unknown>)?.recipient as Record<string, unknown>)?.chat_id || maxId,
  );

  if (!maxId) return;
  const user = await getOrCreateUser(maxId);
  const lang = user.language;
  const log: LogCtx = { userId: user.id, maxId };
  const parts = payload.split(':');

  try {
    if (parts[0] === 'lang') {
      const newLang = parts[1];
      if (['RU', 'UZ', 'TJ'].includes(newLang)) {
        await supabase.from('users').update({ language: newLang }).eq('id', user.id);
        const isRegistered = isCourierRegistered(user);
        await answerCallback(callbackId, getMsg('main_menu', newLang));
        await sendMessage(chatId, getMsg('main_menu', newLang), mainMenuKb(newLang, isRegistered), log);
      }
    } else if (parts[0] === 'register') {
      if (parts[1] === 'start') {
        if (user.is_verified) {
          await answerCallback(callbackId, getMsg('already_registered', lang));
          await sendMessage(chatId, getMsg('already_registered', lang), undefined, log);
          return;
        }
        if (user.registration_status === 'PENDING_REGISTRATION' && !user.bot_state) {
          await answerCallback(callbackId, getMsg('pending_registration', lang));
          await sendMessage(chatId, getMsg('pending_registration', lang), mainMenuKb(lang, true), log);
          return;
        }
        await supabase.from('users').update({ bot_state: 'ONBOARDING_NAME' }).eq('id', user.id);
        await answerCallback(callbackId, '📝');
        await sendMessage(chatId, getMsg('onboarding_ask_name', lang), undefined, log);
      }
    } else if (parts[0] === 'menu') {
      const action = parts[1];
      const isRegistered = isCourierRegistered(user);
      if (action === 'main') await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang, isRegistered), log);
      else if (action === 'scan_qr') await sendMessage(chatId, getMsg('scan_qr', lang), undefined, log);
      else if (action === 'map') {
        const { data: lockers } = await supabase.from('lockers').select('name, address').eq('is_active', true);
        const lines = (lockers ?? []).map((l) => `📍 ${l.name} — ${l.address}`).join('\n');
        await sendMessage(chatId, lines ? `🗺 Шкафчики:\n${lines}` : 'Нет активных шкафчиков', undefined, log);
      } else if (action === 'cabinet') {
        const [{ count: totalSessions }, { count: activeSessions }] = await Promise.all([
          supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('end_at', null),
        ]);
        const cabinetText = `👤 Личный кабинет\n\n📊 Статистика:\n💳 Долг: ${Number(user.debt_amount).toFixed(2)}\n✅ Сессий всего: ${totalSessions ?? 0}\n🔋 Активных аренд: ${activeSessions ?? 0}`;
        await sendMessage(chatId, cabinetText, cabinetKb(lang), log);
      }
    } else if (parts[0] === 'cabinet') {
      const action = parts[1];
      if (action === 'sessions') {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (sessions && sessions.length > 0) {
          const lines = sessions.map((s) => {
            const dur = s.duration_mins != null ? Number(s.duration_mins).toFixed(1) : '—';
            const cost = s.cost != null ? Number(s.cost).toFixed(2) : '0.00';
            return `📅 ${new Date(s.start_at).toLocaleDateString()} | ⏱${dur}мин | 💰${cost}`;
          });
          await sendMessage(chatId, '📋 Ваши сессии:\n' + lines.join('\n'), undefined, log);
        } else await sendMessage(chatId, 'Нет сессий', undefined, log);
      } else if (action === 'cards') {
        const { data: cards } = await supabase
          .from('payment_cards')
          .select('last_four')
          .eq('user_id', user.id)
          .eq('is_active', true);
        if (cards && cards.length > 0)
          await sendMessage(chatId, 'Ваши карты:\n' + cards.map((c) => `💳 **** ${c.last_four}`).join('\n'), undefined, log);
        else await sendMessage(chatId, 'Карты не привязаны', undefined, log);
      } else if (action === 'subscription') {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('end_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (sub) await sendMessage(chatId, `✅ Подписка активна до ${new Date(sub.end_at).toLocaleDateString()}`, undefined, log);
        else await sendMessage(chatId, '❌ Нет активной подписки', undefined, log);
      }
    } else if (parts[0] === 'book' && parts[1] === 'locker') {
      const lockerId = parts[2];
      if (user.has_debt) {
        await sendMessage(chatId, getMsg('has_debt', lang, { amount: Number(user.debt_amount).toFixed(2) }), debtKb(lang), log);
        return;
      }
      if (!user.is_verified) { await sendMessage(chatId, getMsg('not_verified', lang), undefined, log); return; }
      const [{ count: activeBookings }, { count: activeSessions }] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'ACTIVE'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('end_at', null),
      ]);
      if ((activeBookings ?? 0) >= 1) { await sendMessage(chatId, getMsg('max_bookings', lang), undefined, log); return; }
      if ((activeSessions ?? 0) >= 2) { await sendMessage(chatId, getMsg('max_sessions', lang), undefined, log); return; }
      const [{ data: cell }, { data: locker }, { data: sub }] = await Promise.all([
        supabase.from('cells').select('id, number').eq('locker_id', lockerId).eq('status', 'FREE').maybeSingle(),
        supabase.from('lockers').select('name').eq('id', lockerId).maybeSingle(),
        supabase.from('subscriptions').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      ]);
      if (!cell) { await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, lockerId), log); return; }
      const freeMins = sub ? BOOKING_FREE_MINS_SUBSCRIBED : BOOKING_FREE_MINS;
      await sendMessage(chatId, `📋 Подтвердить бронирование?\n🔋 Ячейка #${cell.number} в ${locker?.name || '—'}\n⏱ Бесплатно: ${freeMins} мин`, confirmBookingKb(lang, cell.id), log);
    } else if (parts[0] === 'book' && parts[1] === 'confirm') {
      const cellId = parts[2];
      const svc = new BookingService(supabase);
      try {
        const booking = await svc.createBooking(user.id, cellId);
        const { data: cell } = await supabase
          .from('cells')
          .select('number, lockers(name)')
          .eq('id', cellId)
          .maybeSingle();
        await answerCallback(callbackId, '✅');
        await sendMessage(
          chatId,
          `✅ Бронирование создано!\n⏰ Действует до: ${new Date(booking.ends_at).toLocaleTimeString()}\nЯчейка #${cell?.number || '?'}`,
          sessionKb(lang, 'pending'),
          log,
        );
      } catch (e) { await sendMessage(chatId, String(e), undefined, log); }
    } else if (parts[0] === 'book' && parts[1] === 'cancel') {
      const isRegistered = isCourierRegistered(user);
      await sendMessage(chatId, getMsg('main_menu', lang), mainMenuKb(lang, isRegistered), log);
    } else if (parts[0] === 'session' && parts[1] === 'end') {
      const sessionId = parts[2];
      if (sessionId === 'pending') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('cell_id, id')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .maybeSingle();
        if (booking) {
          const svc = new SessionService(supabase);
          const session = await svc.startSession(user.id, booking.cell_id, booking.id);
          await answerCallback(callbackId, `🔓 Сессия началась в ${new Date(session.start_at).toLocaleTimeString()}`);
          await sendMessage(
            chatId,
            `🔓 Ячейка открыта! Сессия началась.\n⏱ Начало: ${new Date(session.start_at).toLocaleTimeString()}`,
            sessionKb(lang, session.id),
            log,
          );
        }
        return;
      }
      const svc = new SessionService(supabase);
      try {
        const ended = await svc.endSession(sessionId, true, true);
        await answerCallback(callbackId, '✅');
        await sendMessage(
          chatId,
          `✅ Сессия завершена!\n⏱ Длительность: ${Number(ended.duration_mins ?? 0).toFixed(1)} мин\n💰 Стоимость: ${Number(ended.cost ?? 0).toFixed(2)} руб`,
          undefined,
          log,
        );
      } catch (e) { await sendMessage(chatId, String(e), undefined, log); }
    } else if (parts[0] === 'queue') {
      const action = parts[1];
      const lockerId = parts[2];
      if (action === 'join') await sendMessage(chatId, getMsg('no_free_cells', lang), queueJoinKb(lang, lockerId), log);
      else if (action === 'confirm') {
        const svc = new QueueService(supabase);
        const entry = await svc.joinQueue(user.id, lockerId);
        await answerCallback(callbackId, '✅');
        await sendMessage(chatId, getMsg('queue_joined', lang, { position: entry.position }), undefined, log);
      }
    } else if (parts[0] === 'debt' && parts[1] === 'pay') {
      const svc = new PaymentService(supabase);
      const result = await svc.processDebt(user.id);
      await sendMessage(chatId, result ? getMsg('debt_cleared', lang) : getMsg('error_generic', lang), undefined, log);
    }
  } catch (e) {
    console.error('Callback handler error:', e);
    await sendMessage(chatId, getMsg('error_generic', lang), undefined, log);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updateType = body.update_type || '';
    if (updateType === 'message_created') await handleMessage(body);
    else if (updateType === 'message_callback') await handleCallback(body);
    else if (updateType === 'bot_started') await handleBotStarted(body);
  } catch (e) {
    console.error('Webhook handler error:', e);
  }
  return NextResponse.json({ ok: true });
}


import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from app.db import get_db
from app.config import MAX_BOT_TOKEN, MAX_API_BASE, CORS_ORIGINS
from app.bot.messages import get_msg
from app.bot.keyboards import (
    language_keyboard, main_menu_keyboard, locker_keyboard,
    confirm_booking_keyboard, session_keyboard, cabinet_keyboard,
    queue_join_keyboard, debt_keyboard,
)
from app.services.booking import BookingService
from app.services.session import SessionService
from app.services.queue import QueueService
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()


async def send_message(chat_id: str, text: str, keyboard: dict | None = None) -> None:
    payload: dict = {"recipient": {"chat_id": chat_id}, "body": {"type": "text", "text": text}}
    if keyboard:
        payload["body"]["attachments"] = [keyboard]
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{MAX_API_BASE}/messages",
                params={"access_token": MAX_BOT_TOKEN},
                json=payload,
                timeout=10,
            )
        except Exception as e:
            logger.error(f"Failed to send MAX message: {e}")


async def answer_callback(callback_id: str, text: str) -> None:
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{MAX_API_BASE}/answers",
                params={"access_token": MAX_BOT_TOKEN},
                json={"callback_id": callback_id, "message": {"text": text}},
                timeout=10,
            )
        except Exception as e:
            logger.error(f"Failed to answer callback: {e}")


async def get_or_create_user(max_id: str, db) -> "User":
    user = await db.user.find_unique(where={"maxId": max_id})
    if not user:
        user = await db.user.create(data={"maxId": max_id, "language": "RU"})
    return user


async def handle_message(update: dict, db) -> None:
    msg = update.get("message", {})
    sender = msg.get("sender", {})
    max_id = str(sender.get("user_id", ""))
    chat_id = str(msg.get("recipient", {}).get("chat_id", max_id))
    body = msg.get("body", {})
    text = body.get("text", "").strip()

    if not max_id:
        return

    user = await get_or_create_user(max_id, db)
    lang = user.language

    if text.lower() in ("/start", "start"):
        await send_message(chat_id, get_msg("welcome", lang), language_keyboard())
        return

    if text.lower() == "/menu":
        await send_message(chat_id, get_msg("main_menu", lang), main_menu_keyboard(lang))
        return

    # QR code input (plain text that looks like a UUID/code)
    if len(text) > 6 and not text.startswith("/"):
        locker = await db.locker.find_unique(
            where={"qrCode": text},
            include={"cells": True},
        )
        if locker:
            await handle_locker_info(chat_id, user, locker, db)
            return

    await send_message(chat_id, get_msg("main_menu", lang), main_menu_keyboard(lang))


async def handle_locker_info(chat_id: str, user, locker, db) -> None:
    lang = user.language
    free_cells = [c for c in locker.cells if c.status == "FREE"]
    free_count = len(free_cells)

    tariffs = await db.tariff.find_many(where={"isSubscription": False})
    currency = {"RU": "руб/мин", "UZ": "so'm/daq", "TJ": "сомонӣ/дақ"}.get(lang, "руб/мин")
    tariff_lines = "\n".join(
        f"  • {t.name}: {t.pricePerMinute} {currency}"
        for t in tariffs
    )

    text = get_msg("locker_info", lang,
                   name=locker.name,
                   address=locker.address,
                   free_count=free_count,
                   tariffs=tariff_lines or "—")

    if free_count == 0:
        text = get_msg("no_free_cells", lang)
        await send_message(chat_id, text, queue_join_keyboard(lang, locker.id))
    else:
        await send_message(chat_id, text, locker_keyboard(lang, locker.id, True))


async def handle_callback(update: dict, db) -> None:
    cb = update.get("callback", {})
    callback_id = cb.get("callback_id", "")
    payload = cb.get("payload", "")
    sender = cb.get("user", {})
    max_id = str(sender.get("user_id", ""))
    chat_id = str(cb.get("message", {}).get("recipient", {}).get("chat_id", max_id))

    if not max_id:
        return

    user = await get_or_create_user(max_id, db)
    lang = user.language

    parts = payload.split(":")

    try:
        if parts[0] == "lang":
            new_lang = parts[1]
            if new_lang in ("RU", "UZ", "TJ"):
                await db.user.update(where={"id": user.id}, data={"language": new_lang})
                await answer_callback(callback_id, get_msg("language_set", new_lang))
                await send_message(chat_id, get_msg("main_menu", new_lang), main_menu_keyboard(new_lang))

        elif parts[0] == "menu":
            action = parts[1]
            if action == "main":
                await send_message(chat_id, get_msg("main_menu", lang), main_menu_keyboard(lang))
            elif action == "scan_qr":
                await send_message(chat_id, get_msg("scan_qr", lang))
            elif action == "map":
                lockers = await db.locker.find_many(where={"isActive": True})
                lines = "\n".join(f"📍 {l.name} — {l.address}" for l in lockers)
                await send_message(chat_id, f"🗺 Шкафчики:\n{lines}" if lines else "Нет активных шкафчиков")
            elif action == "cabinet":
                await handle_cabinet(chat_id, user, db)

        elif parts[0] == "cabinet":
            action = parts[1]
            if action == "sessions":
                sessions = await db.session.find_many(
                    where={"userId": user.id},
                    order={"createdAt": "desc"},
                    take=10,
                )
                if sessions:
                    lines = []
                    for s in sessions:
                        dur = f"{s.durationMins:.1f}" if s.durationMins else "—"
                        cost = f"{s.cost:.2f}" if s.cost else "0.00"
                        lines.append(f"📅 {s.startAt.strftime('%d.%m %H:%M')} | ⏱{dur}мин | 💰{cost}")
                    await send_message(chat_id, "📋 Ваши сессии:\n" + "\n".join(lines))
                else:
                    await send_message(chat_id, "Нет сессий")
            elif action == "cards":
                cards = await db.paymentcard.find_many(where={"userId": user.id, "isActive": True})
                if cards:
                    lines = [f"💳 **** {c.lastFour}" for c in cards]
                    await send_message(chat_id, "Ваши карты:\n" + "\n".join(lines))
                else:
                    await send_message(chat_id, "Карты не привязаны")
            elif action == "subscription":
                sub = await db.subscription.find_first(where={"userId": user.id, "isActive": True})
                if sub:
                    await send_message(chat_id, f"✅ Подписка активна до {sub.endAt.strftime('%d.%m.%Y')}")
                else:
                    await send_message(chat_id, "❌ Нет активной подписки")

        elif parts[0] == "book" and parts[1] == "locker":
            locker_id = parts[2]
            if user.hasDebt:
                await send_message(chat_id, get_msg("has_debt", lang, amount=f"{user.debtAmount:.2f}"), debt_keyboard(lang))
                return
            if not user.isVerified:
                await send_message(chat_id, get_msg("not_verified", lang))
                return
            active_bookings = await db.booking.count(where={"userId": user.id, "status": "ACTIVE"})
            if active_bookings >= 1:
                await send_message(chat_id, get_msg("max_bookings", lang))
                return
            active_sessions = await db.session.count(where={"userId": user.id, "endAt": None})
            if active_sessions >= 2:
                await send_message(chat_id, get_msg("max_sessions", lang))
                return
            # Find first free cell
            cell = await db.cell.find_first(where={"lockerId": locker_id, "status": "FREE"})
            if not cell:
                locker = await db.locker.find_unique(where={"id": locker_id})
                await send_message(chat_id, get_msg("no_free_cells", lang), queue_join_keyboard(lang, locker_id))
                return
            locker = await db.locker.find_unique(where={"id": locker_id})
            sub = await db.subscription.find_first(where={"userId": user.id, "isActive": True})
            from app.config import BOOKING_FREE_MINS, BOOKING_FREE_MINS_SUBSCRIBED
            free_mins = BOOKING_FREE_MINS_SUBSCRIBED if sub else BOOKING_FREE_MINS
            await send_message(
                chat_id,
                get_msg("confirm_booking", lang,
                        cell_num=cell.number,
                        locker_name=locker.name if locker else "—",
                        free_mins=free_mins),
                confirm_booking_keyboard(lang, cell.id),
            )

        elif parts[0] == "book" and parts[1] == "confirm":
            cell_id = parts[2]
            svc = BookingService(db)
            try:
                booking = await svc.create_booking(user.id, cell_id)
                cell = await db.cell.find_unique(where={"id": cell_id}, include={"locker": True})
                await answer_callback(callback_id, "✅")
                await send_message(
                    chat_id,
                    get_msg("booking_created", lang,
                            ends_at=booking.endsAt.strftime("%H:%M"),
                            cell_num=cell.number if cell else "?"),
                    session_keyboard(lang, "pending"),
                )
            except ValueError as e:
                await send_message(chat_id, str(e))

        elif parts[0] == "book" and parts[1] == "cancel":
            await send_message(chat_id, get_msg("main_menu", lang), main_menu_keyboard(lang))

        elif parts[0] == "session" and parts[1] == "end":
            session_id = parts[2]
            if session_id == "pending":
                booking = await db.booking.find_first(where={"userId": user.id, "status": "ACTIVE"})
                if booking:
                    svc = SessionService(db)
                    session = await svc.start_session(user.id, booking.cellId, booking.id)
                    await answer_callback(callback_id, get_msg("session_started", lang, start_at=session.startAt.strftime("%H:%M")))
                    await send_message(chat_id, get_msg("session_started", lang, start_at=session.startAt.strftime("%H:%M")), session_keyboard(lang, session.id))
                return
            # End existing session
            svc = SessionService(db)
            try:
                ended = await svc.end_session(session_id, door_closed=True, charger_disconnected=True)
                await answer_callback(callback_id, "✅")
                await send_message(
                    chat_id,
                    get_msg("session_ended", lang,
                            duration=f"{ended.durationMins:.1f}" if ended.durationMins else "0",
                            cost=f"{ended.cost:.2f}" if ended.cost else "0.00"),
                )
            except ValueError as e:
                await send_message(chat_id, str(e))

        elif parts[0] == "queue":
            action = parts[1]
            locker_id = parts[2]
            if action == "join":
                locker = await db.locker.find_unique(where={"id": locker_id})
                await send_message(chat_id, get_msg("no_free_cells", lang), queue_join_keyboard(lang, locker_id))
            elif action == "confirm":
                svc = QueueService(db)
                entry = await svc.join_queue(user.id, locker_id)
                await answer_callback(callback_id, "✅")
                await send_message(chat_id, get_msg("queue_joined", lang, position=entry.position))

        elif parts[0] == "debt" and parts[1] == "pay":
            from app.services.payment import PaymentService
            svc = PaymentService(db)
            result = await svc.process_debt(user.id)
            if result:
                await send_message(chat_id, get_msg("debt_cleared", lang))
            else:
                await send_message(chat_id, get_msg("error_generic", lang))

    except Exception as e:
        logger.error(f"Callback handler error: {e}", exc_info=True)
        await send_message(chat_id, get_msg("error_generic", lang))


async def handle_cabinet(chat_id: str, user, db) -> None:
    lang = user.language
    total_sessions = await db.session.count(where={"userId": user.id})
    active_sessions = await db.session.count(where={"userId": user.id, "endAt": None})
    text = get_msg("cabinet", lang,
                   debt=f"{user.debtAmount:.2f}",
                   total_sessions=total_sessions,
                   active_sessions=active_sessions)
    await send_message(chat_id, text, cabinet_keyboard(lang))


@router.post("/bot/webhook")
async def bot_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    db = await get_db()
    update_type = body.get("update_type", "")

    try:
        if update_type == "message_created":
            await handle_message(body, db)
        elif update_type == "message_callback":
            await handle_callback(body, db)
    except Exception as e:
        logger.error(f"Webhook handler error: {e}", exc_info=True)

    return {"ok": True}

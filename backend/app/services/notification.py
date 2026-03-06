import logging
from app.bot.handlers import send_message
from app.bot.messages import get_msg

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db):
        self.db = db

    async def _get_user_chat(self, user_id: str):
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user:
            return None, None
        return user.maxId, user.language

    async def _record(self, user_id: str, notif_type: str, message: str) -> None:
        await self.db.notification.create(data={
            "userId": user_id,
            "type": notif_type,
            "message": message,
        })

    async def send_open_door_reminder(self, user_id: str, minutes: int) -> None:
        chat_id, lang = await self._get_user_chat(user_id)
        if not chat_id:
            return
        msg = get_msg("open_door_reminder", lang, minutes=minutes)
        await send_message(chat_id, msg)
        await self._record(user_id, "open_door_reminder", msg)

    async def send_rental_reminder(self, user_id: str) -> None:
        chat_id, lang = await self._get_user_chat(user_id)
        if not chat_id:
            return
        msg = get_msg("rental_reminder", lang)
        await send_message(chat_id, msg)
        await self._record(user_id, "rental_reminder", msg)

    async def send_bms_charged(self, user_id: str, cell_id: str) -> None:
        chat_id, lang = await self._get_user_chat(user_id)
        if not chat_id:
            return
        cell = await self.db.cell.find_unique(where={"id": cell_id})
        cell_num = cell.number if cell else "?"
        msg = get_msg("bms_charged", lang, cell_num=cell_num)
        await send_message(chat_id, msg)
        await self._record(user_id, "bms_charged", msg)

    async def send_queue_turn(self, user_id: str, locker_id: str) -> None:
        chat_id, lang = await self._get_user_chat(user_id)
        if not chat_id:
            return
        locker = await self.db.locker.find_unique(where={"id": locker_id})
        locker_name = locker.name if locker else "?"
        msg = get_msg("queue_turn", lang, locker_name=locker_name)
        await send_message(chat_id, msg)
        await self._record(user_id, "queue_turn", msg)

    async def notify_admin_anomaly(self, session_id: str) -> None:
        session = await self.db.session.find_unique(where={"id": session_id})
        if not session:
            return
        msg = f"⚠️ Anomaly: session {session_id}, user {session.userId}, started {session.startAt}"
        logger.warning(msg)
        # Could also send to admin Telegram/MAX channel

from datetime import datetime, timedelta, timezone
from app.services.notification import NotificationService
from app.config import BOOKING_FREE_MINS_SUBSCRIBED


class QueueService:
    def __init__(self, db):
        self.db = db

    async def join_queue(self, user_id: str, locker_id: str):
        existing = await self.db.waitqueue.find_first(
            where={"userId": user_id, "lockerId": locker_id}
        )
        if existing:
            return existing

        count = await self.db.waitqueue.count(where={"lockerId": locker_id})
        position = count + 1

        entry = await self.db.waitqueue.create(data={
            "userId": user_id,
            "lockerId": locker_id,
            "position": position,
        })
        return entry

    async def leave_queue(self, user_id: str, locker_id: str) -> None:
        entry = await self.db.waitqueue.find_first(
            where={"userId": user_id, "lockerId": locker_id}
        )
        if entry:
            await self.db.waitqueue.delete(where={"id": entry.id})
            # Reorder remaining
            remaining = await self.db.waitqueue.find_many(
                where={"lockerId": locker_id},
                order={"createdAt": "asc"},
            )
            for i, r in enumerate(remaining, start=1):
                await self.db.waitqueue.update(
                    where={"id": r.id},
                    data={"position": i},
                )

    async def notify_next(self, locker_id: str) -> None:
        next_entry = await self.db.waitqueue.find_first(
            where={"lockerId": locker_id},
            order={"position": "asc"},
        )
        if not next_entry:
            return

        notif_svc = NotificationService(self.db)
        await notif_svc.send_queue_turn(next_entry.userId, locker_id)

        # Give free booking for 10 minutes
        cell = await self.db.cell.find_first(
            where={"lockerId": locker_id, "status": "FREE"}
        )
        if cell:
            now = datetime.now(timezone.utc)
            ends_at = now + timedelta(minutes=BOOKING_FREE_MINS_SUBSCRIBED)
            await self.db.booking.create(data={
                "userId": next_entry.userId,
                "cellId": cell.id,
                "status": "ACTIVE",
                "isFree": True,
                "endsAt": ends_at,
            })
            await self.db.cell.update(where={"id": cell.id}, data={"status": "BUSY"})

        # Remove from queue
        await self.db.waitqueue.delete(where={"id": next_entry.id})
        # Reorder
        remaining = await self.db.waitqueue.find_many(
            where={"lockerId": locker_id},
            order={"createdAt": "asc"},
        )
        for i, r in enumerate(remaining, start=1):
            await self.db.waitqueue.update(where={"id": r.id}, data={"position": i})

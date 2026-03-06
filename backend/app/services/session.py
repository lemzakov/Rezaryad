from datetime import datetime, timedelta, timezone
from app.config import DOOR_OPEN_FRAUD_SECONDS
import logging

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self, db):
        self.db = db

    async def start_session(self, user_id: str, cell_id: str, booking_id: str | None = None):
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError("User not found")
        if user.hasDebt:
            raise ValueError(f"User has debt: {user.debtAmount}")

        active_sessions = await self.db.session.count(
            where={"userId": user_id, "endAt": None}
        )
        if active_sessions >= 2:
            raise ValueError("Max active sessions reached")

        cell = await self.db.cell.find_unique(where={"id": cell_id})
        if not cell:
            raise ValueError("Cell not found")

        if booking_id:
            booking = await self.db.booking.find_unique(where={"id": booking_id})
            if booking and booking.status == "ACTIVE":
                await self.db.booking.update(
                    where={"id": booking_id},
                    data={"status": "CONVERTED"},
                )

        now = datetime.now(timezone.utc)
        session = await self.db.session.create(data={
            "userId": user_id,
            "cellId": cell_id,
            "bookingId": booking_id,
            "startAt": now,
        })
        await self.db.cell.update(where={"id": cell_id}, data={"status": "BUSY"})
        return session

    async def end_session(self, session_id: str, door_closed: bool, charger_disconnected: bool):
        if not door_closed:
            raise ValueError("Door must be closed before ending session")
        if not charger_disconnected:
            raise ValueError("Charger must be disconnected before ending session")

        session = await self.db.session.find_unique(
            where={"id": session_id},
            include={"cell": {"include": {"locker": True}}},
        )
        if not session:
            raise ValueError("Session not found")
        if session.endAt is not None:
            raise ValueError("Session already ended")

        now = datetime.now(timezone.utc)
        duration_mins = (now - session.startAt).total_seconds() / 60

        # Get applicable tariff
        tariff = await self._get_tariff(session.userId, now)
        cost = self.calculate_cost(session.startAt, now, tariff)

        ended = await self.db.session.update(
            where={"id": session_id},
            data={
                "endAt": now,
                "durationMins": duration_mins,
                "cost": cost,
            },
        )

        await self.db.cell.update(where={"id": session.cellId}, data={"status": "FREE"})

        # Process payment
        if cost > 0:
            from app.services.payment import PaymentService
            payment_svc = PaymentService(self.db)
            await payment_svc.charge(session.userId, cost, session_id)

        return ended

    async def _get_tariff(self, user_id: str, now: datetime):
        sub = await self.db.subscription.find_first(
            where={"userId": user_id, "isActive": True, "endAt": {"gt": now}}
        )
        if sub:
            tariff = await self.db.tariff.find_unique(where={"id": sub.tariffId})
            if tariff:
                return tariff

        hour = now.hour
        is_night = hour >= 22 or hour < 6
        tariff = await self.db.tariff.find_first(
            where={"isSubscription": False, "isNight": is_night}
        )
        if not tariff:
            tariff = await self.db.tariff.find_first(where={"isSubscription": False})
        return tariff

    def calculate_cost(self, start: datetime, end: datetime, tariff) -> float:
        if tariff is None:
            return 0.0
        duration_mins = (end - start).total_seconds() / 60
        free_mins = tariff.freeMins if tariff.freeMins else 0
        billable_mins = max(0, duration_mins - free_mins)
        cost = billable_mins * tariff.pricePerMinute
        if tariff.discountPct and tariff.discountPct > 0:
            cost = cost * (1 - tariff.discountPct / 100)
        return round(cost, 2)

    async def force_cancel_session(self, session_id: str):
        """Anti-fraud: door held open too long."""
        session = await self.db.session.find_unique(where={"id": session_id})
        if not session or session.endAt is not None:
            return

        now = datetime.now(timezone.utc)
        elapsed = (now - session.startAt).total_seconds()
        if elapsed < DOOR_OPEN_FRAUD_SECONDS:
            return

        duration_mins = elapsed / 60
        tariff = await self._get_tariff(session.userId, now)
        cost = self.calculate_cost(session.startAt, now, tariff)

        await self.db.session.update(
            where={"id": session_id},
            data={"endAt": now, "durationMins": duration_mins, "cost": cost},
        )
        await self.db.cell.update(where={"id": session.cellId}, data={"status": "FREE"})

        if cost > 0:
            from app.services.payment import PaymentService
            payment_svc = PaymentService(self.db)
            await payment_svc.charge(session.userId, cost, session_id)

        logger.warning(f"Force-cancelled session {session_id} after {elapsed:.0f}s")

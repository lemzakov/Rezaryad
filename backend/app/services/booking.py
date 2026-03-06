from datetime import datetime, timedelta, timezone
from app.config import (
    BOOKING_FREE_MINS, BOOKING_FREE_MINS_SUBSCRIBED,
    PENALTY_HOURS, MAX_ACTIVE_BOOKINGS, MAX_ACTIVE_SESSIONS,
)


class BookingService:
    def __init__(self, db):
        self.db = db

    async def create_booking(self, user_id: str, cell_id: str):
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError("User not found")
        if user.hasDebt:
            raise ValueError(f"User has debt: {user.debtAmount}")

        active_bookings = await self.db.booking.count(
            where={"userId": user_id, "status": "ACTIVE"}
        )
        if active_bookings >= MAX_ACTIVE_BOOKINGS:
            raise ValueError("Max active bookings reached")

        active_sessions = await self.db.session.count(
            where={"userId": user_id, "endAt": None}
        )
        if active_sessions >= MAX_ACTIVE_SESSIONS:
            raise ValueError("Max active sessions reached")

        cell = await self.db.cell.find_unique(where={"id": cell_id})
        if not cell or cell.status != "FREE":
            raise ValueError("Cell is not available")

        # Check penalty window
        now = datetime.now(timezone.utc)
        penalty_booking = await self.db.booking.find_first(
            where={
                "userId": user_id,
                "penaltyUntil": {"gt": now},
                "status": {"in": ["CANCELLED", "EXPIRED"]},
            }
        )
        is_free = penalty_booking is None

        # Check subscription
        sub = await self.db.subscription.find_first(
            where={"userId": user_id, "isActive": True, "endAt": {"gt": now}}
        )
        free_mins = BOOKING_FREE_MINS_SUBSCRIBED if sub else BOOKING_FREE_MINS

        ends_at = now + timedelta(minutes=free_mins)

        booking = await self.db.booking.create(data={
            "userId": user_id,
            "cellId": cell_id,
            "status": "ACTIVE",
            "isFree": is_free,
            "endsAt": ends_at,
        })

        # Mark cell as busy
        await self.db.cell.update(where={"id": cell_id}, data={"status": "BUSY"})
        return booking

    async def cancel_booking(self, booking_id: str, user_id: str):
        booking = await self.db.booking.find_unique(where={"id": booking_id})
        if not booking or booking.userId != user_id:
            raise ValueError("Booking not found")
        if booking.status != "ACTIVE":
            raise ValueError("Booking is not active")

        now = datetime.now(timezone.utc)
        penalty_until = now + timedelta(hours=PENALTY_HOURS)

        await self.db.booking.update(
            where={"id": booking_id},
            data={"status": "CANCELLED", "penaltyUntil": penalty_until},
        )
        await self.db.cell.update(
            where={"id": booking.cellId},
            data={"status": "FREE"},
        )
        return penalty_until

    async def expire_booking(self, booking_id: str):
        booking = await self.db.booking.find_unique(where={"id": booking_id})
        if not booking or booking.status != "ACTIVE":
            return None

        now = datetime.now(timezone.utc)
        if booking.endsAt > now:
            return None  # Not yet expired

        await self.db.booking.update(
            where={"id": booking_id},
            data={"status": "EXPIRED"},
        )
        # Free cell if no active session started
        active_session = await self.db.session.find_first(
            where={"bookingId": booking_id, "endAt": None}
        )
        if not active_session:
            await self.db.cell.update(
                where={"id": booking.cellId},
                data={"status": "FREE"},
            )
        return booking

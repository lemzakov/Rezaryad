import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta, timezone

from app.config import CORS_ORIGINS, ADMIN_PASSWORD
from app.db import connect_db, disconnect_db, get_db
from app.bot.handlers import router as bot_router
from app.api.couriers import router as couriers_router
from app.api.lockers import router as lockers_router
from app.api.bookings import router as bookings_router
from app.api.sessions import router as sessions_router
from app.api.tariffs import router as tariffs_router
from app.api.admin import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_open_doors():
    """Every 10 min: remind users with door open > 10 min."""
    try:
        db = await get_db()
        from app.services.notification import NotificationService
        threshold = datetime.now(timezone.utc) - timedelta(minutes=10)
        long_sessions = await db.session.find_many(
            where={"endAt": None, "startAt": {"lt": threshold}},
        )
        notif = NotificationService(db)
        for s in long_sessions:
            minutes = int((datetime.now(timezone.utc) - s.startAt).total_seconds() / 60)
            await notif.send_open_door_reminder(s.userId, minutes)
    except Exception as e:
        logger.error(f"check_open_doors error: {e}")


async def check_double_rentals():
    """Every 5 min: remind couriers with 2 active rentals."""
    try:
        db = await get_db()
        from app.services.notification import NotificationService
        from prisma.models import Session
        # Find users with 2+ active sessions
        active_sessions = await db.session.find_many(where={"endAt": None})
        user_session_counts: dict[str, int] = {}
        for s in active_sessions:
            user_session_counts[s.userId] = user_session_counts.get(s.userId, 0) + 1

        notif = NotificationService(db)
        for user_id, count in user_session_counts.items():
            if count >= 2:
                await notif.send_rental_reminder(user_id)
    except Exception as e:
        logger.error(f"check_double_rentals error: {e}")


async def check_anomalies():
    """Every 10 min: alert admin about sessions > 2 hours."""
    try:
        db = await get_db()
        from app.services.notification import NotificationService
        threshold = datetime.now(timezone.utc) - timedelta(hours=2)
        anomalies = await db.session.find_many(
            where={"endAt": None, "startAt": {"lt": threshold}},
        )
        notif = NotificationService(db)
        for s in anomalies:
            await notif.notify_admin_anomaly(s.id)
    except Exception as e:
        logger.error(f"check_anomalies error: {e}")


async def expire_old_bookings():
    """Every 1 min: expire bookings past their endsAt."""
    try:
        db = await get_db()
        from app.services.booking import BookingService
        now = datetime.now(timezone.utc)
        expired = await db.booking.find_many(
            where={"status": "ACTIVE", "endsAt": {"lt": now}},
        )
        svc = BookingService(db)
        for b in expired:
            await svc.expire_booking(b.id)
    except Exception as e:
        logger.error(f"expire_old_bookings error: {e}")


async def seed_admin() -> None:
    """Create or update the 'admin' user from the ADMIN_PASSWORD env var."""
    if not ADMIN_PASSWORD:
        logger.warning(
            "ADMIN_PASSWORD env var is not set — no admin account will be created. "
            "Set ADMIN_PASSWORD to enable admin panel access."
        )
        return
    if len(ADMIN_PASSWORD) < 8:
        logger.error(
            "ADMIN_PASSWORD must be at least 8 characters. Admin account was not created/updated."
        )
        return
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = await get_db()
    existing = await db.adminuser.find_unique(where={"login": "admin"})
    if existing:
        if pwd_context.verify(ADMIN_PASSWORD, existing.passwordHash):
            logger.info("Admin user 'admin' already up-to-date, skipping update.")
            return
        await db.adminuser.update(
            where={"login": "admin"},
            data={"passwordHash": pwd_context.hash(ADMIN_PASSWORD)},
        )
        logger.info("Admin user 'admin' password updated from ADMIN_PASSWORD env var.")
    else:
        await db.adminuser.create(
            data={"login": "admin", "passwordHash": pwd_context.hash(ADMIN_PASSWORD)}
        )
        logger.info("Admin user 'admin' created from ADMIN_PASSWORD env var.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await seed_admin()
    scheduler.add_job(check_open_doors, "interval", minutes=10, id="open_doors")
    scheduler.add_job(check_double_rentals, "interval", minutes=5, id="double_rentals")
    scheduler.add_job(check_anomalies, "interval", minutes=10, id="anomalies")
    scheduler.add_job(expire_old_bookings, "interval", minutes=1, id="expire_bookings")
    scheduler.start()
    logger.info("Rezaryad backend started")
    yield
    scheduler.shutdown(wait=False)
    await disconnect_db()
    logger.info("Rezaryad backend stopped")


app = FastAPI(
    title="Rezaryad API",
    description="Battery locker rental system for couriers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bot_router)
app.include_router(couriers_router)
app.include_router(lockers_router)
app.include_router(bookings_router)
app.include_router(sessions_router)
app.include_router(tariffs_router)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "Rezaryad API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

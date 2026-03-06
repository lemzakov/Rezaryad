import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
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

# Vercel sets VERCEL=1 in both build and runtime environments.
# On Vercel, APScheduler cannot be used (serverless functions have no persistent
# process between requests). Cron jobs are handled via Vercel Cron endpoints instead.
IS_VERCEL = bool(os.getenv("VERCEL"))

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


def apply_schema() -> None:
    """
    Push the Prisma schema to the database so all tables exist.

    Uses `prisma db push --accept-data-loss`, which is idempotent — when the
    database schema already matches the Prisma schema it does nothing.  The
    --accept-data-loss flag suppresses the interactive prompt that Prisma
    normally shows when a schema change would drop data (e.g. removing a
    column); it does NOT force destructive changes on its own.  Schema changes
    that would result in data loss are still applied if they are present in
    schema.prisma, so keep the schema file accurate.

    The migration uses DIRECT_DATABASE_URL so it bypasses PgBouncer, which
    is required on Supabase where the pooled URL rejects DDL statements.

    Runs from the `backend/` directory so the Prisma CLI finds
    `backend/prisma/schema.prisma` automatically.
    """
    from app.config import DATABASE_URL
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set — skipping schema apply.")
        return
    # Run from backend/ so `prisma db push` finds prisma/schema.prisma
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    logger.info("Applying database schema via prisma db push …")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "prisma", "db", "push", "--accept-data-loss"],
            capture_output=True,
            text=True,
            timeout=120,
            env=os.environ.copy(),
            cwd=backend_dir,
        )
        if result.returncode == 0:
            logger.info("Schema applied successfully.\n%s", result.stdout.strip())
        else:
            logger.error(
                "prisma db push failed (exit code %d).\nSTDOUT: %s\nSTDERR: %s",
                result.returncode,
                result.stdout,
                result.stderr,
            )
    except Exception as exc:
        logger.error("Schema apply error: %s", exc)


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
    apply_schema()  # ensure all DB tables exist before connecting
    await connect_db()
    await seed_admin()
    if not IS_VERCEL:
        # APScheduler needs a persistent process — it doesn't work in Vercel
        # serverless functions where each invocation is independent.
        # On Vercel, background tasks run via Vercel Cron Jobs hitting the
        # /api/admin/cron/* endpoints defined at the bottom of this file.
        scheduler.add_job(check_open_doors, "interval", minutes=10, id="open_doors")
        scheduler.add_job(check_double_rentals, "interval", minutes=5, id="double_rentals")
        scheduler.add_job(check_anomalies, "interval", minutes=10, id="anomalies")
        scheduler.add_job(expire_old_bookings, "interval", minutes=1, id="expire_bookings")
        scheduler.start()
    logger.info("Rezaryad backend started (serverless=%s)", IS_VERCEL)
    yield
    if not IS_VERCEL:
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


# ---------------------------------------------------------------------------
# Vercel Cron Job endpoints
# These replace APScheduler when deployed on Vercel (serverless).  Vercel
# calls these URLs on the configured schedule (see vercel.json → "crons").
#
# Security: if CRON_SECRET is set in the Vercel project environment, Vercel
# automatically sends `Authorization: Bearer <CRON_SECRET>` with every cron
# request.  Set CRON_SECRET to a random secret to prevent unauthorised calls.
# ---------------------------------------------------------------------------

def _verify_cron_auth(request: Request) -> None:
    """Reject the request if CRON_SECRET is configured but the header is wrong."""
    import secrets as _secrets
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return  # No secret configured; skip auth check (acceptable in dev)
    auth = request.headers.get("authorization", "")
    expected = f"Bearer {cron_secret}"
    if not _secrets.compare_digest(auth, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/admin/cron/run-all")
async def cron_run_all(request: Request):
    """Called once daily by Vercel Cron (Hobby free plan: 1 cron, daily minimum).
    Runs all scheduled maintenance tasks in sequence."""
    _verify_cron_auth(request)
    results: dict[str, str] = {}
    for name, fn in [
        ("expire-bookings", expire_old_bookings),
        ("check-open-doors", check_open_doors),
        ("check-double-rentals", check_double_rentals),
        ("check-anomalies", check_anomalies),
    ]:
        try:
            await fn()
            results[name] = "ok"
        except Exception as exc:
            logger.error("cron run-all: %s failed: %s", name, exc)
            results[name] = f"error: {exc}"
    overall = "ok" if all(v == "ok" for v in results.values()) else "partial"
    return {"status": overall, "task": "run-all", "results": results}


@app.post("/api/admin/cron/expire-bookings")
async def cron_expire_bookings(request: Request):
    """Expire past-due bookings. Can be called manually or by an external scheduler."""
    _verify_cron_auth(request)
    await expire_old_bookings()
    return {"status": "ok", "task": "expire-bookings"}


@app.post("/api/admin/cron/check-open-doors")
async def cron_check_open_doors(request: Request):
    """Remind users with door open > 10 min. Can be called manually or by an external scheduler."""
    _verify_cron_auth(request)
    await check_open_doors()
    return {"status": "ok", "task": "check-open-doors"}


@app.post("/api/admin/cron/check-double-rentals")
async def cron_check_double_rentals(request: Request):
    """Remind couriers with 2+ active rentals. Can be called manually or by an external scheduler."""
    _verify_cron_auth(request)
    await check_double_rentals()
    return {"status": "ok", "task": "check-double-rentals"}


@app.post("/api/admin/cron/check-anomalies")
async def cron_check_anomalies(request: Request):
    """Alert admin about sessions > 2 hours. Can be called manually or by an external scheduler."""
    _verify_cron_auth(request)
    await check_anomalies()
    return {"status": "ok", "task": "check-anomalies"}

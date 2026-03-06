from dotenv import load_dotenv
import os
import logging as _logging

load_dotenv()

_cfg_logger = _logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database URL resolution
# Vercel + Supabase integration injects project-prefixed vars instead of the
# generic DATABASE_URL.  We try them in priority order so that an explicitly
# set DATABASE_URL always wins, but Supabase vars work out of the box.
#
# Pooled URL  (runtime queries, goes through PgBouncer):
#   rezaryad_POSTGRES_PRISMA_URL  (Vercel+Supabase)
#   POSTGRES_PRISMA_URL           (generic Vercel)
# Direct URL  (schema migrations, bypasses PgBouncer):
#   rezaryad_POSTGRES_URL_NON_POOLING  (Vercel+Supabase)
#   POSTGRES_URL_NON_POOLING           (generic Vercel)
# ---------------------------------------------------------------------------

DATABASE_URL: str = (
    os.getenv("DATABASE_URL")
    or os.getenv("rezaryad_POSTGRES_PRISMA_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
    or os.getenv("rezaryad_POSTGRES_URL")
    or os.getenv("POSTGRES_URL")
    or ""
)
# Expose resolved URL so Prisma client picks it up via env("DATABASE_URL")
if DATABASE_URL:
    os.environ["DATABASE_URL"] = DATABASE_URL

# Direct (non-pooled) URL — used by `prisma db push` and schema migrations.
# PgBouncer rejects DDL statements, so migrations MUST use the direct URL.
DIRECT_DATABASE_URL: str = (
    os.getenv("DIRECT_DATABASE_URL")
    or os.getenv("rezaryad_POSTGRES_URL_NON_POOLING")
    or os.getenv("POSTGRES_URL_NON_POOLING")
    or DATABASE_URL  # fall back to main URL for local dev without a pooler
    or ""
)
if DIRECT_DATABASE_URL:
    os.environ["DIRECT_DATABASE_URL"] = DIRECT_DATABASE_URL

MAX_BOT_TOKEN: str = os.getenv("MAX_BOT_TOKEN", "")

# SECRET_KEY: fall back to the Supabase JWT secret when not set explicitly
_secret_key = (
    os.getenv("SECRET_KEY")
    or os.getenv("rezaryad_SUPABASE_JWT_SECRET")
    or None
)
if not _secret_key:
    _cfg_logger.warning(
        "SECRET_KEY env var is not set. Using insecure default — DO NOT use in production!"
    )
    _secret_key = "changeme"
SECRET_KEY: str = _secret_key

ACQUIRING_API_KEY: str = os.getenv("ACQUIRING_API_KEY", "")
ACQUIRING_BASE_URL: str = os.getenv("ACQUIRING_BASE_URL", "https://api.acquiring.example.com")
GOSUSLUGI_CLIENT_ID: str = os.getenv("GOSUSLUGI_CLIENT_ID", "")
GOSUSLUGI_CLIENT_SECRET: str = os.getenv("GOSUSLUGI_CLIENT_SECRET", "")

ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
] or ["*"]

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

MAX_API_BASE = "https://botapi.max.ru"

BOOKING_FREE_MINS = 5
BOOKING_FREE_MINS_SUBSCRIBED = 10
PENALTY_HOURS = 2
DOOR_OPEN_FRAUD_SECONDS = 30
MAX_ACTIVE_SESSIONS = 2
MAX_ACTIVE_BOOKINGS = 1

# --- Startup env-var validation ---
# Show exactly which source variable resolved (or failed to resolve) each requirement.
_db_source = (
    "DATABASE_URL" if os.getenv("DATABASE_URL")
    else "rezaryad_POSTGRES_PRISMA_URL" if os.getenv("rezaryad_POSTGRES_PRISMA_URL")
    else "POSTGRES_PRISMA_URL" if os.getenv("POSTGRES_PRISMA_URL")
    else "rezaryad_POSTGRES_URL" if os.getenv("rezaryad_POSTGRES_URL")
    else None
)
_secret_source = (
    "SECRET_KEY" if os.getenv("SECRET_KEY")
    else "rezaryad_SUPABASE_JWT_SECRET" if os.getenv("rezaryad_SUPABASE_JWT_SECRET")
    else None
)

if not _db_source:
    _cfg_logger.error(
        "DEPLOYMENT ERROR: No database URL found. Set DATABASE_URL or let the "
        "Vercel+Supabase integration inject rezaryad_POSTGRES_PRISMA_URL."
    )
if not _secret_source:
    _cfg_logger.error(
        "DEPLOYMENT ERROR: No JWT secret found. Set SECRET_KEY or let the "
        "Vercel+Supabase integration inject rezaryad_SUPABASE_JWT_SECRET."
    )
if not ADMIN_PASSWORD:
    _cfg_logger.error(
        "DEPLOYMENT ERROR: ADMIN_PASSWORD is not set. "
        "The admin panel will be inaccessible until this is configured."
    )

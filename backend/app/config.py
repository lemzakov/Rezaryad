from dotenv import load_dotenv
import os
import logging as _logging

load_dotenv()

_cfg_logger = _logging.getLogger(__name__)

DATABASE_URL: str = os.getenv("DATABASE_URL", "")
MAX_BOT_TOKEN: str = os.getenv("MAX_BOT_TOKEN", "")
_secret_key = os.getenv("SECRET_KEY")
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
_REQUIRED_ENV_VARS = {
    "DATABASE_URL": DATABASE_URL,
    "SECRET_KEY": os.getenv("SECRET_KEY", ""),
    "ADMIN_PASSWORD": ADMIN_PASSWORD,
}

_missing_vars = [name for name, val in _REQUIRED_ENV_VARS.items() if not val]
if _missing_vars:
    _cfg_logger.error(
        "DEPLOYMENT ERROR: The following required environment variables are not set: %s. "
        "The application may not work correctly. Set them before deploying.",
        ", ".join(_missing_vars),
    )

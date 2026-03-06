from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "")
MAX_BOT_TOKEN: str = os.getenv("MAX_BOT_TOKEN", "")
SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme")
ACQUIRING_API_KEY: str = os.getenv("ACQUIRING_API_KEY", "")
GOSUSLUGI_CLIENT_ID: str = os.getenv("GOSUSLUGI_CLIENT_ID", "")
GOSUSLUGI_CLIENT_SECRET: str = os.getenv("GOSUSLUGI_CLIENT_SECRET", "")
ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "changeme-admin")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

MAX_API_BASE = "https://botapi.max.ru"

BOOKING_FREE_MINS = 5
BOOKING_FREE_MINS_SUBSCRIBED = 10
PENALTY_HOURS = 2
DOOR_OPEN_FRAUD_SECONDS = 30
MAX_ACTIVE_SESSIONS = 2
MAX_ACTIVE_BOOKINGS = 1

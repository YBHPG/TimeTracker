import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'tracker.db'}")

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Static frontend path (for container or single app mode)
STATIC_DIR = Path(os.getenv("STATIC_DIR", BASE_DIR.parent / "frontend" / "dist"))

# Analytics / API settings
API_VERSION = "1.1.0"
DEFAULT_TZ = os.getenv("TRACKER_TZ", os.getenv("TZ", "Asia/Almaty"))

# Optional read-only bearer token for analytics endpoints (/api/summary, /api/entries).
# Empty/unset means auth is disabled (development).
READ_TOKEN = (os.getenv("TRACKER_READ_TOKEN") or "").strip() or None

# Task categories taxonomy
CATEGORIES = [
    {"id": "work", "label": "Работа"},
    {"id": "personal", "label": "Личное"},
    {"id": "study", "label": "Учёба"},
]

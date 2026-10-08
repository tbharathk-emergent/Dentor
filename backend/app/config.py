import os
from pathlib import Path


def _load_dotenv() -> None:
    """Load backend/.env (KEY=VALUE lines) so manual `uvicorn` runs and systemd behave
    the same. Real process environment variables always win over the file."""
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

# "development" (default) or "production". Production refuses unsafe defaults at startup.
ENV = os.getenv("DENTOR_ENV", os.getenv("ENV", "development")).strip().lower()
IS_PROD = ENV == "production"

MONGO_URL = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("DB_NAME", "dentor")

_DEV_JWT_SECRET = "dentor-dev-secret-change-in-production"
JWT_SECRET = os.getenv("JWT_SECRET", _DEV_JWT_SECRET)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))

# Demo clinic admin — only ever created by demo seeding.
ADMIN_EMAIL = "admin@dentor.in"
ADMIN_DEFAULT_PASSWORD = "Dentor@2026"

# Platform owner account, above all clinics.
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@dentor.in")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")
_DEV_SUPER_ADMIN_PASSWORD = "SuperAdmin@2026"  # development fallback only

# Demo data: on by default in development, always off in production unless forced.
_seed_env = os.getenv("SEED_DEMO", "")
SEED_DEMO = (_seed_env or ("1" if not IS_PROD else "0")).strip().lower() in ("1", "true", "yes")

# Comma-separated list of allowed browser origins. Only needed when the frontend is NOT
# served same-origin behind the API's reverse proxy.
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

# Largest accepted request body (base64 patient-file uploads are ≤5 MB ≈ 7 MB of JSON).
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(16 * 1024 * 1024)))


def super_admin_bootstrap_password() -> str:
    """Password used when the super admin account is first created.

    Production requires SUPER_ADMIN_PASSWORD; development falls back to the known
    demo password so local setup stays zero-config.
    """
    if SUPER_ADMIN_PASSWORD:
        return SUPER_ADMIN_PASSWORD
    if IS_PROD:
        raise RuntimeError(
            "SUPER_ADMIN_PASSWORD is not set. Production refuses to create the platform "
            "admin with a default password — set SUPER_ADMIN_PASSWORD in the environment."
        )
    return _DEV_SUPER_ADMIN_PASSWORD


def validate_production_config() -> None:
    """Fail fast instead of booting an unsafe production instance."""
    if not IS_PROD:
        return
    if JWT_SECRET == _DEV_JWT_SECRET or len(JWT_SECRET) < 32:
        raise RuntimeError(
            "JWT_SECRET is missing, too short (<32 chars) or still the development default. "
            "Generate one with `openssl rand -hex 32` and set it in the environment."
        )
    if SEED_DEMO:
        # Explicitly forced in production — allowed, but make it loud.
        import logging

        logging.getLogger("dentor").warning(
            "SEED_DEMO is enabled in production: demo patients/invoices WILL be created."
        )

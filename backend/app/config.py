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
# The development default also covers the browser previews of the three mobile apps
# (ports 8091-8093). Phones need no entry: native apps do not send a browser origin.
_DEV_CORS = ",".join(
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (5173, 8091, 8092, 8093)
)
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _DEV_CORS).split(",") if o.strip()]

# Largest accepted request body (base64 patient-file uploads are ≤5 MB ≈ 7 MB of JSON).
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(16 * 1024 * 1024)))


# ---- Mobile apps: sessions, OTP and notifications ----
# Short-lived access tokens for the patient app; long-lived, rotating refresh tokens for all apps.
PATIENT_ACCESS_MINUTES = int(os.getenv("PATIENT_ACCESS_MINUTES", "60"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))

# OTP delivery. "console" logs the code and returns it to the caller (development only);
# "webhook" POSTs {to, message, purpose} to SMS_WEBHOOK_URL (your SMS gateway adapter);
# empty = not configured, OTP requests are refused. Production never allows "console".
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "" if IS_PROD else "console").strip().lower()
if IS_PROD and SMS_PROVIDER == "console":
    SMS_PROVIDER = ""
SMS_WEBHOOK_URL = os.getenv("SMS_WEBHOOK_URL", "").strip()
SMS_WEBHOOK_TOKEN = os.getenv("SMS_WEBHOOK_TOKEN", "").strip()
# Email codes (staff and patient password reset by email, staff sign-up). "console" logs the code
# and returns it to the client in development; "webhook" POSTs {to, subject, text, purpose} to
# EMAIL_WEBHOOK_URL (your email service adapter). Production never falls back to console.
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "" if IS_PROD else "console").strip().lower()
if IS_PROD and EMAIL_PROVIDER == "console":
    EMAIL_PROVIDER = ""
EMAIL_WEBHOOK_URL = os.getenv("EMAIL_WEBHOOK_URL", "").strip()
EMAIL_WEBHOOK_TOKEN = os.getenv("EMAIL_WEBHOOK_TOKEN", "").strip()
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
OTP_MAX_PER_HOUR = int(os.getenv("OTP_MAX_PER_HOUR", "5"))

# Push delivery. "webhook" POSTs {devices: [{token, platform}], title, body, data} to
# PUSH_WEBHOOK_URL (your FCM / APNs adapter); empty keeps notifications in-app only.
PUSH_PROVIDER = os.getenv("PUSH_PROVIDER", "").strip().lower()
PUSH_WEBHOOK_URL = os.getenv("PUSH_WEBHOOK_URL", "").strip()
PUSH_WEBHOOK_TOKEN = os.getenv("PUSH_WEBHOOK_TOKEN", "").strip()

# In-app notifications are deleted this many days after they were created. 0 keeps them for ever.
NOTIFICATION_RETENTION_DAYS = max(0, int(os.getenv("NOTIFICATION_RETENTION_DAYS", "180")))

# Demo logins created by demo seeding only (never by a normal production start).
OWNER_EMAIL = "owner@dentor.in"
OWNER_DEFAULT_PASSWORD = "Owner@2026"
CONSULTANT_EMAIL = "kumar@dentor.in"
CONSULTANT_DEFAULT_PASSWORD = "Consultant@2026"
DEMO_PATIENT_MOBILE = "9876543210"
DEMO_PATIENT_PASSWORD = "Patient@2026"


def super_admin_bootstrap_password() -> str:
    """Password used when the super admin account is first created.

    Production requires SUPER_ADMIN_PASSWORD; development falls back to the known
    demo password so local setup stays zero-config.
    """
    if IS_PROD and SUPER_ADMIN_PASSWORD == _DEV_SUPER_ADMIN_PASSWORD:
        # Creating the account with the dev default would make every later restart fail
        # the default-password guard — refuse up front with the real reason.
        raise RuntimeError(
            "SUPER_ADMIN_PASSWORD is set to the development default. Production requires "
            f"a different value — choose a strong password that is not {_DEV_SUPER_ADMIN_PASSWORD!r}."
        )
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

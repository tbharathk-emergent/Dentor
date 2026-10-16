import os
import re
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

# A fixed verification code for dedicated test mobile numbers (patient app testing without an SMS gateway).
# Off unless BOTH are set. OTP_TEST_MOBILES is a comma-separated list. Only for sign-up, code login and password
# reset, never for "Fetch"; refused for a number that belongs to a staff-registered patient record or to a non-test
# account; the code is never returned or logged. Remove both lines and restart the API to turn it off.
# See docs/INTEGRATIONS.md.
MAX_TEST_ENTRIES = 20


def parse_test_mobiles(raw: str) -> list[str]:
    return [m.strip() for m in (raw or "").split(",") if m.strip()]


OTP_TEST_MOBILES = parse_test_mobiles(os.getenv("OTP_TEST_MOBILES", ""))
OTP_TEST_CODE = os.getenv("OTP_TEST_CODE", "").strip()


def _is_indian_mobile(mobile: str) -> bool:
    return len(mobile) == 10 and mobile.isdigit() and mobile[0] in "6789"


def otp_test_settings_problem(mobiles: list[str], code: str) -> str | None:
    """Why the test-code settings are unusable, or None when both are empty (off) or both are valid."""
    if not mobiles and not code:
        return None
    if not mobiles or not code:
        return "OTP_TEST_MOBILES and OTP_TEST_CODE must be set together (or both left empty to keep the test code off)."
    if len(mobiles) > MAX_TEST_ENTRIES:
        return f"OTP_TEST_MOBILES allows at most {MAX_TEST_ENTRIES} numbers."
    if not all(_is_indian_mobile(m) for m in mobiles):
        return "OTP_TEST_MOBILES must be 10-digit Indian mobile numbers separated by commas (no +91, spaces inside a number, or other separators)."
    if len(set(mobiles)) != len(mobiles):
        return "OTP_TEST_MOBILES lists the same number twice."
    if not (len(code) == 6 and code.isdigit()):
        return "OTP_TEST_CODE must be exactly 6 digits."
    return None


# Test patient logins (patient app testing): "email|mobile|password" entries separated by ";". At start-up the API
# creates or updates one ordinary patient account per entry (password stored only as a hash) marked as a test
# account, so it signs in through the normal login with the email or the mobile and only ever sees records it
# creates in the app. An entry whose email or number belongs to a real patient is skipped. Accounts made this way
# are disabled again when their entry is removed. Empty = off. See docs/INTEGRATIONS.md.
def parse_test_accounts(raw: str) -> tuple[list[dict], str | None]:
    """The configured test accounts, and why the setting is unusable (None when it is fine or empty)."""
    entries = [e.strip() for e in (raw or "").split(";") if e.strip()]
    accounts: list[dict] = []
    for number, entry in enumerate(entries, 1):
        parts = [p.strip() for p in entry.split("|")]
        if len(parts) != 3:
            return [], f"PATIENT_TEST_ACCOUNTS entry {number} must be email|mobile|password (passwords cannot contain | or ;)."
        email, mobile, password = parts[0].lower(), parts[1], parts[2]
        if not re.match(r"^[^@\s|;]+@[^@\s|;]+\.[^@\s|;]+$", email):
            return [], f"PATIENT_TEST_ACCOUNTS entry {number}: the email is not valid."
        if not _is_indian_mobile(mobile):
            return [], f"PATIENT_TEST_ACCOUNTS entry {number}: the mobile must be a 10-digit Indian number (no +91)."
        if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
            return [], f"PATIENT_TEST_ACCOUNTS entry {number}: the password needs at least 8 characters with a letter and a number."
        accounts.append({"email": email, "mobile": mobile, "password": password})
    if len(accounts) > MAX_TEST_ENTRIES:
        return [], f"PATIENT_TEST_ACCOUNTS allows at most {MAX_TEST_ENTRIES} accounts."
    if len({a["email"] for a in accounts}) != len(accounts) or len({a["mobile"] for a in accounts}) != len(accounts):
        return [], "PATIENT_TEST_ACCOUNTS lists the same email or mobile twice."
    return accounts, None


PATIENT_TEST_ACCOUNTS, _TEST_ACCOUNTS_PROBLEM = parse_test_accounts(os.getenv("PATIENT_TEST_ACCOUNTS", ""))

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
    # checked in every environment: half-set or malformed test settings must never half-work
    problem = otp_test_settings_problem(OTP_TEST_MOBILES, OTP_TEST_CODE) or _TEST_ACCOUNTS_PROBLEM
    if problem:
        raise RuntimeError(problem)
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

"""Four-digit codes sent by email: password reset for staff and patients, and verifying the email
of a clinic or consultant who applies to join (the designs' "Check your email" screens).

The same safeguards as the SMS codes in otp.py: codes are stored hashed, expire, allow few
attempts and are throttled per address in the database. In development the code is logged and
returned to the client; in production it is only ever emailed (EMAIL_PROVIDER=webhook).
"""
import asyncio
import hashlib
import hmac
import json
import logging
import re
import secrets
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from .auth import create_access_token, decode_token
from .config import EMAIL_PROVIDER, EMAIL_WEBHOOK_TOKEN, EMAIL_WEBHOOK_URL, JWT_SECRET, OTP_MAX_PER_HOUR, OTP_TTL_SECONDS

log = logging.getLogger("dentor")

PURPOSES = {"staff_reset", "staff_signup", "patient_reset"}
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 30
TICKET_MINUTES = 15
TOKEN_EMAIL_TICKET = "email"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(raw: str | None) -> str:
    email = str(raw or "").strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 120:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return email


def email_configured() -> bool:
    return EMAIL_PROVIDER == "console" or (EMAIL_PROVIDER == "webhook" and bool(EMAIL_WEBHOOK_URL))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _hash(email: str, purpose: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"email:{email}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


def _post_webhook(email: str, subject: str, text: str, purpose: str) -> None:
    body = json.dumps({"to": email, "subject": subject, "text": text, "purpose": purpose}).encode()
    headers = {"Content-Type": "application/json"}
    if EMAIL_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {EMAIL_WEBHOOK_TOKEN}"
    req = urllib.request.Request(EMAIL_WEBHOOK_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 (operator-configured URL)
        if res.status >= 300:
            raise RuntimeError(f"email service answered HTTP {res.status}")


SUBJECTS = {
    "staff_reset": "Your Dentor password reset code",
    "patient_reset": "Your Dentor password reset code",
    "staff_signup": "Verify your email for Dentor",
}


async def send_email_code(db, email: str, purpose: str) -> dict:
    if purpose not in PURPOSES:
        raise HTTPException(status_code=400, detail="Unknown verification purpose.")
    if not email_configured():
        raise HTTPException(status_code=503, detail="Email codes are not available yet: this server has no email service configured.")
    now = _now()
    if await db.email_codes.count_documents({"email": email, "created_at": {"$gte": now - timedelta(hours=1)}}) >= OTP_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many codes requested for this email. Try again in an hour.")
    latest = await db.email_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)])
    if latest:
        wait = RESEND_COOLDOWN_SECONDS - (now - _aware(latest["created_at"])).total_seconds()
        if wait > 0:
            raise HTTPException(status_code=429, detail=f"Please wait {int(wait) + 1} seconds before asking for another code.",
                                headers={"Retry-After": str(int(wait) + 1)})
    code = f"{secrets.randbelow(10 ** 4):04d}"
    await db.email_codes.insert_one({
        "email": email, "purpose": purpose, "code_hash": _hash(email, purpose, code), "attempts": 0, "consumed": False,
        "created_at": now, "expires_at": now + timedelta(seconds=OTP_TTL_SECONDS),
    })
    text = f"{code} is your Dentor code. It expires in {OTP_TTL_SECONDS // 60} minutes. If you did not ask for it, ignore this email."
    if EMAIL_PROVIDER == "console":
        log.warning("DEV EMAIL CODE for %s (%s): %s", email, purpose, code)
    else:
        try:
            await asyncio.to_thread(_post_webhook, email, SUBJECTS[purpose], text, purpose)
        except Exception as exc:
            log.error("email delivery failed: %s", exc)
            raise HTTPException(status_code=502, detail="We could not send the email. Please try again.")
    result = {"sent": True, "expires_in": OTP_TTL_SECONDS, "resend_in": RESEND_COOLDOWN_SECONDS, "length": 4}
    if EMAIL_PROVIDER == "console":
        result["dev_code"] = code  # development only; impossible in production (see config)
    return result


async def verify_email_code(db, email: str, purpose: str, code: str) -> str:
    """Checks the code and returns a short-lived ticket proving the address was verified."""
    doc = await db.email_codes.find_one({"email": email, "purpose": purpose, "consumed": False}, sort=[("created_at", -1)])
    if not doc or _aware(doc["expires_at"]) <= _now():
        raise HTTPException(status_code=400, detail="This code has expired. Ask for a new one.")
    if doc.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Ask for a new code.")
    if not hmac.compare_digest(doc["code_hash"], _hash(email, purpose, str(code or "").strip())):
        await db.email_codes.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code. Check the email and try again.")
    await db.email_codes.update_one({"_id": doc["_id"]}, {"$set": {"consumed": True}})
    return create_access_token(email, {"typ": TOKEN_EMAIL_TICKET, "purpose": purpose}, expires_minutes=TICKET_MINUTES)


def read_email_ticket(ticket: str, purpose: str) -> str:
    try:
        payload = decode_token(ticket or "")
    except HTTPException:
        raise HTTPException(status_code=400, detail="Your verification has expired. Ask for a new code.")
    if payload.get("typ") != TOKEN_EMAIL_TICKET or payload.get("purpose") != purpose:
        raise HTTPException(status_code=400, detail="This verification cannot be used here. Ask for a new code.")
    return payload["sub"]


async def send_email_message(email: str, subject: str, text: str, purpose: str) -> bool:
    """A plain notice (an application decided). Best effort: the decision stands if delivery fails."""
    if EMAIL_PROVIDER == "console":
        log.warning("DEV EMAIL to %s: %s / %s", email, subject, text)
        return True
    if not email_configured():
        return False
    try:
        await asyncio.to_thread(_post_webhook, email, subject, text, purpose)
        return True
    except Exception as exc:
        log.error("email delivery failed: %s", exc)
        return False

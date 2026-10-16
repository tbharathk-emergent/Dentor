"""One-time passcodes for the patient app (sign-up, password reset, passwordless login).

Codes are stored hashed, expire quickly, allow few attempts and are throttled per mobile
number in the database, so the limits hold across all API workers.
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

from .auth import TOKEN_OTP_TICKET, create_access_token, decode_token
from .config import (
    JWT_SECRET,
    OTP_MAX_PER_HOUR,
    OTP_TTL_SECONDS,
    SMS_PROVIDER,
    SMS_WEBHOOK_TOKEN,
    SMS_WEBHOOK_URL,
)

log = logging.getLogger("dentor")

PURPOSES = {"signup", "login", "reset", "link"}
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 30
TICKET_MINUTES = 10


def normalize_mobile(raw: str | None) -> str:
    """10-digit Indian mobile number; accepts +91 / 0 prefixes and separators."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) > 10:
        digits = digits[-10:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number.")
    return digits


def same_mobile(a: str | None, b: str | None) -> bool:
    da, db_ = re.sub(r"\D", "", str(a or ""))[-10:], re.sub(r"\D", "", str(b or ""))[-10:]
    return len(da) == 10 and da == db_


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _code_hash(mobile: str, purpose: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{mobile}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


def sms_configured() -> bool:
    return SMS_PROVIDER == "console" or (SMS_PROVIDER == "webhook" and bool(SMS_WEBHOOK_URL))


def _post_webhook(mobile: str, message: str, purpose: str) -> None:
    body = json.dumps({"to": f"+91{mobile}", "message": message, "purpose": purpose}).encode()
    headers = {"Content-Type": "application/json"}
    if SMS_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {SMS_WEBHOOK_TOKEN}"
    req = urllib.request.Request(SMS_WEBHOOK_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 (operator-configured URL)
        if res.status >= 300:
            raise RuntimeError(f"SMS gateway answered HTTP {res.status}")


async def _deliver(mobile: str, code: str, purpose: str) -> None:
    message = f"{code} is your Dentor verification code. It expires in {OTP_TTL_SECONDS // 60} minutes. Do not share it."
    if SMS_PROVIDER == "console":
        log.warning("DEV OTP for %s (%s): %s", mobile, purpose, code)
        return
    try:
        await asyncio.to_thread(_post_webhook, mobile, message, purpose)
    except Exception as exc:  # gateway down / misconfigured
        log.error("SMS delivery failed: %s", exc)
        raise HTTPException(status_code=502, detail="We could not send the verification code. Please try again.")


async def request_otp(db, mobile: str, purpose: str) -> dict:
    if purpose not in PURPOSES:
        raise HTTPException(status_code=400, detail="Unknown verification purpose.")
    if not sms_configured():
        raise HTTPException(
            status_code=503,
            detail="Verification codes are not available yet: this server has no SMS provider configured.",
        )
    now = _now()
    sent_last_hour = await db.otp_codes.count_documents({"mobile": mobile, "created_at": {"$gte": now - timedelta(hours=1)}})
    if sent_last_hour >= OTP_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many codes requested for this number. Try again in an hour.")
    latest = await db.otp_codes.find_one({"mobile": mobile, "purpose": purpose}, sort=[("created_at", -1)])
    if latest:
        wait = RESEND_COOLDOWN_SECONDS - (now - _aware(latest["created_at"])).total_seconds()
        if wait > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {int(wait) + 1} seconds before requesting another code.",
                headers={"Retry-After": str(int(wait) + 1)},
            )

    code = f"{secrets.randbelow(10 ** 6):06d}"
    await db.otp_codes.insert_one({
        "mobile": mobile, "purpose": purpose, "code_hash": _code_hash(mobile, purpose, code),
        "attempts": 0, "consumed": False,
        "created_at": now, "expires_at": now + timedelta(seconds=OTP_TTL_SECONDS),
    })
    await _deliver(mobile, code, purpose)
    result = {"sent": True, "expires_in": OTP_TTL_SECONDS, "resend_in": RESEND_COOLDOWN_SECONDS}
    if SMS_PROVIDER == "console":
        result["dev_otp"] = code  # development convenience; impossible in production (see config)
    return result


async def verify_otp(db, mobile: str, purpose: str, code: str) -> str:
    """Checks the code and returns a short-lived ticket proving this mobile was verified."""
    doc = await db.otp_codes.find_one(
        {"mobile": mobile, "purpose": purpose, "consumed": False}, sort=[("created_at", -1)]
    )
    if not doc or _aware(doc["expires_at"]) <= _now():
        raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")
    if doc.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")
    if not hmac.compare_digest(doc["code_hash"], _code_hash(mobile, purpose, str(code or "").strip())):
        await db.otp_codes.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code. Check the SMS and try again.")
    await db.otp_codes.update_one({"_id": doc["_id"]}, {"$set": {"consumed": True}})
    return create_access_token(mobile, {"typ": TOKEN_OTP_TICKET, "purpose": purpose}, expires_minutes=TICKET_MINUTES)


def read_ticket(ticket: str, purpose: str) -> str:
    """Returns the verified mobile number carried by a ticket issued for `purpose`."""
    try:
        payload = decode_token(ticket or "")
    except HTTPException:
        raise HTTPException(status_code=400, detail="Your verification has expired. Request a new code.")
    if payload.get("typ") != TOKEN_OTP_TICKET or payload.get("purpose") != purpose:
        raise HTTPException(status_code=400, detail="This verification cannot be used here. Request a new code.")
    return payload["sub"]

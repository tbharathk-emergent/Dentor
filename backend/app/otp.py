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
from . import config as _config
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
# Purposes the fixed test code may serve. Never "link": that code proves ownership of ANOTHER record's number.
TEST_CODE_PURPOSES = {"signup", "login", "reset"}
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


def is_test_mobile(mobile: str | None) -> bool:
    """True only for a configured test number, and only while the test code is switched on."""
    test_mobiles, test_code = _config.OTP_TEST_MOBILES, _config.OTP_TEST_CODE
    if not test_mobiles or not test_code or _config.otp_test_settings_problem(test_mobiles, test_code):
        return False
    candidate = str(mobile or "")
    return any([hmac.compare_digest(candidate, m) for m in test_mobiles])


def masked_mobile(mobile: str) -> str:
    return f"******{mobile[-4:]}" if mobile else ""


async def _test_number_is_taken(db, mobile: str) -> bool:
    """The fixed code must never open a real person's records: refuse it when the number is on any patient record
    the test account did not create itself (registered by clinic staff, or made in the app by someone else and
    later moved to this number), or on a patient-app account that was not created as the test account."""
    async for p in db.patients.find({"mobile": {"$regex": f"{mobile}$"}}, {"mobile": 1, "created_by": 1, "test_record": 1}):
        if same_mobile(p.get("mobile"), mobile) and not (p.get("created_by") == "patient-app" and p.get("test_record") is True):
            return True
    account = await db.patient_accounts.find_one({"mobile": mobile}, {"test_account": 1})
    return bool(account and not account.get("test_account"))


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
    use_test_code = is_test_mobile(mobile) and purpose in TEST_CODE_PURPOSES
    if not use_test_code and not sms_configured():
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

    if use_test_code and await _test_number_is_taken(db, mobile):
        log.warning("Test verification code refused for %s: the number belongs to a real patient record or account.",
                    masked_mobile(mobile))
        raise HTTPException(status_code=502, detail="We could not send the verification code. Please try again.")

    code = _config.OTP_TEST_CODE if use_test_code else f"{secrets.randbelow(10 ** 6):06d}"
    await db.otp_codes.insert_one({
        "mobile": mobile, "purpose": purpose, "code_hash": _code_hash(mobile, purpose, code),
        "attempts": 0, "consumed": False,
        "created_at": now, "expires_at": now + timedelta(seconds=OTP_TTL_SECONDS),
    })
    result = {"sent": True, "expires_in": OTP_TTL_SECONDS, "resend_in": RESEND_COOLDOWN_SECONDS}
    if use_test_code:
        # no SMS, no code in the answer or the log: the tester already knows it
        log.warning("Test verification code issued for %s (%s).", masked_mobile(mobile), purpose)
        return result
    await _deliver(mobile, code, purpose)
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

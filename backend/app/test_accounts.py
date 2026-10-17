"""Test patient logins from PATIENT_TEST_ACCOUNTS (see app/config.py and docs/INTEGRATIONS.md).

At start-up each configured entry becomes an ordinary patient account (password stored only as a hash) with
`test_account: True`, so it signs in through the normal /api/patient/auth/login with its email or mobile and only
ever sees patient records it creates in the app itself (patient_auth.may_see_record). Nothing here bypasses
authentication. An entry is skipped when its email or mobile belongs to a real patient. Accounts made from the
setting are disabled, and their sessions ended, once their entry is removed.
"""
import logging
import secrets

from pymongo.errors import DuplicateKeyError

from . import config as _config
from .auth import hash_password, verify_password
from .otp import _test_number_is_taken, is_test_mobile, masked_mobile
from .sessions import revoke_all_sessions
from .util import now_iso

log = logging.getLogger("dentor")

SOURCE = "PATIENT_TEST_ACCOUNTS"
CODE_SOURCE = "OTP_TEST_MOBILES"   # made at the first code login on a test number


async def create_code_test_account(db, mobile: str) -> dict:
    """The account behind the first code login on a listed test number (otp.is_test_mobile): a test account with an
    unusable random password (code login only, until a password is set by reset), never seeing real records."""
    stamp = now_iso()
    try:
        await db.patient_accounts.insert_one({
            "mobile": mobile, "name": "Test Patient", "password_hash": hash_password(secrets.token_urlsafe(32)),
            "gender": "", "age": None, "status": "Active", "test_account": True, "test_source": CODE_SOURCE,
            "created_at": stamp, "updated_at": stamp,
        })
        log.warning("Test patient account created at the first code login on %s.", masked_mobile(mobile))
    except DuplicateKeyError:  # two first logins at once: use the one that won
        pass
    return await db.patient_accounts.find_one({"mobile": mobile})


def masked_email(email: str) -> str:
    name, _, domain = (email or "").partition("@")
    return f"{name[:1]}***@{domain}" if domain else "***"


async def sync_patient_test_accounts(db) -> dict:
    """Create, update, re-enable or disable the configured test accounts. Returns counts (no secrets)."""
    ready, skipped = [], 0
    for entry in _config.PATIENT_TEST_ACCOUNTS:
        email, mobile = entry["email"], entry["mobile"]
        by_mobile = await db.patient_accounts.find_one({"mobile": mobile})
        by_email = await db.patient_accounts.find_one({"email": email})
        conflict = (
            await _test_number_is_taken(db, mobile)                       # real account or staff records on the number
            or (by_email and not by_email.get("test_account"))            # the email belongs to a real account
            or (by_email and by_mobile and by_email["_id"] != by_mobile["_id"])
        )
        if conflict:
            skipped += 1
            log.warning("Test patient login %s / %s skipped: the email or number belongs to a real patient.",
                        masked_email(email), masked_mobile(mobile))
            continue
        account = by_mobile or by_email
        stamp = now_iso()
        if account is None:
            await db.patient_accounts.insert_one({
                "mobile": mobile, "email": email, "name": "Test Patient", "password_hash": hash_password(entry["password"]),
                "gender": "", "age": None, "status": "Active", "test_account": True, "test_source": SOURCE,
                "created_at": stamp, "updated_at": stamp,
            })
        else:
            changes = {"mobile": mobile, "email": email, "status": "Active", "test_account": True, "test_source": SOURCE}
            if not verify_password(entry["password"], account.get("password_hash", "")):
                changes.update(password_hash=hash_password(entry["password"]), password_changed_at=stamp)
            if any(account.get(k) != v for k, v in changes.items()):
                changes["updated_at"] = stamp
                await db.patient_accounts.update_one({"_id": account["_id"]}, {"$set": changes})
                if "password_hash" in changes:
                    await revoke_all_sessions(db, "patient", str(account["_id"]))
        ready.append(mobile)

    # accounts made by a first code login follow OTP_TEST_MOBILES: off when their number is no longer listed
    listed = [m for m in _config.OTP_TEST_MOBILES if is_test_mobile(m)]
    await db.patient_accounts.update_many({"test_source": CODE_SOURCE, "mobile": {"$in": listed}, "status": "Disabled"},
                                          {"$set": {"status": "Active", "updated_at": now_iso()}})
    disabled = 0
    # A login its owner deleted (app/account_deletion.py) stays "Deleted", so the Super Admin can still see and restore it.
    async for account in db.patient_accounts.find({"$or": [
        {"test_source": SOURCE, "mobile": {"$nin": ready}},
        {"test_source": CODE_SOURCE, "mobile": {"$nin": listed}},
    ], "status": {"$nin": ["Disabled", "Deleted"]}}):
        await db.patient_accounts.update_one({"_id": account["_id"]}, {"$set": {"status": "Disabled", "updated_at": now_iso()}})
        await revoke_all_sessions(db, "patient", str(account["_id"]))
        disabled += 1
    if ready or skipped or disabled:
        log.warning("Test patient logins: %d ready (%s), %d skipped, %d disabled.",
                    len(ready), ", ".join(masked_mobile(m) for m in ready) or "none", skipped, disabled)
    return {"ready": len(ready), "skipped": skipped, "disabled": disabled}

"""Fingerprint / face sign-in ("Login with" fingerprint in all three app designs).

The app never sees biometric data and neither does the API. When someone turns fingerprint
sign-in on, the API gives the device a random secret. The app keeps it in the device keychain
under the operating system's biometric protection (Android Keystore / iOS Keychain with a
biometry access control), so only a successful fingerprint or face check releases it. Signing in
then sends the secret, and the API answers with a normal new session.

The secret is stored hashed, works for one account on one device, can be turned off from the app
and stops working when the account's sessions are ended (password change or reset, deactivation).
It is not a refresh token: those rotate, and an old one coming back would look like theft.
"""
import hashlib
import secrets
import time

from fastapi import HTTPException

from .config import JWT_SECRET
from .util import now_iso

MAX_DEVICES = 5


def _hash(secret: str) -> str:
    return hashlib.sha256(f"{JWT_SECRET}:{secret}".encode()).hexdigest()


async def enroll(db, kind: str, subject: str, device_name: str) -> dict:
    """kind: "user" (staff, keyed by email) or "patient" (keyed by account id)."""
    device_id = secrets.token_urlsafe(12)
    secret = secrets.token_urlsafe(32)
    await db.device_credentials.insert_one({
        "kind": kind, "subject": subject, "device_id": device_id, "secret_hash": _hash(secret),
        "device_name": device_name.strip()[:80], "created_ts": time.time(), "created_at": now_iso(), "revoked": False,
    })
    # keep the newest few devices per account
    old = await db.device_credentials.find({"kind": kind, "subject": subject, "revoked": False}).sort("created_ts", -1).skip(MAX_DEVICES).to_list(None)
    if old:
        await db.device_credentials.update_many({"_id": {"$in": [o["_id"] for o in old]}}, {"$set": {"revoked": True}})
    return {"device_id": device_id, "secret": secret}


async def check(db, kind: str, device_id: str, secret: str, sessions_valid_from=None, subject: str | None = None) -> dict:
    """Returns the credential record, or refuses with a message that sends the person to their password."""
    doc = await db.device_credentials.find_one({"kind": kind, "device_id": device_id or "", "revoked": False})
    if not doc or not secrets.compare_digest(doc["secret_hash"], _hash(secret or "")):
        raise HTTPException(status_code=401, detail="Fingerprint sign-in is not set up on this device. Sign in with your password.")
    if subject is not None and doc["subject"] != subject:
        raise HTTPException(status_code=401, detail="Fingerprint sign-in is not set up on this device. Sign in with your password.")
    if sessions_valid_from and float(doc["created_ts"]) < float(sessions_valid_from):
        await db.device_credentials.update_one({"_id": doc["_id"]}, {"$set": {"revoked": True}})
        raise HTTPException(status_code=401, detail="Your password changed. Sign in with your password, then turn fingerprint sign-in on again.")
    await db.device_credentials.update_one({"_id": doc["_id"]}, {"$set": {"last_used": now_iso()}})
    return doc


async def revoke(db, kind: str, subject: str, device_id: str) -> None:
    await db.device_credentials.update_one({"kind": kind, "subject": subject, "device_id": device_id}, {"$set": {"revoked": True}})

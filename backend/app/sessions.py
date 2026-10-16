"""Sessions: one per sign-in on one device.

A session is identified by its id (the refresh-token "family"). Its access tokens carry that
id as the `sid` claim; its refresh tokens are opaque, stored hashed and rotated on every use.

A refresh token is single-use. Presenting one that was already rotated means it was copied,
so the whole session is ended.

Ending a session (sign-out, or reuse of a retired refresh token) retires its refresh tokens
and records the id in `ended_sessions`, which every authenticated request consults, so the
session's access token stops working at once instead of living on until it expires.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException

from .config import JWT_EXPIRE_MINUTES, PATIENT_ACCESS_MINUTES, REFRESH_TOKEN_DAYS

_INVALID = HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


# An ended session only has to be remembered until its last access token would have expired.
_ENDED_SESSION_MEMORY = timedelta(minutes=max(JWT_EXPIRE_MINUTES, PATIENT_ACCESS_MINUTES) + 5)


def new_session_id() -> str:
    return secrets.token_hex(12)


async def end_session(db, session_id: str | None) -> None:
    """Signs one device out: no refresh, and its access token is refused from now on."""
    if not session_id:
        return
    now = _now()
    await db.refresh_tokens.update_many(
        {"family": session_id, "revoked_at": None}, {"$set": {"revoked_at": now}}
    )
    await db.ended_sessions.update_one(
        {"_id": session_id},
        {"$set": {"ended_at": now, "expires_at": now + _ENDED_SESSION_MEMORY}},
        upsert=True,
    )


async def session_ended(db, session_id: str | None) -> bool:
    if not session_id:
        return False
    return await db.ended_sessions.find_one({"_id": session_id}, {"_id": 1}) is not None


async def end_session_of_refresh_token(db, token: str) -> None:
    """Sign-out by refresh token (the mobile apps): ends the session the token belongs to."""
    if not token:
        return
    doc = await db.refresh_tokens.find_one({"token_hash": _hash(token)}, {"family": 1})
    if doc:
        await end_session(db, doc["family"])


async def retire_refresh_tokens(db, session_id: str | None) -> None:
    """Before issuing a new pair inside a session that is being continued (not rotated)."""
    if session_id:
        await db.refresh_tokens.update_many(
            {"family": session_id, "revoked_at": None}, {"$set": {"revoked_at": _now()}}
        )


async def issue_refresh_token(db, kind: str, subject: str, claims: dict | None = None,
                              family: str | None = None, device: str = "") -> str:
    """kind: 'user' (subject = email) or 'patient' (subject = patient account id).
    `family` is the session id; pass the one the access token carries as `sid`."""
    token = secrets.token_urlsafe(48)
    await db.refresh_tokens.insert_one({
        "token_hash": _hash(token),
        "kind": kind,
        "subject": subject,
        "claims": claims or {},
        "family": family or new_session_id(),
        "device": device[:120],
        "created_at": _now(),
        "expires_at": _now() + timedelta(days=REFRESH_TOKEN_DAYS),
        "revoked_at": None,
    })
    return token


async def consume_refresh_token(db, token: str) -> dict:
    """Validate and retire a refresh token; returns its record so a successor can be issued."""
    if not token:
        raise _INVALID
    doc = await db.refresh_tokens.find_one({"token_hash": _hash(token)})
    if not doc:
        raise _INVALID
    expires_at = doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if doc.get("revoked_at") is not None:
        # Reuse of a retired token: assume it was copied and end the session, access token included.
        await end_session(db, doc["family"])
        raise _INVALID
    if expires_at <= _now():
        raise _INVALID
    # Atomic retire: only one concurrent caller can win the rotation.
    result = await db.refresh_tokens.update_one(
        {"_id": doc["_id"], "revoked_at": None}, {"$set": {"revoked_at": _now()}}
    )
    if result.modified_count != 1:
        raise _INVALID
    return doc


async def revoke_all_sessions(db, kind: str, subject: str) -> None:
    """Called on password change/reset and account deactivation.

    Ends every refresh token and, through `sessions_valid_from`, every access token issued
    before this moment: a stolen or forgotten session stops working at once, not when its
    token would have expired. Tokens issued after the call (the caller's fresh pair) are valid.
    """
    now = _now()
    await db.refresh_tokens.update_many(
        {"kind": kind, "subject": subject, "revoked_at": None}, {"$set": {"revoked_at": now}}
    )
    cutoff = {"$set": {"sessions_valid_from": now.timestamp()}}
    if kind == "user":
        await db.users.update_one({"email": subject}, cutoff)
    elif ObjectId.is_valid(subject):
        await db.patient_accounts.update_one({"_id": ObjectId(subject)}, cutoff)

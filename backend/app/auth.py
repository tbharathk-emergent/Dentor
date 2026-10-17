from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from .db import db
from .sessions import session_ended

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
# For sign-out, which must succeed with or without a usable token.
optional_bearer = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

SUPER_ADMIN_ROLE = "Super Admin"


def is_super_admin(user: dict) -> bool:
    return user.get("role") == SUPER_ADMIN_ROLE


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra: Optional[dict] = None, expires_minutes: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        # Sub-second issue time, so a token can be told apart from a "sessions ended" moment.
        "iat": now.timestamp(),
        "exp": now + timedelta(minutes=expires_minutes or JWT_EXPIRE_MINUTES),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def issued_before(payload: dict, cutoff) -> bool:
    """True when the token predates `cutoff`: the moment its owner's sessions were ended
    (password change or reset). Tokens from before this check existed carry no issue time
    and count as older than any cutoff."""
    return bool(cutoff) and float(payload.get("iat") or 0) < float(cutoff)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str) -> dict:
    """Decode and verify an access token; raises 401 on any problem."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise _credentials_error()
    if not payload.get("sub"):
        raise _credentials_error()
    return payload


def session_id_of(token: str | None) -> str | None:
    """The session a token belongs to, for sign-out. The signature must be ours; an expired
    token still names its session, so a device can close a session it let lapse."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
    except JWTError:
        return None
    return payload.get("sid")


# Token kinds. Staff/consultant/owner tokens have no "typ" (or "user"); the patient app's
# tokens are "patient"; "otp" tickets only prove a verified mobile number for one purpose.
TOKEN_PATIENT = "patient"
TOKEN_OTP_TICKET = "otp"


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if payload.get("typ") not in (None, "user"):
        # A patient (or OTP ticket) token must never open a staff endpoint.
        raise HTTPException(status_code=403, detail="This area is for clinic staff.")

    user = await db.users.find_one({"email": payload["sub"]})
    if not user or user.get("status") in ("Inactive", "Deleted"):
        raise _credentials_error()
    if issued_before(payload, user.get("sessions_valid_from")):
        raise _credentials_error()
    if await session_ended(db, payload.get("sid")):
        raise _credentials_error()
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    user.pop("sessions_valid_from", None)
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super admin access required.")
    return user

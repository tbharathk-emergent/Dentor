"""Joining Dentor and recovering access without help (the designs' sign-up and forgot-password flows).

- A clinic or a consultant applies: verifies their email with a code, fills in the designed four steps
  (KYC, academic, address, finish) and waits. The Super Admin approves or rejects the application in
  the platform console; approval opens the clinic (with the applicant as its owner) or creates the
  consultant's profile and login in the clinic the Super Admin chooses.
- Any staff login with an email can reset a forgotten password with a four-digit code sent by email.

Safeguards: codes are hashed, short-lived and throttled (email_codes.py); answers do not reveal
whether an email has a login; the password is checked against the strong-password rule; a reset
ends every session of the account; the Aadhaar number is never stored, only its last four digits.
"""
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..auth import hash_password
from ..db import db
from ..email_codes import normalize_email, read_email_ticket, send_email_code, verify_email_code
from ..rules import check_password_strength
from ..security import check_login_allowed, record_login_failure
from ..sessions import revoke_all_sessions
from ..util import now_iso, serialize

router = APIRouter(prefix="/api/auth", tags=["sign-up and recovery"])

MAX_FILE_CHARS = 2_800_000  # a data URL of about 2 MB
TEXT_FIELDS = {
    # KYC
    "name": 80, "dob": 10, "mobile": 15, "alternate_mobile": 15, "gst": 20,
    # Academic
    "institution": 120, "graduation_year": 10, "dci_number": 40, "specialisation": 80,
    # Address
    "door": 60, "street": 120, "area": 120, "landmark": 120, "pincode": 6, "city": 60, "state": 60, "country": 60,
    "latitude": 20, "longitude": 20, "clinic_name": 120,
    # Finish
    "experience": 300, "facebook": 160, "instagram": 160, "referral_code": 12,
}
FILE_FIELDS = {"dci_certificate", "clinic_image"}


class EmailBody(BaseModel):
    email: str


class CodeBody(BaseModel):
    email: str
    code: str = Field(min_length=4, max_length=6)


class ResetBody(BaseModel):
    ticket: str
    new_password: str = Field(min_length=8, max_length=128)


class ApplicationBody(BaseModel):
    ticket: str
    kind: str  # "clinic" | "consultant"
    password: str = Field(min_length=8, max_length=128)
    aadhaar: str = ""  # only its last four digits are kept
    profile: dict
    agreed: bool = False


# ----------------------------------------------------------------- forgotten password (staff)

@router.post("/forgot")
async def forgot_password(body: EmailBody, request: Request):
    email = normalize_email(body.email)
    check_login_allowed(request, email)
    user = await db.users.find_one({"email": email})
    if not user or user.get("status") == "Inactive":
        # Same answer either way, so the form does not reveal who has a login.
        return {"sent": True, "length": 4}
    return await send_email_code(db, email, "staff_reset")


@router.post("/forgot/verify")
async def forgot_verify(body: CodeBody, request: Request):
    email = normalize_email(body.email)
    check_login_allowed(request, email)
    try:
        return {"ticket": await verify_email_code(db, email, "staff_reset", body.code)}
    except HTTPException:
        record_login_failure(request, email)
        raise


@router.post("/forgot/reset")
async def forgot_reset(body: ResetBody):
    email = read_email_ticket(body.ticket, "staff_reset")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="This verification cannot be used here. Ask for a new code.")
    strong = True
    if user.get("clinic_id"):
        from ..rules import clinic_settings
        from ..tenancy import TenantDB
        strong = bool((await clinic_settings(TenantDB(db, user["clinic_id"]))).get("strongPassword", True))
    check_password_strength(body.new_password, strong)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(body.new_password), "updated_at": now_iso()}})
    await revoke_all_sessions(db, "user", email)  # every device signs in again with the new password
    return {"ok": True}


# ------------------------------------------------------------------- applying to join (sign-up)

@router.post("/signup/email")
async def signup_email(body: EmailBody, request: Request):
    email = normalize_email(body.email)
    check_login_allowed(request, email)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="This email already has a Dentor login. Sign in instead.")
    if await db.signup_applications.find_one({"email": email, "status": "Pending"}):
        raise HTTPException(status_code=409, detail="An application with this email is already being reviewed.")
    return await send_email_code(db, email, "staff_signup")


@router.post("/signup/verify")
async def signup_verify(body: CodeBody, request: Request):
    email = normalize_email(body.email)
    check_login_allowed(request, email)
    try:
        return {"ticket": await verify_email_code(db, email, "staff_signup", body.code)}
    except HTTPException:
        record_login_failure(request, email)
        raise


def _clean_profile(raw: dict) -> dict:
    out: dict = {}
    for key, limit in TEXT_FIELDS.items():
        value = raw.get(key)
        if value is None:
            continue
        out[key] = str(value).strip()[:limit]
    for key in FILE_FIELDS:
        value = raw.get(key)
        if not value:
            continue
        value = str(value)
        if not value.startswith(("data:image/", "data:application/pdf")) or len(value) > MAX_FILE_CHARS:
            raise HTTPException(status_code=400, detail="Attach a photo or PDF of up to 2 MB.")
        out[key] = value
    return out


@router.post("/signup", status_code=201)
async def signup(body: ApplicationBody):
    email = read_email_ticket(body.ticket, "staff_signup")
    kind = body.kind.strip().lower()
    if kind not in ("clinic", "consultant"):
        raise HTTPException(status_code=400, detail="Choose whether you are joining as a clinic or as a consultant.")
    if not body.agreed:
        raise HTTPException(status_code=400, detail="Accept the terms and conditions to continue.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="This email already has a Dentor login. Sign in instead.")
    if await db.signup_applications.find_one({"email": email, "status": "Pending"}):
        raise HTTPException(status_code=409, detail="An application with this email is already being reviewed.")
    check_password_strength(body.password, True)
    profile = _clean_profile(body.profile or {})
    if len(profile.get("name", "")) < 2:
        raise HTTPException(status_code=400, detail="Enter your full name.")
    if not re.fullmatch(r"[6-9]\d{9}", re.sub(r"\D", "", profile.get("mobile", ""))[-10:]):
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number.")
    if kind == "clinic" and len(profile.get("clinic_name", "")) < 2:
        raise HTTPException(status_code=400, detail="Enter the clinic's name.")
    digits = re.sub(r"\D", "", body.aadhaar or "")
    if digits and len(digits) != 12:
        raise HTTPException(status_code=400, detail="An Aadhaar number has 12 digits.")
    now = now_iso()
    doc = {
        "email": email, "kind": kind, "status": "Pending", "password_hash": hash_password(body.password),
        "profile": profile, "aadhaar_last4": digits[-4:] if digits else "",
        "created_at": now, "updated_at": now,
    }
    result = await db.signup_applications.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "Pending"}


@router.post("/signup/status")
async def signup_status(body: EmailBody):
    """Where an application stands. Only the status and, when rejected, the reason are returned."""
    email = normalize_email(body.email)
    doc = await db.signup_applications.find_one({"email": email}, sort=[("created_at", -1)])
    if not doc:
        return {"status": "None"}
    return {"status": doc["status"], "reason": doc.get("reason", "") if doc["status"] == "Rejected" else ""}


def application_view(doc: dict) -> dict:
    out = serialize({k: v for k, v in doc.items() if k != "password_hash"})
    profile = dict(out.get("profile") or {})
    # files are large; the console fetches them one at a time
    out["files"] = [key for key in FILE_FIELDS if profile.pop(key, None)]
    out["profile"] = profile
    return out

"""Authentication context for the patient app.

A patient signs in to a `patient_accounts` document (identified by a verified mobile
number). The clinical data lives in per-clinic `patients` records; an account may use any
record whose mobile number matches its own. Each access token is pinned to exactly one of
those records, so portal endpoints never take a patient id from the client.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException

from .auth import TOKEN_PATIENT, _credentials_error, create_access_token, decode_token, issued_before, oauth2_scheme
from .config import PATIENT_ACCESS_MINUTES
from .db import db
from .otp import same_mobile, is_test_mobile
from .sessions import issue_refresh_token, new_session_id, session_ended
from .tenancy import TenantDB
from .util import to_object_id


@dataclass
class PatientCtx:
    account: dict
    patient: dict
    clinic: dict
    tdb: TenantDB

    @property
    def code(self) -> str:
        return self.patient.get("code", "")

    @property
    def patient_id(self) -> str:
        return str(self.patient["_id"])


async def get_patient_account(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if payload.get("typ") != TOKEN_PATIENT:
        raise HTTPException(status_code=403, detail="This area is for the Dentor patient app.")
    try:
        account = await db.patient_accounts.find_one({"_id": to_object_id(payload["sub"])})
    except HTTPException:
        raise _credentials_error()
    if not account or account.get("status") in ("Disabled", "Deleted"):
        raise _credentials_error()
    if issued_before(payload, account.get("sessions_valid_from")):
        raise _credentials_error()
    if await session_ended(db, payload.get("sid")):
        raise _credentials_error()
    account["_claims"] = {"pid": payload.get("pid"), "cid": payload.get("cid"), "sid": payload.get("sid")}
    return account


def app_records_only(account: dict) -> bool:
    """A test account (created with the fixed test code) never sees a record clinic staff registered, even one
    with the same mobile number: its number was not proven by a real SMS. Also applies to any account while its
    number is the configured test number."""
    return bool(account.get("test_account")) or is_test_mobile(account.get("mobile"))


def is_test_record(patient: dict) -> bool:
    """A record the test account created itself in the patient app. "created_by" alone is not enough: staff can
    later change the mobile on a record another person made in the app. Staff writes cannot set "test_record"."""
    return patient.get("created_by") == "patient-app" and patient.get("test_record") is True


def may_see_record(account: dict, patient: dict) -> bool:
    return not app_records_only(account) or is_test_record(patient)


async def load_profile(account: dict, clinic_id: str | None, patient_id: str | None) -> tuple[dict, dict] | None:
    """Returns (clinic, patient) if this account may act as that patient record, else None."""
    if not clinic_id or not patient_id:
        return None
    try:
        clinic = await db.clinics.find_one({"_id": to_object_id(clinic_id)})
        patient = await db.patients.find_one({"_id": to_object_id(patient_id), "clinic_id": clinic_id})
    except HTTPException:
        return None
    if not clinic or not patient or clinic.get("status") == "Suspended":
        return None
    # a record registered under another number is yours once you have verified it with that number's code ("Fetch")
    if not same_mobile(patient.get("mobile"), account.get("mobile")) and str(account.get("_id")) not in (patient.get("linked_accounts") or []):
        return None
    if not may_see_record(account, patient):
        return None
    return clinic, patient


async def get_patient_ctx(account: dict = Depends(get_patient_account)) -> PatientCtx:
    claims = account.get("_claims") or {}
    if not claims.get("pid"):
        raise HTTPException(status_code=409, detail="Choose a clinic profile to continue.")
    loaded = await load_profile(account, claims.get("cid"), claims.get("pid"))
    if not loaded:
        raise HTTPException(status_code=403, detail="This profile is no longer available for your mobile number.")
    clinic, patient = loaded
    return PatientCtx(account=account, patient=patient, clinic=clinic, tdb=TenantDB(db, str(clinic["_id"])))


async def list_profiles(account: dict) -> list[dict]:
    """Every patient record, in active clinics, registered with this account's mobile number."""
    mobile = account["mobile"]
    clinics = {str(c["_id"]): c async for c in db.clinics.find({"status": {"$ne": "Suspended"}})}
    out = []
    async for p in db.patients.find({"$or": [{"mobile": {"$regex": f"{mobile}$"}}, {"linked_accounts": str(account["_id"])}]}):
        clinic = clinics.get(p.get("clinic_id") or "")
        if not clinic or not (same_mobile(p.get("mobile"), mobile) or str(account["_id"]) in (p.get("linked_accounts") or [])):
            continue
        if not may_see_record(account, p):
            continue
        out.append({
            "patient_id": str(p["_id"]), "clinic_id": str(clinic["_id"]),
            "name": p.get("name", ""), "code": p.get("code", ""),
            "age": p.get("age"), "gender": p.get("gender", ""), "photo": p.get("photo", ""),
            "clinic_name": clinic.get("name", ""), "clinic_city": clinic.get("city", ""),
        })
    out.sort(key=lambda r: (r["clinic_name"], r["name"]))
    return out


async def issue_patient_tokens(account: dict, clinic_id: str | None, patient_id: str | None,
                               family: str | None = None, device: str = "") -> dict:
    """`family` is the session id: omit it for a new sign-in, pass it to continue a session."""
    session_id = family or new_session_id()
    claims = {"pid": patient_id, "cid": clinic_id} if patient_id else {}
    access = create_access_token(
        str(account["_id"]), {"typ": TOKEN_PATIENT, "sid": session_id, **claims}, expires_minutes=PATIENT_ACCESS_MINUTES
    )
    refresh = await issue_refresh_token(db, "patient", str(account["_id"]), claims, family=session_id, device=device)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def public_account(account: dict) -> dict:
    return {
        "id": str(account["_id"]), "name": account.get("name", ""), "mobile": account.get("mobile", ""),
        "email": account.get("email", ""),
    }

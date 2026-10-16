"""Patient app API.

Every data endpoint depends on `get_patient_ctx`, which pins the request to ONE patient
record taken from the access token. No endpoint accepts a patient id from the client, so a
patient can only ever read or change their own records.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..auth import hash_password, verify_password
from ..config import IS_PROD
from .. import device_credentials
from ..db import db
from ..hooks import PATIENT_APP_CHANNEL, after_appointment, nice_date, nice_time
from ..notify import (
    KIND_PATIENT,
    list_notifications,
    mark_read,
    notify_front_desk,
    notify_roles,
    register_device,
    unregister_device,
)
from ..roles import CLINIC_ADMIN_ROLES
from ..email_codes import normalize_email, read_email_ticket, send_email_code, verify_email_code
from ..otp import is_test_mobile, normalize_mobile, read_ticket, request_otp, same_mobile, verify_otp
from ..patient_auth import (
    PatientCtx,
    app_records_only,
    get_patient_account,
    get_patient_ctx,
    issue_patient_tokens,
    list_profiles,
    load_profile,
    may_see_record,
    public_account,
)
from ..rules import ACTIVE_APPT_STATUSES, clinic_settings, validate_appointment
from ..scheduling import SLOT_TIMES, clinic_now, clinic_today, day_slots, free_chair, is_future, parse_date
from ..security import check_login_allowed, clear_login_failures, rate_limit, record_login_failure
from ..sessions import retire_refresh_tokens, revoke_all_sessions
from ..tenancy import TenantDB
from ..util import next_sequence, now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/patient", tags=["patient app"])

auth_limit = rate_limit("patient-auth", 30, 60)
write_limit = rate_limit("patient-write", 40, 60)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PHOTO_CHARS = 2_000_000
HIDDEN_FIELDS = ("clinic_id", "created_by", "test_record")


def _clean(doc: dict, drop: tuple = ()) -> dict:
    out = serialize(doc)
    for key in (*HIDDEN_FIELDS, *drop):
        out.pop(key, None)
    return out


def _check_patient_password(password: str) -> None:
    if len(password or "") < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Use at least 8 characters with a letter and a number.")


async def _auth_response(account: dict, clinic_id: Optional[str] = None, patient_id: Optional[str] = None,
                         device: str = "", continue_session: Optional[str] = None) -> dict:
    """Tokens pinned to a profile: the requested one, else the last used, else the only one.
    A signed-in caller (profile switch, joining a clinic) passes its session id, so the new
    pair replaces the old one inside the same session and one sign-out ends it."""
    profiles = await list_profiles(account)
    chosen = None
    wanted = [(clinic_id, patient_id), ((account.get("last_profile") or {}).get("cid"), (account.get("last_profile") or {}).get("pid"))]
    for cid, pid in wanted:
        chosen = next((p for p in profiles if p["patient_id"] == pid and p["clinic_id"] == cid), None)
        if chosen:
            break
    if not chosen and profiles:
        chosen = profiles[0]
    if chosen:
        await db.patient_accounts.update_one(
            {"_id": account["_id"]},
            {"$set": {"last_profile": {"cid": chosen["clinic_id"], "pid": chosen["patient_id"]}, "last_login": now_iso()}},
        )
    await retire_refresh_tokens(db, continue_session)
    tokens = await issue_patient_tokens(
        account, chosen["clinic_id"] if chosen else None, chosen["patient_id"] if chosen else None,
        family=continue_session, device=device,
    )
    return {**tokens, "account": public_account(account), "profiles": profiles, "profile": chosen}


# ------------------------------------------------------------------ auth

class OtpRequest(BaseModel):
    mobile: str
    purpose: str = "signup"


class OtpVerify(BaseModel):
    mobile: str
    purpose: str = "signup"
    code: str


class SignupBody(BaseModel):
    ticket: str
    name: str
    password: str
    email: str = ""
    gender: str = ""
    age: Optional[int] = None
    device: str = ""


class LoginBody(BaseModel):
    identifier: str
    password: str
    device: str = ""


class TicketBody(BaseModel):
    ticket: str
    device: str = ""


class ResetBody(BaseModel):
    ticket: str
    new_password: str


@router.post("/auth/otp/request", dependencies=[Depends(auth_limit)])
async def otp_request(body: OtpRequest):
    mobile = normalize_mobile(body.mobile)
    account = await db.patient_accounts.find_one({"mobile": mobile})
    if body.purpose == "signup" and account:
        raise HTTPException(status_code=409, detail="This mobile number is already registered. Log in instead.")
    if body.purpose in ("login", "reset") and not account and not is_test_mobile(mobile):
        # Do not reveal whether a number is registered: answer as if a code was sent. (A test number gets its
        # fixed code anyway, so a tester without an account is told to sign up instead of "wrong code".)
        return {"sent": True, "expires_in": 300, "resend_in": 30}
    return await request_otp(db, mobile, body.purpose)


@router.post("/auth/otp/verify", dependencies=[Depends(auth_limit)])
async def otp_verify(body: OtpVerify):
    mobile = normalize_mobile(body.mobile)
    return {"ticket": await verify_otp(db, mobile, body.purpose, body.code)}


@router.post("/auth/signup", status_code=201, dependencies=[Depends(auth_limit)])
async def signup(body: SignupBody):
    mobile = read_ticket(body.ticket, "signup")
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter your full name.")
    _check_patient_password(body.password)
    email = body.email.lower().strip()
    if email and not re.match(r"^\S+@\S+\.\S+$", email):
        raise HTTPException(status_code=400, detail="Enter a valid email address or leave it empty.")
    if await db.patient_accounts.find_one({"mobile": mobile}):
        raise HTTPException(status_code=409, detail="This mobile number is already registered. Log in instead.")
    if email and await db.patient_accounts.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="This email is already used by another account.")
    doc = {
        "mobile": mobile, "name": name, "password_hash": hash_password(body.password),
        "gender": body.gender.strip(), "age": body.age, "status": "Active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    if email:
        doc["email"] = email
    if is_test_mobile(mobile):
        doc["test_account"] = True  # made with the fixed test code: only ever sees records it creates in the app
    result = await db.patient_accounts.insert_one(doc)
    account = await db.patient_accounts.find_one({"_id": result.inserted_id})
    return await _auth_response(account, device=body.device)


@router.post("/auth/login", dependencies=[Depends(auth_limit)])
async def login(request: Request, body: LoginBody):
    identifier = body.identifier.strip()
    check_login_allowed(request, identifier)
    if "@" in identifier:
        account = await db.patient_accounts.find_one({"email": identifier.lower()})
    else:
        digits = re.sub(r"\D", "", identifier)[-10:]
        account = await db.patient_accounts.find_one({"mobile": digits}) if len(digits) == 10 else None
    if not account or not verify_password(body.password, account.get("password_hash", "")):
        record_login_failure(request, identifier)
        raise HTTPException(status_code=401, detail="Incorrect mobile number or password.")
    clear_login_failures(request, identifier)
    if account.get("status") == "Disabled":
        raise HTTPException(status_code=403, detail="This account is disabled. Contact your clinic.")
    return await _auth_response(account, device=body.device)


class DeviceEnroll(BaseModel):
    device_name: str = ""


class DeviceLogin(BaseModel):
    device_id: str
    secret: str
    device: str = ""


class DeviceRevoke(BaseModel):
    device_id: str


@router.post("/auth/device/enroll")
async def device_enroll(body: DeviceEnroll, account: dict = Depends(get_patient_account)):
    """Turns fingerprint sign-in on for this phone (app/device_credentials.py)."""
    return await device_credentials.enroll(db, "patient", str(account["_id"]), body.device_name)


@router.post("/auth/device/login", dependencies=[Depends(auth_limit)])
async def device_login(body: DeviceLogin):
    doc = await device_credentials.check(db, "patient", body.device_id, body.secret)
    account = await db.patient_accounts.find_one({"_id": to_object_id(doc["subject"])})
    if not account:
        raise HTTPException(status_code=401, detail="Log in with your password.")
    await device_credentials.check(db, "patient", body.device_id, body.secret, account.get("sessions_valid_from"), doc["subject"])
    if account.get("status") == "Disabled":
        raise HTTPException(status_code=403, detail="This account is disabled. Contact your clinic.")
    return await _auth_response(account, device=body.device)


@router.post("/auth/device/revoke")
async def device_revoke(body: DeviceRevoke, account: dict = Depends(get_patient_account)):
    await device_credentials.revoke(db, "patient", str(account["_id"]), body.device_id)
    return {"ok": True}


@router.post("/auth/login-otp", dependencies=[Depends(auth_limit)])
async def login_with_otp(body: TicketBody):
    mobile = read_ticket(body.ticket, "login")
    account = await db.patient_accounts.find_one({"mobile": mobile})
    if not account:
        raise HTTPException(status_code=404, detail="No account found for this number. Please sign up.")
    if account.get("status") == "Disabled":
        raise HTTPException(status_code=403, detail="This account is disabled. Contact your clinic.")
    return await _auth_response(account, device=body.device)


@router.post("/auth/reset-password", dependencies=[Depends(auth_limit)])
async def reset_password(body: ResetBody):
    mobile = read_ticket(body.ticket, "reset")
    account = await db.patient_accounts.find_one({"mobile": mobile})
    if not account:
        raise HTTPException(status_code=404, detail="No account found for this number. Please sign up.")
    _check_patient_password(body.new_password)
    await db.patient_accounts.update_one(
        {"_id": account["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}},
    )
    await revoke_all_sessions(db, "patient", str(account["_id"]))
    return {"ok": True, "message": "Password updated. Log in with your new password."}


class EmailOnly(BaseModel):
    email: str


class EmailCode(BaseModel):
    email: str
    code: str


# The patient design resets a password by email with a four-digit code (patient-app.fig 108:3392 to
# 108:9006). It works for accounts that have an email; the SMS reset above stays for the others.
@router.post("/auth/email/forgot", dependencies=[Depends(auth_limit)])
async def email_forgot(body: EmailOnly):
    email = normalize_email(body.email)
    if not await db.patient_accounts.find_one({"email": email}):
        return {"sent": True, "length": 4}  # same answer: the form does not reveal who has an account
    return await send_email_code(db, email, "patient_reset")


@router.post("/auth/email/verify", dependencies=[Depends(auth_limit)])
async def email_verify(body: EmailCode):
    email = normalize_email(body.email)
    return {"ticket": await verify_email_code(db, email, "patient_reset", body.code)}


@router.post("/auth/email/reset", dependencies=[Depends(auth_limit)])
async def email_reset(body: ResetBody):
    email = read_email_ticket(body.ticket, "patient_reset")
    account = await db.patient_accounts.find_one({"email": email})
    if not account:
        raise HTTPException(status_code=400, detail="This verification cannot be used here. Ask for a new code.")
    _check_patient_password(body.new_password)
    await db.patient_accounts.update_one({"_id": account["_id"]}, {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}})
    await revoke_all_sessions(db, "patient", str(account["_id"]))
    return {"ok": True, "message": "Password updated. Log in with your new password."}


# ------------------------------------------------------- profiles & clinics

class SelectBody(BaseModel):
    patient_id: str
    clinic_id: str


class JoinBody(BaseModel):
    clinic_id: str
    name: str = ""
    age: Optional[int] = None
    gender: str = ""


class FamilyBody(BaseModel):
    name: str
    age: Optional[int] = None
    gender: str = ""
    relation: str = ""


@router.get("/profiles")
async def profiles(account: dict = Depends(get_patient_account)):
    claims = account.get("_claims") or {}
    return {"items": await list_profiles(account), "active": {"pid": claims.get("pid"), "cid": claims.get("cid")}}


@router.post("/profiles/select")
async def select_profile(body: SelectBody, account: dict = Depends(get_patient_account)):
    if not await load_profile(account, body.clinic_id, body.patient_id):
        raise HTTPException(status_code=404, detail="That profile is not registered with your mobile number.")
    return await _auth_response(account, body.clinic_id, body.patient_id,
                                continue_session=(account.get("_claims") or {}).get("sid"))


async def _booking_clinic(clinic_id: str) -> tuple[dict, TenantDB, dict]:
    clinic = await db.clinics.find_one({"_id": to_object_id(clinic_id)})
    if not clinic or clinic.get("status") == "Suspended" or (IS_PROD and clinic.get("is_demo")):
        raise HTTPException(status_code=404, detail="Clinic not found.")
    tdb = TenantDB(db, str(clinic["_id"]))
    settings = await clinic_settings(tdb)
    if not settings.get("onlineBooking", False):
        raise HTTPException(status_code=403, detail=f"{clinic.get('name', 'This clinic')} is not accepting app registrations.")
    return clinic, tdb, settings


async def _create_patient_record(tdb: TenantDB, account: dict, name: str, age, gender: str, relation: str = "") -> dict:
    stamp = now_iso()
    doc = {
        "code": await next_sequence(tdb, "patients", "DEN-", 1050),
        "name": name, "age": age if age is not None else account.get("age") or "",
        "gender": gender or account.get("gender") or "", "mobile": account["mobile"],
        "email": account.get("email", ""), "blood": "", "treatment": "", "doctor": "", "risk": "Low",
        "status": "New", "lastVisit": "", "allergy": "", "history": "", "address": "", "city": "",
        "source": "Patient App", "photo": "", "relation": relation,
        "created_at": stamp, "updated_at": stamp, "created_by": "patient-app",
    }
    if app_records_only(account):
        doc["test_record"] = True
    result = await tdb.patients.insert_one(doc)
    await tdb.activities.insert_one({"type": "patient", "message": f"{name} registered through the patient app",
                                     "at": stamp, "user": "patient-app"})
    await notify_front_desk(db, tdb.clinic_id, "New patient from the app",
                            f"{name} ({doc['code']}) registered through the patient app.", "patient",
                            {"patient_id": str(result.inserted_id), "screen": "patient"})
    return await tdb.patients.find_one({"_id": result.inserted_id})


@router.get("/clinics")
async def clinic_directory(q: str = "", account: dict = Depends(get_patient_account)):
    """Clinics a patient can register with from the app."""
    query: dict = {"status": {"$ne": "Suspended"}}
    if IS_PROD:
        query["is_demo"] = {"$ne": True}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"city": rx}, {"code": rx}]
    items = []
    async for c in db.clinics.find(query).sort("name", 1).limit(50):
        settings = await clinic_settings(TenantDB(db, str(c["_id"])))
        if settings.get("onlineBooking", False):
            items.append({"id": str(c["_id"]), "name": c.get("name", ""), "city": c.get("city", ""),
                          "code": c.get("code", ""), "address": c.get("address", "")})
    return {"items": items}


@router.post("/profiles/join", status_code=201, dependencies=[Depends(write_limit)])
async def join_clinic(body: JoinBody, account: dict = Depends(get_patient_account)):
    clinic, tdb, _ = await _booking_clinic(body.clinic_id)
    existing = [p async for p in tdb.patients.find({"mobile": {"$regex": f"{account['mobile']}$"}})
                if same_mobile(p.get("mobile"), account["mobile"]) and may_see_record(account, p)]
    if existing:
        patient = existing[0]
    else:
        name = (body.name or account.get("name") or "").strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Enter the patient's name.")
        patient = await _create_patient_record(tdb, account, name, body.age, body.gender.strip())
    return await _auth_response(account, str(clinic["_id"]), str(patient["_id"]),
                                continue_session=(account.get("_claims") or {}).get("sid"))


@router.post("/profiles/family", status_code=201, dependencies=[Depends(write_limit)])
async def add_family_member(body: FamilyBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    await _booking_clinic(ctx.tdb.clinic_id)
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter the family member's name.")
    mine = [p async for p in ctx.tdb.patients.find({"mobile": {"$regex": f"{ctx.account['mobile']}$"}})
            if may_see_record(ctx.account, p)]
    if any(p.get("name", "").strip().lower() == name.lower() for p in mine):
        raise HTTPException(status_code=409, detail=f"{name} is already registered on your number.")
    if len(mine) >= 8:
        raise HTTPException(status_code=400, detail="You can manage up to 8 family members on one number.")
    patient = await _create_patient_record(ctx.tdb, ctx.account, name, body.age, body.gender.strip(), body.relation.strip())
    return {"profile": {"patient_id": str(patient["_id"]), "clinic_id": ctx.tdb.clinic_id,
                        "name": patient["name"], "code": patient["code"]}}


# ------------------------------------------------------------- me & home

PROFILE_FIELDS = ("name", "email", "address", "city", "age", "gender", "blood", "emergencyName",
                  "emergencyMobile", "photo", "allergy", "history", "dob")


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood: Optional[str] = None
    dob: Optional[str] = None
    emergencyName: Optional[str] = None
    emergencyMobile: Optional[str] = None
    photo: Optional[str] = None
    allergy: Optional[str] = None
    history: Optional[str] = None


def _profile(patient: dict) -> dict:
    out = {"id": str(patient["_id"])}
    for key in ("code", "mobile", "status", "risk", "doctor", "treatment", "lastVisit", "relation", *PROFILE_FIELDS):
        out[key] = patient.get(key, "")
    return out


async def _clinic_card(ctx: PatientCtx) -> dict:
    settings = await clinic_settings(ctx.tdb)
    c = ctx.clinic
    return {
        "id": str(c["_id"]), "name": settings.get("clinicName") or c.get("name", ""), "code": c.get("code", ""),
        "phone": settings.get("phone") or c.get("phone", ""), "email": settings.get("email") or c.get("email", ""),
        "address": settings.get("address") or c.get("address", ""), "city": c.get("city", ""),
        "online_booking": bool(settings.get("onlineBooking", False)),
    }


@router.get("/me")
async def me(ctx: PatientCtx = Depends(get_patient_ctx)):
    return {"account": public_account(ctx.account), "profile": _profile(ctx.patient),
            "clinic": await _clinic_card(ctx), "profiles": await list_profiles(ctx.account)}


@router.patch("/me", dependencies=[Depends(write_limit)])
async def update_me(body: ProfileUpdate, ctx: PatientCtx = Depends(get_patient_ctx)):
    changes = {k: (v.strip() if isinstance(v, str) else v) for k, v in body.model_dump(exclude_none=True).items()}
    if "name" in changes and len(changes["name"]) < 2:
        raise HTTPException(status_code=400, detail="Enter your full name.")
    if changes.get("email") and not re.match(r"^\S+@\S+\.\S+$", changes["email"]):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if changes.get("emergencyMobile"):
        changes["emergencyMobile"] = normalize_mobile(changes["emergencyMobile"])
    photo = changes.get("photo")
    if photo and (not photo.startswith("data:image/") or len(photo) > MAX_PHOTO_CHARS):
        raise HTTPException(status_code=400, detail="Choose a photo under 1.5 MB.")
    if not changes:
        return _profile(ctx.patient)
    changes["updated_at"] = now_iso()
    await ctx.tdb.patients.update_one({"_id": ctx.patient["_id"]}, {"$set": changes})
    return _profile(await ctx.tdb.patients.find_one({"_id": ctx.patient["_id"]}))


def _own_appointments(ctx: PatientCtx) -> dict:
    return {"$or": [{"patientCode": ctx.code}, {"patientId": ctx.patient_id}]}


def _appointment(a: dict, settings: dict) -> dict:
    out = _clean(a)
    upcoming = a.get("status") == "Scheduled" and is_future(a.get("date", ""), a.get("time", ""), settings)
    out.update({
        "date_label": nice_date(a.get("date")), "time_label": nice_time(a.get("time")),
        "can_cancel": upcoming, "can_reschedule": upcoming,
        "upcoming": a.get("status") in ACTIVE_APPT_STATUSES and a.get("date", "") >= clinic_today(settings),
    })
    return out


@router.get("/home")
async def home(ctx: PatientCtx = Depends(get_patient_ctx)):
    settings = await clinic_settings(ctx.tdb)
    today = clinic_today(settings)
    upcoming = await ctx.tdb.appointments.find(
        {**_own_appointments(ctx), "status": {"$in": list(ACTIVE_APPT_STATUSES)}, "date": {"$gte": today}}
    ).sort([("date", 1), ("time", 1)]).to_list(None)
    invoices = await ctx.tdb.invoices.find({"patientCode": ctx.code}).to_list(None)
    chat = await ctx.tdb.omni_conversations.find_one({"patientId": ctx.code, "channel": PATIENT_APP_CHANNEL})
    notes = await list_notifications(db, ctx.tdb.clinic_id, KIND_PATIENT, ctx.patient_id, limit=1)
    ad_doc = await ctx.tdb.app_settings.find_one({"key": "advertisement"})
    ad = (ad_doc or {}).get("values") or {}
    banner = None
    if ad.get("status") == "Active" and ad.get("audience") == "Patients" and ad.get("title"):
        banner = {"title": ad.get("title"), "subtitle": ad.get("subtitle", ""), "image": ad.get("image", "")}
    last_rx = await ctx.tdb.prescriptions.find_one({"patientCode": ctx.code}, sort=[("created_at", -1)])
    return {
        "profile": _profile(ctx.patient),
        "clinic": await _clinic_card(ctx),
        "next_appointment": _appointment(upcoming[0], settings) if upcoming else None,
        "upcoming_count": len(upcoming),
        "outstanding": sum(float(i.get("balance") or 0) for i in invoices),
        "unread_notifications": notes["unread"],
        "unread_chat": int((chat or {}).get("patientUnread") or 0),
        "pending_consents": await ctx.tdb.patient_consents.count_documents({"patientId": ctx.code, "status": "Pending"}),
        "prescriptions": await ctx.tdb.prescriptions.count_documents({"patientCode": ctx.code}),
        "last_prescription": {"id": str(last_rx["_id"]), "doctor": last_rx.get("doctor", ""),
                              "date": last_rx.get("date", "")} if last_rx else None,
        "banner": banner,
    }


# ------------------------------------------------------------ appointments

class BookBody(BaseModel):
    date: str
    time: str
    doctor: str
    reason: str = ""
    notes: str = ""
    offer_id: str = ""  # booked from an offer: counted on the clinic's "my Post" (dentor.fig 250)


class RescheduleBody(BaseModel):
    date: str
    time: str


class CancelBody(BaseModel):
    reason: str = ""


@router.get("/doctors")
async def doctors(ctx: PatientCtx = Depends(get_patient_ctx)):
    items = await ctx.tdb.consultants.find({"status": {"$ne": "Inactive"}}).sort("name", 1).to_list(None)
    return {"items": [
        {"id": str(c["_id"]), "name": c.get("name", ""), "specialty": c.get("specialty", ""),
         "type": c.get("type", ""), "credentials": c.get("credentials", ""), "experience": c.get("experience", ""),
         "availability": c.get("availability", ""), "fee": c.get("fee", 0), "rating": c.get("rating", 0)}
        for c in items
    ]}


async def _doctor_or_404(ctx: PatientCtx, name: str) -> dict:
    doctor = await ctx.tdb.consultants.find_one({"name": name.strip(), "status": {"$ne": "Inactive"}})
    if not doctor:
        raise HTTPException(status_code=404, detail="That doctor is not available for booking.")
    return doctor


@router.get("/slots")
async def slots(date: str, doctor: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    await _doctor_or_404(ctx, doctor)
    day = parse_date(date)
    return {"date": day, "doctor": doctor,
            "slots": [{**s, "label": nice_time(s["time"])} for s in await day_slots(ctx.tdb, day, doctor.strip())]}


@router.get("/appointments")
async def my_appointments(scope: str = "all", ctx: PatientCtx = Depends(get_patient_ctx)):
    settings = await clinic_settings(ctx.tdb)
    today = clinic_today(settings)
    items = await ctx.tdb.appointments.find(_own_appointments(ctx)).sort([("date", -1), ("time", -1)]).limit(300).to_list(None)
    rows = [_appointment(a, settings) for a in items]
    if scope == "upcoming":
        rows = sorted([r for r in rows if r["upcoming"]], key=lambda r: (r["date"], r["time"]))
    elif scope == "past":
        rows = [r for r in rows if not r["upcoming"]]
    return {"items": rows, "today": today}


async def _own_appointment(ctx: PatientCtx, appointment_id: str) -> dict:
    doc = await ctx.tdb.appointments.find_one({"_id": to_object_id(appointment_id), **_own_appointments(ctx)})
    if not doc:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return doc


@router.get("/appointments/{appointment_id}")
async def appointment_detail(appointment_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    """The appointment, and for a visit that has happened its "Case summary" (patient-app.fig 76:2621): diagnosis,
    procedure, medicines, vitals and the X-rays and reports of that day."""
    a = await _own_appointment(ctx, appointment_id)
    out = _appointment(a, await clinic_settings(ctx.tdb))
    day = a.get("date", "")
    if a.get("status") in ("Completed", "Waiting") and day:
        rx = await ctx.tdb.prescriptions.find_one({"patientCode": ctx.code, "date": day}, sort=[("created_at", -1)])
        done = await ctx.tdb.patient_procedures.find({"patientId": ctx.code, "date": day}).to_list(20)
        treat = await ctx.tdb.patient_treatments.find({"patientId": ctx.code, "date": day}).to_list(20)
        files = await ctx.tdb.patient_files.find({"patientId": ctx.code, "created_at": {"$gte": day, "$lt": day + "T99"}}, {"dataUrl": 0}).to_list(20)
        booking = await ctx.tdb.consultant_bookings.find_one({"_id": to_object_id(a["bookingId"])}) if a.get("bookingId") else None
        vitals = (booking or {}).get("vitals") or ctx.patient.get("vitals") or {}
        out["case"] = {
            "diagnosis": (rx or {}).get("diagnosis", "") or (booking or {}).get("diagnosis", ""),
            "procedure": ", ".join([p.get("name", "") for p in done + treat if p.get("name")]) or (booking or {}).get("treatment_provided", ""),
            "medicines": [f"{m.get('drug', '')} · {m.get('dose', '')} · {m.get('freq', '')} · {m.get('days', '')} {m.get('unit', '')}".strip(" ·") for m in (rx or {}).get("meds") or []],
            "advice": (rx or {}).get("advice", ""),
            "vitals": {"bp": vitals.get("bp", ""), "glucose": vitals.get("glucose", "")},
            "files": [{"id": str(f["_id"]), "name": f.get("name", ""), "category": f.get("category", "")} for f in files],
            "notes": (booking or {}).get("completion_notes", "") or a.get("visitNotes", "") or "",
        }
    return out


async def _require_open_slot(ctx: PatientCtx, date: str, time: str, doctor: str, ignore_id=None) -> dict:
    settings = await clinic_settings(ctx.tdb)
    if not settings.get("onlineBooking", False):
        raise HTTPException(status_code=403, detail="Online booking is turned off for this clinic. Please call the clinic.")
    if time not in SLOT_TIMES:
        raise HTTPException(status_code=400, detail="Choose one of the listed time slots.")
    day = parse_date(date)
    slot = next((s for s in await day_slots(ctx.tdb, day, doctor, ignore_id) if s["time"] == time), None)
    if not slot or not slot["available"]:
        raise HTTPException(status_code=409, detail="That slot was just taken. Please pick another time.")
    return settings


@router.post("/appointments", status_code=201, dependencies=[Depends(write_limit)])
async def book_appointment(body: BookBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    doctor = (await _doctor_or_404(ctx, body.doctor))["name"]
    settings = await _require_open_slot(ctx, body.date, body.time, doctor)
    day = parse_date(body.date)
    clash = await ctx.tdb.appointments.find_one(
        {**_own_appointments(ctx), "date": day, "time": body.time, "status": {"$in": list(ACTIVE_APPT_STATUSES)}}
    )
    if clash:
        raise HTTPException(status_code=409, detail="You already have an appointment at this time.")

    stamp = now_iso()
    payload = {
        "patientId": ctx.patient_id, "patient": ctx.patient.get("name", ""), "patientCode": ctx.code,
        "date": day, "time": body.time, "treatment": body.reason.strip()[:120] or "Consultation",
        "doctor": doctor, "chair": await free_chair(ctx.tdb, day, body.time),
        "duration": f"{settings.get('apptDuration') or '30'} min", "status": "Scheduled",
        "notes": body.notes.strip()[:500], "source": "Patient App",
    }
    await validate_appointment(ctx.tdb, payload, None)
    payload.update({"code": await next_sequence(ctx.tdb, "appointments", "APT-", 5001),
                    "created_at": stamp, "updated_at": stamp, "created_by": "patient-app"})
    result = await ctx.tdb.appointments.insert_one(payload)

    # Two people can pass the availability check at the same instant; the later insert backs out.
    if not settings.get("doubleBooking", False):
        rival = await ctx.tdb.appointments.find_one({
            "_id": {"$lt": result.inserted_id}, "date": day, "time": body.time, "doctor": doctor,
            "status": {"$in": list(ACTIVE_APPT_STATUSES)},
        })
        if rival:
            await ctx.tdb.appointments.delete_one({"_id": result.inserted_id})
            raise HTTPException(status_code=409, detail="That slot was just taken. Please pick another time.")

    doc = await ctx.tdb.appointments.find_one({"_id": result.inserted_id})
    await ctx.tdb.activities.insert_one({
        "type": "booking", "at": stamp, "user": "patient-app",
        "message": f"{payload['patient']} booked {payload['treatment']} with {doctor} via the patient app",
    })
    await after_appointment(ctx.tdb, "create", doc, None, actor="patient")
    if body.offer_id:
        await _mark_offer(ctx, body.offer_id, "booked_by")
    return _appointment(doc, settings)


@router.post("/appointments/{appointment_id}/cancel", dependencies=[Depends(write_limit)])
async def cancel_appointment(appointment_id: str, body: CancelBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    before = await _own_appointment(ctx, appointment_id)
    settings = await clinic_settings(ctx.tdb)
    if before.get("status") != "Scheduled" or not is_future(before.get("date", ""), before.get("time", ""), settings):
        raise HTTPException(status_code=400, detail="This appointment can no longer be cancelled in the app. Please call the clinic.")
    await ctx.tdb.appointments.update_one(
        {"_id": before["_id"]},
        {"$set": {"status": "Cancelled", "cancelReason": body.reason.strip()[:200], "cancelledBy": "patient",
                  "updated_at": now_iso()}},
    )
    doc = await ctx.tdb.appointments.find_one({"_id": before["_id"]})
    await ctx.tdb.activities.insert_one({"type": "booking", "at": now_iso(), "user": "patient-app",
                                         "message": f"{doc.get('patient', '')} cancelled an appointment via the patient app"})
    await after_appointment(ctx.tdb, "update", doc, before, actor="patient")
    return _appointment(doc, settings)


@router.post("/appointments/{appointment_id}/reschedule", dependencies=[Depends(write_limit)])
async def reschedule_appointment(appointment_id: str, body: RescheduleBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    before = await _own_appointment(ctx, appointment_id)
    settings = await clinic_settings(ctx.tdb)
    if before.get("status") != "Scheduled" or not is_future(before.get("date", ""), before.get("time", ""), settings):
        raise HTTPException(status_code=400, detail="This appointment can no longer be changed in the app. Please call the clinic.")
    await _require_open_slot(ctx, body.date, body.time, before.get("doctor", ""), ignore_id=before["_id"])
    day = parse_date(body.date)
    changes = {"date": day, "time": body.time, "chair": await free_chair(ctx.tdb, day, body.time, before["_id"])}
    await validate_appointment(ctx.tdb, changes, before)
    await ctx.tdb.appointments.update_one({"_id": before["_id"]}, {"$set": {**changes, "updated_at": now_iso()}})
    doc = await ctx.tdb.appointments.find_one({"_id": before["_id"]})
    await after_appointment(ctx.tdb, "update", doc, before, actor="patient")
    return _appointment(doc, settings)


# ------------------------------------------------- records, reports, consents

@router.get("/records")
async def dental_records(ctx: PatientCtx = Depends(get_patient_ctx)):
    """Treatments, procedures, timeline, dental chart and lab work for this patient."""
    own = {"patientId": ctx.code}
    chart = await ctx.tdb.charts.find_one({**own, "type": "dental"})
    return {
        "treatments": [_clean(d) for d in await ctx.tdb.patient_treatments.find(own).sort("date", -1).to_list(None)],
        "procedures": [_clean(d) for d in await ctx.tdb.patient_procedures.find(own).sort("date", -1).to_list(None)],
        "timeline": [_clean(d) for d in await ctx.tdb.patient_timeline.find(own).sort("date", -1).to_list(None)],
        "teeth": (chart or {}).get("teeth") or {},
        "lab_orders": [
            {"id": str(o["_id"]), "code": o.get("code", ""), "caseType": o.get("caseType", ""), "teeth": o.get("teeth", ""),
             "stage": o.get("stage", ""), "status": o.get("status", ""), "due": o.get("due", "")}
            for o in await ctx.tdb.lab_orders.find({"patientCode": ctx.code}).sort("created_at", -1).to_list(None)
        ],
    }


@router.get("/prescriptions")
async def prescriptions(ctx: PatientCtx = Depends(get_patient_ctx)):
    items = await ctx.tdb.prescriptions.find({"patientCode": ctx.code}).sort("created_at", -1).to_list(None)
    return {"items": [_clean(d) for d in items]}


@router.get("/prescriptions/{prescription_id}")
async def prescription_detail(prescription_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    doc = await ctx.tdb.prescriptions.find_one({"_id": to_object_id(prescription_id), "patientCode": ctx.code})
    if not doc:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return {**_clean(doc), "clinic": await _clinic_card(ctx)}


class UploadBody(BaseModel):
    name: str
    dataUrl: str
    category: str = "Patient Upload"
    size: int = 0


@router.get("/reports")
async def reports(ctx: PatientCtx = Depends(get_patient_ctx)):
    """X-rays, reports and documents. Listing omits the file content to keep it light."""
    rows = await ctx.tdb.patient_files.aggregate([
        {"$match": {"patientId": ctx.code}},
        {"$sort": {"created_at": -1}},
        {"$project": {"name": 1, "category": 1, "size": 1, "created_at": 1, "uploadedBy": 1,
                      "head": {"$substrCP": [{"$ifNull": ["$dataUrl", ""]}, 0, 48]}}},
    ]).to_list(None)
    items = []
    for r in rows:
        head = r.get("head") or ""
        mime = head[5:].split(";")[0] if head.startswith("data:") else ""
        items.append({"id": str(r["_id"]), "name": r.get("name", ""), "category": r.get("category", ""),
                      "size": r.get("size", 0), "created_at": r.get("created_at", ""), "mime": mime,
                      "is_image": mime.startswith("image/"), "mine": r.get("uploadedBy") == "patient"})
    return {"items": items}


@router.get("/reports/{file_id}")
async def report_detail(file_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    doc = await ctx.tdb.patient_files.find_one({"_id": to_object_id(file_id), "patientId": ctx.code})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found.")
    return _clean(doc)


@router.post("/reports", status_code=201, dependencies=[Depends(write_limit)])
async def upload_report(body: UploadBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    name = body.name.strip()[:120]
    if not name:
        raise HTTPException(status_code=400, detail="Give the file a name.")
    match = re.match(r"^data:(image/(png|jpe?g|webp|heic)|application/pdf);base64,", body.dataUrl[:64])
    if not match:
        raise HTTPException(status_code=400, detail="Upload a photo (PNG/JPG) or a PDF.")
    if len(body.dataUrl) * 3 // 4 > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Files must be 5 MB or smaller.")
    stamp = now_iso()
    result = await ctx.tdb.patient_files.insert_one({
        "patientId": ctx.code, "name": name, "category": "Patient Upload", "size": body.size or len(body.dataUrl) * 3 // 4,
        "dataUrl": body.dataUrl, "uploadedBy": "patient", "created_at": stamp, "updated_at": stamp, "created_by": "patient-app",
    })
    return {"id": str(result.inserted_id), "name": name}


@router.delete("/reports/{file_id}", dependencies=[Depends(write_limit)])
async def delete_report(file_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    result = await ctx.tdb.patient_files.delete_one(
        {"_id": to_object_id(file_id), "patientId": ctx.code, "uploadedBy": "patient"}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="You can only delete files you uploaded.")
    return {"ok": True}


@router.get("/consents")
async def consents(ctx: PatientCtx = Depends(get_patient_ctx)):
    items = await ctx.tdb.patient_consents.find({"patientId": ctx.code}).sort("date", -1).to_list(None)
    return {"items": [_clean(d) for d in items]}


@router.post("/consents/{consent_id}/sign", dependencies=[Depends(write_limit)])
async def sign_consent(consent_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    doc = await ctx.tdb.patient_consents.find_one({"_id": to_object_id(consent_id), "patientId": ctx.code})
    if not doc:
        raise HTTPException(status_code=404, detail="Consent form not found.")
    if doc.get("status") != "Pending":
        raise HTTPException(status_code=400, detail=f"This consent is already {str(doc.get('status', '')).lower()}.")
    await ctx.tdb.patient_consents.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "Signed", "signedAt": now_iso(), "signedVia": "Patient App",
                  "signedBy": ctx.account.get("name", ""), "updated_at": now_iso()}},
    )
    return _clean(await ctx.tdb.patient_consents.find_one({"_id": doc["_id"]}))


# ---------------------------------------------------------------- payments

@router.get("/invoices")
async def invoices(ctx: PatientCtx = Depends(get_patient_ctx)):
    items = await ctx.tdb.invoices.find({"patientCode": ctx.code}).sort("date", -1).to_list(None)
    payments = await ctx.tdb.payments.find({"patientCode": ctx.code}).sort("date", -1).to_list(None)
    return {
        "items": [_clean(d) for d in items],
        "payments": [_clean(p, drop=("entered_by",)) for p in payments],
        "summary": {
            "billed": sum(float(i.get("total") or 0) for i in items),
            "paid": sum(float(i.get("paid") or 0) for i in items),
            "outstanding": sum(float(i.get("balance") or 0) for i in items),
        },
    }


@router.get("/invoices/{invoice_id}")
async def invoice_detail(invoice_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    doc = await ctx.tdb.invoices.find_one({"_id": to_object_id(invoice_id), "patientCode": ctx.code})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    payments = await ctx.tdb.payments.find(
        {"patientCode": ctx.code, "$or": [{"invoice_id": invoice_id}, {"invoice": doc.get("number", "")}]}
    ).sort("date", -1).to_list(None)
    return {**_clean(doc), "payments": [_clean(p, drop=("entered_by",)) for p in payments],
            "clinic": await _clinic_card(ctx)}


# -------------------------------------------------------------------- chat

class ChatBody(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


def _chat_messages(conversation: dict | None) -> list[dict]:
    out = []
    for m in (conversation or {}).get("messages") or []:
        if isinstance(m, (list, tuple)) and len(m) >= 2:
            out.append({"mine": m[0] == "in", "text": m[1], "time": m[2] if len(m) > 2 else "",
                        "at": m[3] if len(m) > 3 else ""})
    return out


@router.get("/chat")
async def chat(ctx: PatientCtx = Depends(get_patient_ctx)):
    """The patient's thread with the clinic front desk (the reception Omnichannel inbox)."""
    query = {"patientId": ctx.code, "channel": PATIENT_APP_CHANNEL}
    conversation = await ctx.tdb.omni_conversations.find_one(query)
    if conversation and conversation.get("patientUnread"):
        await ctx.tdb.omni_conversations.update_one({"_id": conversation["_id"]}, {"$set": {"patientUnread": 0}})
    return {"messages": _chat_messages(conversation), "clinic": await _clinic_card(ctx),
            "status": (conversation or {}).get("status", "Open")}


@router.post("/chat", status_code=201, dependencies=[Depends(write_limit)])
async def send_chat(body: ChatBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Type a message first.")
    settings = await clinic_settings(ctx.tdb)
    now = clinic_now(settings)
    entry = ["in", text, now.strftime("%I:%M %p").lstrip("0"), now_iso()]
    query = {"patientId": ctx.code, "channel": PATIENT_APP_CHANNEL}
    conversation = await ctx.tdb.omni_conversations.find_one(query)
    if conversation:
        await ctx.tdb.omni_conversations.update_one(
            {"_id": conversation["_id"]},
            {"$push": {"messages": entry}, "$inc": {"unread": 1},
             "$set": {"status": "Open", "time": entry[2], "updated_at": now_iso()}},
        )
    else:
        mobile = ctx.account["mobile"]
        await ctx.tdb.omni_conversations.insert_one({
            **query, "name": ctx.patient.get("name", ""), "time": entry[2], "unread": 1, "patientUnread": 0,
            "status": "Open", "assigned": "Reception", "phone": f"+91 {mobile[:5]} {mobile[5:]}",
            "topic": "Patient app chat", "consent": "Opted-in", "messages": [entry],
            "created_at": now_iso(), "updated_at": now_iso(), "created_by": "patient-app",
        })
    conversation = await ctx.tdb.omni_conversations.find_one(query)
    return {"messages": _chat_messages(conversation)}


# ----------------------------------------------------------------- reviews

REVIEW_TAGS = ("Clean Clinic", "Friendly Doctor", "Good Explanation", "Painless Treatment", "Affordable", "On time service")


class ReviewBody(BaseModel):
    subject: str = "clinic"  # "clinic" or a doctor's name
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=3, max_length=1000)
    visit: str = ""
    # The quick tags and the "would you recommend us" answer of the app's review form.
    tags: list[str] = Field(default_factory=list, max_length=len(REVIEW_TAGS))
    recommend: bool | None = None


@router.get("/reviews")
async def my_reviews(ctx: PatientCtx = Depends(get_patient_ctx)):
    items = await ctx.tdb.reviews.find({"patientId": ctx.code, "source": "patient-app"}).sort("created_at", -1).to_list(None)
    return {"items": [_clean(d, drop=("moderationNote", "moderated")) for d in items]}


@router.post("/reviews", status_code=201, dependencies=[Depends(write_limit)])
async def submit_review(body: ReviewBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    settings = await clinic_settings(ctx.tdb)
    now = clinic_now(settings)
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent = await ctx.tdb.reviews.count_documents(
        {"patientId": ctx.code, "source": "patient-app", "created_at": {"$gte": since}}
    )
    if recent >= 3:
        raise HTTPException(status_code=429, detail="You have shared several reviews today. Please try again tomorrow.")
    clinic = await _clinic_card(ctx)
    if body.subject.strip().lower() in ("", "clinic"):
        kind, subject = "Clinic", clinic["name"]
    else:
        kind, subject = "Consultant", (await _doctor_or_404(ctx, body.subject))["name"]
    stamp = now_iso()
    result = await ctx.tdb.reviews.insert_one({
        "code": await next_sequence(ctx.tdb, "reviews", "RV-", 26056),
        "type": kind, "subject": subject, "reviewer": ctx.patient.get("name", ""),
        "location": ctx.patient.get("city") or clinic["city"], "rating": body.rating, "status": "Pending",
        "date": now.strftime("%d %b %Y"), "dateISO": now.date().isoformat(), "channel": "DENTOR App",
        "text": body.text.strip(), "visit": body.visit.strip()[:120],
        "tags": [tag for tag in REVIEW_TAGS if tag in body.tags], "recommend": body.recommend,
        "sentiment": "Positive" if body.rating >= 4 else "Neutral" if body.rating == 3 else "Negative",
        "response": "", "moderationNote": "", "patientId": ctx.code, "source": "patient-app",
        "created_at": stamp, "updated_at": stamp, "created_by": "patient-app",
    })
    await notify_roles(db, ctx.tdb.clinic_id, CLINIC_ADMIN_ROLES, "New review awaiting approval",
                       f"{ctx.patient.get('name', 'A patient')} rated {subject} {body.rating}★.", "review", {"screen": "reviews"})
    return _clean(await ctx.tdb.reviews.find_one({"_id": result.inserted_id}), drop=("moderationNote",))


# ----------------------------------------------------------- notifications

class ReadBody(BaseModel):
    ids: Optional[list[str]] = None


class DeviceBody(BaseModel):
    token: str
    platform: str = ""


@router.get("/notifications")
async def notifications(ctx: PatientCtx = Depends(get_patient_ctx)):
    return await list_notifications(db, ctx.tdb.clinic_id, KIND_PATIENT, ctx.patient_id)


@router.post("/notifications/read")
async def read_notifications(body: ReadBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    return {"updated": await mark_read(db, ctx.tdb.clinic_id, KIND_PATIENT, ctx.patient_id, body.ids)}


@router.post("/devices")
async def add_device(body: DeviceBody, account: dict = Depends(get_patient_account)):
    await register_device(db, KIND_PATIENT, str(account["_id"]), body.token, body.platform)
    return {"ok": True}


@router.post("/devices/remove")
async def remove_device(body: DeviceBody, account: dict = Depends(get_patient_account)):
    await unregister_device(db, body.token)
    return {"ok": True}


# ----------------------------------------------------------------- account

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountBody(BaseModel):
    password: str


@router.post("/account/change-password", dependencies=[Depends(auth_limit)])
async def change_password(request: Request, body: ChangePasswordBody, account: dict = Depends(get_patient_account)):
    check_login_allowed(request, account["mobile"])
    if not verify_password(body.current_password, account.get("password_hash", "")):
        record_login_failure(request, account["mobile"])
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    clear_login_failures(request, account["mobile"])
    _check_patient_password(body.new_password)
    await db.patient_accounts.update_one(
        {"_id": account["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}},
    )
    await revoke_all_sessions(db, "patient", str(account["_id"]))
    claims = account.get("_claims") or {}
    return await _auth_response(account, claims.get("cid"), claims.get("pid"))


@router.post("/account/delete", dependencies=[Depends(auth_limit)])
async def delete_account(body: DeleteAccountBody, account: dict = Depends(get_patient_account)):
    """Removes the app login. Clinical records stay with the clinic, which must retain them."""
    if not verify_password(body.password, account.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Password is incorrect.")
    await revoke_all_sessions(db, "patient", str(account["_id"]))
    await db.device_tokens.delete_many({"owner_kind": KIND_PATIENT, "owner_id": str(account["_id"])})
    await db.patient_accounts.delete_one({"_id": account["_id"]})
    return {"ok": True}



# -------------------------------------------------------------------- offers

def _offer_view(o: dict) -> dict:
    value = o.get("value", 0)
    shown = int(value) if float(value).is_integer() else value
    return {"id": str(o["_id"]), "title": o.get("title", ""), "treatment": o.get("treatment", ""), "category": o.get("category", ""),
            "discount": f"{shown}% off" if o.get("discount_type") == "percentage" else f"₹{shown} off", "valid_till": o.get("valid_till", ""),
            "valid_label": nice_date(o.get("valid_till"))}


async def _mark_offer(ctx: PatientCtx, offer_id: str, field: str) -> None:
    try:
        oid = to_object_id(offer_id)
    except HTTPException:
        return
    entry = {"pid": ctx.patient_id, "name": ctx.patient.get("name", ""), "code": ctx.code, "at": now_iso()}
    await ctx.tdb.offers.update_one({"_id": oid, f"{field}.pid": {"$ne": ctx.patient_id}}, {"$push": {field: entry}})


@router.get("/offers")
async def offers(ctx: PatientCtx = Depends(get_patient_ctx)):
    """The clinic's current offers (patient-app.fig offers; sent by the clinic from the Clinic app)."""
    today = clinic_today(await clinic_settings(ctx.tdb))
    items = await ctx.tdb.offers.find({"status": "Sent", "valid_till": {"$gte": today}}).sort("sent_at", -1).to_list(50)
    return {"items": [_offer_view(o) for o in items]}


@router.post("/offers/{offer_id}/view")
async def view_offer(offer_id: str, ctx: PatientCtx = Depends(get_patient_ctx)):
    await _mark_offer(ctx, offer_id, "viewed_by")
    return {"ok": True}



# -------------------------------------------------------- fetch by patient id

class FetchBody(BaseModel):
    clinic_id: str
    patient_code: str = Field(..., max_length=20)


class FetchVerify(FetchBody):
    code: str = Field(..., min_length=4, max_length=8)


async def _fetch_target(account: dict, body: FetchBody) -> tuple[dict, dict, TenantDB]:
    clinic, tdb, _ = await _booking_clinic(body.clinic_id)
    patient = await tdb.patients.find_one({"code": body.patient_code.strip().upper()})
    if not patient or not normalize_mobile(patient.get("mobile")):
        raise HTTPException(status_code=404, detail="No patient with that ID at this clinic. Check the ID on your card or bill.")
    return clinic, patient, tdb


@router.post("/profiles/fetch", dependencies=[Depends(auth_limit)])
async def fetch_profile(body: FetchBody, account: dict = Depends(get_patient_account)):
    """"FETCH" (patient-app.fig 98:1076): bring in a record registered under another mobile number — a child's,
    or an old number — by its patient ID. A code goes to that record's registered number; nothing is shown before."""
    _, patient, _ = await _fetch_target(account, body)
    if (same_mobile(patient.get("mobile"), account.get("mobile")) and may_see_record(account, patient)) \
            or str(account["_id"]) in (patient.get("linked_accounts") or []):
        raise HTTPException(status_code=409, detail="This record is already in your profiles.")
    mobile = normalize_mobile(patient.get("mobile"))
    sent = await request_otp(db, mobile, "link")
    return {**sent, "sent_to": f"******{mobile[-4:]}"}


@router.post("/profiles/fetch/verify", status_code=201, dependencies=[Depends(auth_limit)])
async def fetch_verify(body: FetchVerify, account: dict = Depends(get_patient_account)):
    clinic, patient, tdb = await _fetch_target(account, body)
    mobile = normalize_mobile(patient.get("mobile"))
    read_ticket(await verify_otp(db, mobile, "link", body.code), "link")
    await tdb.patients.update_one({"_id": patient["_id"]}, {"$addToSet": {"linked_accounts": str(account["_id"])}})
    return await _auth_response(account, str(clinic["_id"]), str(patient["_id"]), continue_session=(account.get("_claims") or {}).get("sid"))



# ----------------------------------------------------------- notification settings

class PatientPrefs(BaseModel):
    general: bool = True
    sound: bool = True
    vibrate: bool = True
    appointment_reminders: bool = True
    medicine_alerts: bool = True
    lab_alerts: bool = True


@router.get("/account/prefs")
async def get_prefs(account: dict = Depends(get_patient_account)):
    """"Notification Settings" (patient-app.fig 96:803)."""
    return {**PatientPrefs().model_dump(), **(account.get("prefs") or {})}


@router.put("/account/prefs")
async def set_prefs(body: PatientPrefs, account: dict = Depends(get_patient_account)):
    await db.patient_accounts.update_one({"_id": account["_id"]}, {"$set": {"prefs": body.model_dump(), "updated_at": now_iso()}})
    return body.model_dump()


# ------------------------------------------------------------------ callbacks

class CallbackBody(BaseModel):
    when: str = Field("", max_length=40)
    note: str = Field("", max_length=300)


@router.post("/callback", status_code=201, dependencies=[Depends(write_limit)])
async def request_callback(body: CallbackBody, ctx: PatientCtx = Depends(get_patient_ctx)):
    """"Request Callback" (patient-app.fig "SCHEDULER" 18:163): the front desk is asked to call the patient."""
    from ..notify import notify_front_desk
    recent = await ctx.tdb.callback_requests.find_one({"patientId": ctx.patient_id, "status": "Open"})
    if recent:
        raise HTTPException(status_code=409, detail="The clinic already has your callback request. They will call you soon.")
    stamp = now_iso()
    await ctx.tdb.callback_requests.insert_one({"patientId": ctx.patient_id, "patient": ctx.patient.get("name", ""), "patientCode": ctx.code,
                                                "mobile": ctx.patient.get("mobile", ""), "when": body.when.strip(), "note": body.note.strip(),
                                                "status": "Open", "created_at": stamp})
    await notify_front_desk(db, ctx.tdb.clinic_id, "Callback requested", f"{ctx.patient.get('name', '')} ({ctx.patient.get('mobile', '')}) asked for a call"
                            f"{' ' + body.when.strip() if body.when.strip() else ''}.{(' ' + body.note.strip()) if body.note.strip() else ''}", "callback",
                            {"patient_code": ctx.code, "screen": "patient"})
    return {"ok": True, "message": "The clinic will call you back."}

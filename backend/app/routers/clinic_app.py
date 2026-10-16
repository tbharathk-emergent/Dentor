"""Dentor Clinic app: appointments and patients (dentor.fig "My Appointments", "Schedule",
"Reschedule", "Time Swap", "Cancel", "Monthly", "Drafts", "Patients", "Add Patient", the patient
dashboard and its tabs).

Front-desk roles (owner, administrator, dentist, receptionist) book and change appointments and add
patients; an accountant may read them. Accounts figures in a patient's dashboard are shown to the
roles that may see money. Everything works on the same clinic collections the reception web app uses,
so a booking made here appears there at once and the other way round.
"""
import re
from datetime import date as date_cls, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..hooks import after_appointment, nice_date, nice_time
from ..roles import CLINIC_APP_ROLES, FINANCE_ROLES, FRONT_DESK_ROLES, has_role, require_roles
from ..rules import ACTIVE_APPT_STATUSES, clinic_settings, validate_appointment
from ..scheduling import SLOT_TIMES, clinic_today, day_slots, free_chair, parse_date
from ..tenancy import TenantDB, get_tenant
from ..util import next_sequence, now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/clinic-app", tags=["clinic app"],
                   dependencies=[Depends(require_roles(CLINIC_APP_ROLES, "This login cannot use the Dentor Clinic app."))])
front_desk = Depends(require_roles(FRONT_DESK_ROLES, "Your role can see appointments and patients but not change them."))

DRAFT = "Draft"
SCOPES = ("today", "upcoming", "past", "drafts", "cancelled", "all")
MOBILE_RE = re.compile(r"^[6-9]\d{9}$")


def _oid(value: str) -> ObjectId:
    try:
        return to_object_id(value)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found.")


def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


async def _doctor_types(tdb: TenantDB) -> dict[str, dict]:
    return {c["name"]: c async for c in tdb.consultants.find({}, {"name": 1, "type": 1, "specialty": 1, "status": 1})}


def _appointment(a: dict, doctors: dict[str, dict], settings: dict) -> dict:
    doc = doctors.get(a.get("doctor", ""), {})
    status = a.get("status", "Scheduled")
    return {
        "id": str(a["_id"]), "code": a.get("code", ""), "patient": a.get("patient", ""), "patient_code": a.get("patientCode", ""),
        "date": a.get("date", ""), "date_label": nice_date(a.get("date")), "time": a.get("time", ""), "time_label": nice_time(a.get("time")),
        "treatment": a.get("treatment", ""), "doctor": a.get("doctor", ""), "chair": a.get("chair", ""), "status": status,
        "kind": "consultant" if doc.get("type") == "Visiting" else "in-house", "specialty": doc.get("specialty", ""),
        "source": a.get("source", "") or "Front desk", "notes": a.get("notes", ""), "duration": a.get("duration", ""),
        "cancel_reason": a.get("cancelReason", ""), "refund_note": a.get("refundNote", ""),
        "reschedule_reason": a.get("rescheduleReason", ""),
        # the design's "ORIGINAL DATE" on a rescheduled card
        "rescheduled_from": {"date": (a.get("rescheduledFrom") or {}).get("date", ""), "time": (a.get("rescheduledFrom") or {}).get("time", ""),
                             "date_label": nice_date((a.get("rescheduledFrom") or {}).get("date")), "time_label": nice_time((a.get("rescheduledFrom") or {}).get("time"))}
        if a.get("rescheduledFrom") else None,
        # drafts, and booked appointments from today on, can be moved, swapped or cancelled
        "changeable": status == DRAFT or (status in ACTIVE_APPT_STATUSES and a.get("date", "") >= clinic_today(settings)),
    }


# ---------------------------------------------------------------- appointments

@router.get("/appointments")
async def list_appointments(scope: str = "upcoming", kind: Optional[str] = None, q: str = "", date: Optional[str] = None,
                            date_from: Optional[str] = None, date_to: Optional[str] = None, rescheduled: bool = False,
                            limit: int = Query(100, ge=1, le=500), tdb: TenantDB = Depends(get_tenant)):
    """scope: today | upcoming | past | drafts | cancelled | all; kind: in-house | consultant; date: one day;
    date_from / date_to: a range (the web's week view); rescheduled: only those moved from their first time."""
    if scope not in SCOPES:
        raise HTTPException(status_code=400, detail=f"scope must be one of {', '.join(SCOPES)}.")
    settings = await clinic_settings(tdb)
    today = clinic_today(settings)
    query: dict = {}
    order = 1
    if date:
        query["date"] = parse_date(date)
        query["status"] = {"$ne": DRAFT}
    elif date_from and date_to:
        query["date"] = {"$gte": parse_date(date_from), "$lte": parse_date(date_to)}
        query["status"] = {"$ne": DRAFT}
    elif scope == "today":
        query.update({"date": today, "status": {"$nin": [DRAFT]}})
    elif scope == "upcoming":
        query.update({"date": {"$gte": today}, "status": {"$in": list(ACTIVE_APPT_STATUSES)}})
    elif scope == "past":
        query.update({"$or": [{"date": {"$lt": today}}, {"status": "Completed"}], "status": {"$nin": [DRAFT, "Cancelled"]}})
        order = -1
    elif scope == "drafts":
        query["status"] = DRAFT
        order = -1
    elif scope == "cancelled":
        query["status"] = "Cancelled"
        order = -1
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query.setdefault("$and", []).append({"$or": [{"patient": rx}, {"patientCode": rx}, {"code": rx}, {"treatment": rx}, {"doctor": rx}]})
    if rescheduled:
        query["rescheduledFrom"] = {"$exists": True}
    doctors = await _doctor_types(tdb)
    if kind in ("in-house", "consultant"):
        visiting = [n for n, d in doctors.items() if d.get("type") == "Visiting"]
        query.setdefault("$and", []).append({"doctor": {"$in": visiting}} if kind == "consultant" else {"doctor": {"$nin": visiting}})
    items = await tdb.appointments.find(query).sort([("date", order), ("time", order)]).limit(limit).to_list(None)
    counts = {
        "today": await tdb.appointments.count_documents({"date": today, "status": {"$ne": DRAFT}}),
        "upcoming": await tdb.appointments.count_documents({"date": {"$gte": today}, "status": {"$in": list(ACTIVE_APPT_STATUSES)}}),
        "drafts": await tdb.appointments.count_documents({"status": DRAFT}),
    }
    return {"today": today, "items": [_appointment(a, doctors, settings) for a in items], "counts": counts}


@router.get("/appointments/month")
async def month(month: str, tdb: TenantDB = Depends(get_tenant)):
    """The monthly view: appointments per day (not drafts or cancelled) for yyyy-mm."""
    if not re.fullmatch(r"\d{4}-\d{2}", month or ""):
        raise HTTPException(status_code=400, detail="month must look like 2026-10.")
    start = date_cls.fromisoformat(f"{month}-01")
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    days: dict[str, int] = {}
    async for a in tdb.appointments.find({"date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
                                          "status": {"$nin": [DRAFT, "Cancelled"]}}, {"date": 1}):
        days[a["date"]] = days.get(a["date"], 0) + 1
    return {"month": month, "first": start.isoformat(), "last": end.isoformat(), "days": days,
            "today": clinic_today(await clinic_settings(tdb))}


@router.get("/doctors")
async def doctors(tdb: TenantDB = Depends(get_tenant)):
    items = await tdb.consultants.find({"status": {"$ne": "Inactive"}}).sort("name", 1).to_list(None)
    return {"items": [{"id": str(c["_id"]), "name": c.get("name", ""), "specialty": c.get("specialty", ""),
                       "kind": "consultant" if c.get("type") == "Visiting" else "in-house"} for c in items]}


@router.get("/slots")
async def slots(date: str, doctor: str, ignore: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """The day's half-hour slots for a doctor (09:00–17:30), as the reception calendar has them."""
    day = parse_date(date)
    ignore_id = _oid(ignore) if ignore else None
    return {"date": day, "doctor": doctor, "slots": await day_slots(tdb, day, doctor, ignore_id)}


async def _patient(tdb: TenantDB, patient_id: str) -> dict:
    found = await tdb.patients.find_one({"_id": _oid(patient_id)})
    if not found:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return found


async def _doctor(tdb: TenantDB, name: str) -> dict:
    found = await tdb.consultants.find_one({"name": name, "status": {"$ne": "Inactive"}})
    if not found:
        raise HTTPException(status_code=400, detail="Choose a doctor from the list.")
    return found


async def _open_slot(tdb: TenantDB, day: str, time: str, doctor: str, ignore_id=None) -> None:
    if time not in SLOT_TIMES:
        raise HTTPException(status_code=400, detail="Choose one of the listed time slots.")
    slot = next((s for s in await day_slots(tdb, day, doctor, ignore_id) if s["time"] == time), None)
    if not slot or not slot["available"]:
        raise HTTPException(status_code=409, detail="That slot is not free. Pick another time.")


class BookBody(BaseModel):
    patient_id: str
    doctor: str
    date: str = ""
    time: str = ""
    treatment: str = Field("", max_length=120)
    notes: str = Field("", max_length=500)
    draft: bool = False


async def _get(tdb: TenantDB, appointment_id: str) -> dict:
    found = await tdb.appointments.find_one({"_id": _oid(appointment_id)})
    if not found:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return found


async def _answer(tdb: TenantDB, doc: dict) -> dict:
    return _appointment(doc, await _doctor_types(tdb), await clinic_settings(tdb))


@router.post("/appointments", status_code=201, dependencies=[front_desk])
async def book(body: BookBody, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """Books a patient into a free slot, or keeps the form as a draft (no slot is held)."""
    patient = await _patient(tdb, body.patient_id)
    doctor = (await _doctor(tdb, body.doctor.strip()))["name"]
    settings = await clinic_settings(tdb)
    day = parse_date(body.date) if body.date else ""
    if not body.draft:
        if not day or not body.time:
            raise HTTPException(status_code=400, detail="Choose a date and a time.")
        await _open_slot(tdb, day, body.time, doctor)
    elif body.time and body.time not in SLOT_TIMES:
        raise HTTPException(status_code=400, detail="Choose one of the listed time slots.")
    stamp = now_iso()
    payload = {
        "patientId": str(patient["_id"]), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""),
        "date": day, "time": body.time, "treatment": body.treatment.strip() or "Consultation", "doctor": doctor,
        "chair": await free_chair(tdb, day, body.time) if day and body.time else "",
        "duration": f"{settings.get('apptDuration') or '30'} min", "status": DRAFT if body.draft else "Scheduled",
        "notes": body.notes.strip(), "source": "Clinic App",
    }
    if not body.draft:
        await validate_appointment(tdb, payload, None)
    payload.update({"code": await next_sequence(tdb, "appointments", "APT-", 5001), "created_at": stamp, "updated_at": stamp,
                    "created_by": user.get("email", "")})
    result = await tdb.appointments.insert_one(payload)
    if not body.draft and not settings.get("doubleBooking", False):
        rival = await tdb.appointments.find_one({"_id": {"$lt": result.inserted_id}, "date": day, "time": body.time, "doctor": doctor,
                                                 "status": {"$in": list(ACTIVE_APPT_STATUSES)}})
        if rival:
            await tdb.appointments.delete_one({"_id": result.inserted_id})
            raise HTTPException(status_code=409, detail="That slot was just taken. Pick another time.")
    doc = await tdb.appointments.find_one({"_id": result.inserted_id})
    if not body.draft:
        await after_appointment(tdb, "create", doc, None)
    return await _answer(tdb, doc)


@router.get("/appointments/{appointment_id}")
async def appointment_detail(appointment_id: str, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """The appointment and its case summary: the patient, their treatment plan, recent prescriptions and visits."""
    a = await _get(tdb, appointment_id)
    out = await _answer(tdb, a)
    code = a.get("patientCode", "")
    patient = await tdb.patients.find_one({"code": code}) if code else None
    out["patient_record"] = None if not patient else {
        "id": str(patient["_id"]), "code": patient.get("code", ""), "name": patient.get("name", ""), "age": patient.get("age", ""),
        "gender": patient.get("gender", ""), "mobile": patient.get("mobile", ""), "allergy": patient.get("allergy", ""),
        "history": patient.get("history", ""), "blood": patient.get("blood", ""),
    }
    out["treatments"] = [{"name": t.get("name", ""), "tooth": t.get("tooth", ""), "status": t.get("status", ""), "date": t.get("date", "")}
                         for t in await tdb.patient_treatments.find({"patientId": code}).sort("date", -1).limit(10).to_list(None)] if code else []
    out["prescriptions"] = [{"code": p.get("code", ""), "date": p.get("date", ""), "diagnosis": p.get("diagnosis", ""), "doctor": p.get("doctor", "")}
                            for p in await tdb.prescriptions.find({"$or": [{"patientCode": code}, {"patientId": code}]}).sort("date", -1).limit(5).to_list(None)] if code else []
    out["visits"] = [{"date": v.get("date", ""), "treatment": v.get("treatment", ""), "status": v.get("status", "")}
                     for v in await tdb.appointments.find({"patientCode": code, "_id": {"$ne": a["_id"]}, "status": {"$ne": DRAFT}})
                     .sort([("date", -1), ("time", -1)]).limit(5).to_list(None)] if code else []
    out["can_change"] = has_role(user, FRONT_DESK_ROLES)
    return out


class RescheduleBody(BaseModel):
    date: str
    time: str
    reason: str = Field("", max_length=200)
    doctor: str = ""


@router.post("/appointments/{appointment_id}/reschedule", dependencies=[front_desk])
async def reschedule(appointment_id: str, body: RescheduleBody, tdb: TenantDB = Depends(get_tenant)):
    """Moves an appointment (or books a draft) into a free slot; the reason is kept and the patient told."""
    before = await _get(tdb, appointment_id)
    if before.get("status") not in ACTIVE_APPT_STATUSES + (DRAFT,):
        raise HTTPException(status_code=400, detail=f"A {before.get('status', '').lower()} appointment cannot be moved. Book a new one.")
    if not body.reason.strip() and before.get("status") != DRAFT:
        raise HTTPException(status_code=400, detail="Give a reason for rescheduling.")
    doctor = (await _doctor(tdb, body.doctor.strip()))["name"] if body.doctor.strip() else before.get("doctor", "")
    day = parse_date(body.date)
    await _open_slot(tdb, day, body.time, doctor, before["_id"])
    changes = {"date": day, "time": body.time, "doctor": doctor, "chair": await free_chair(tdb, day, body.time, before["_id"]),
               "status": "Scheduled" if before.get("status") == DRAFT else before.get("status")}
    if body.reason.strip():
        changes["rescheduleReason"] = body.reason.strip()
    if before.get("status") != DRAFT:
        changes["rescheduledFrom"] = {"date": before.get("date", ""), "time": before.get("time", "")}
    await validate_appointment(tdb, changes, before)
    await tdb.appointments.update_one({"_id": before["_id"]}, {"$set": {**changes, "updated_at": now_iso()}})
    doc = await tdb.appointments.find_one({"_id": before["_id"]})
    await after_appointment(tdb, "create" if before.get("status") == DRAFT else "update", doc, None if before.get("status") == DRAFT else before)
    return await _answer(tdb, doc)


class SwapBody(BaseModel):
    other_id: str


@router.post("/appointments/{appointment_id}/swap", dependencies=[front_desk])
async def swap(appointment_id: str, body: SwapBody, tdb: TenantDB = Depends(get_tenant)):
    """"Time Swap": two booked appointments of the same day exchange their times and chairs."""
    a = await _get(tdb, appointment_id)
    b = await _get(tdb, body.other_id)
    if a["_id"] == b["_id"]:
        raise HTTPException(status_code=400, detail="Choose another appointment to swap with.")
    for x in (a, b):
        if x.get("status") not in ACTIVE_APPT_STATUSES:
            raise HTTPException(status_code=400, detail="Only booked appointments can swap times.")
    if a.get("date") != b.get("date"):
        raise HTTPException(status_code=400, detail="Only appointments on the same day can swap times.")
    settings = await clinic_settings(tdb)
    if not settings.get("doubleBooking", False):
        # the doctor of each must be free at the other's time (apart from these two)
        for mine, theirs in ((a, b), (b, a)):
            clash = await tdb.appointments.find_one({
                "_id": {"$nin": [a["_id"], b["_id"]]}, "date": a["date"], "time": theirs.get("time"), "doctor": mine.get("doctor"),
                "status": {"$in": list(ACTIVE_APPT_STATUSES)}})
            if clash:
                raise HTTPException(status_code=409, detail=f"{mine.get('doctor', 'The doctor')} already has {clash.get('patient', 'a patient')} at {nice_time(theirs.get('time'))}.")
    stamp = now_iso()
    await tdb.appointments.update_one({"_id": a["_id"]}, {"$set": {"time": b.get("time"), "chair": b.get("chair"), "updated_at": stamp}})
    await tdb.appointments.update_one({"_id": b["_id"]}, {"$set": {"time": a.get("time"), "chair": a.get("chair"), "updated_at": stamp}})
    new_a, new_b = await _get(tdb, appointment_id), await _get(tdb, body.other_id)
    await after_appointment(tdb, "update", new_a, a)
    await after_appointment(tdb, "update", new_b, b)
    return {"items": [await _answer(tdb, new_a), await _answer(tdb, new_b)]}


class CancelBody(BaseModel):
    reason: str = Field(..., max_length=200)
    refund_note: str = Field("", max_length=200)


@router.post("/appointments/{appointment_id}/cancel", dependencies=[front_desk])
async def cancel(appointment_id: str, body: CancelBody, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """Cancels with a reason. A refund is only noted (online payments are excluded; nothing is paid out)."""
    before = await _get(tdb, appointment_id)
    if before.get("status") not in ACTIVE_APPT_STATUSES + (DRAFT,):
        raise HTTPException(status_code=400, detail=f"This appointment is already {before.get('status', '').lower()}.")
    if len(body.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Give a reason for cancelling.")
    if before.get("status") == DRAFT:
        await tdb.appointments.delete_one({"_id": before["_id"]})
        return {"deleted": True}
    await tdb.appointments.update_one({"_id": before["_id"]}, {"$set": {
        "status": "Cancelled", "cancelReason": body.reason.strip(), "refundNote": body.refund_note.strip(),
        "cancelledBy": user.get("email", ""), "updated_at": now_iso()}})
    doc = await tdb.appointments.find_one({"_id": before["_id"]})
    await after_appointment(tdb, "update", doc, before)
    return await _answer(tdb, doc)


class StatusBody(BaseModel):
    status: str


@router.post("/appointments/{appointment_id}/status", dependencies=[front_desk])
async def set_status(appointment_id: str, body: StatusBody, tdb: TenantDB = Depends(get_tenant)):
    """Check-in (Waiting) and Completed, the front desk's two day-of steps."""
    allowed = {"Scheduled": {"Waiting", "Completed"}, "Waiting": {"Completed", "Scheduled"}}
    before = await _get(tdb, appointment_id)
    if body.status not in allowed.get(before.get("status", ""), set()):
        raise HTTPException(status_code=400, detail=f"A {before.get('status', '').lower()} appointment cannot become {body.status.lower()}.")
    await tdb.appointments.update_one({"_id": before["_id"]}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    doc = await tdb.appointments.find_one({"_id": before["_id"]})
    await after_appointment(tdb, "update", doc, before)
    return await _answer(tdb, doc)


# -------------------------------------------------------------------- patients

def _patient_row(p: dict) -> dict:
    return {"id": str(p["_id"]), "code": p.get("code", ""), "name": p.get("name", ""), "mobile": p.get("mobile", ""),
            "age": p.get("age", ""), "gender": p.get("gender", ""), "last_visit": p.get("lastVisit", ""),
            "last_visit_label": nice_date(p.get("lastVisit")) if p.get("lastVisit") else "", "treatment": p.get("treatment", ""),
            "status": p.get("status", ""), "photo": bool(p.get("photo"))}


@router.get("/patients")
async def patients(q: str = "", limit: int = Query(50, ge=1, le=200), tdb: TenantDB = Depends(get_tenant)):
    query: dict = {}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"code": rx}, {"mobile": rx}]
    items = await tdb.patients.find(query).sort("updated_at", -1).limit(limit).to_list(None)
    today = clinic_today(await clinic_settings(tdb))
    month_start = today[:8] + "01"
    figures = {
        "total": await tdb.patients.count_documents({}),
        "new_this_month": await tdb.patients.count_documents({"created_at": {"$gte": month_start}}),
        "seen_today": len({a.get("patientCode") async for a in tdb.appointments.find({"date": today, "status": {"$in": ["Waiting", "Completed"]}}, {"patientCode": 1})}),
    }
    return {"items": [_patient_row(p) for p in items], "figures": figures}


@router.get("/revisits")
async def revisits(q: str = "", limit: int = Query(50, ge=1, le=200), tdb: TenantDB = Depends(get_tenant)):
    """"Re-Visit" (dentor.fig 3879:2429): patients whose treatment was completed, newest first, each once with its
    latest completed visit, so the front desk can call them back and book the next one."""
    needle = q.strip().lower()
    seen: set[str] = set()
    rows: list[dict] = []
    async for a in tdb.appointments.find({"status": "Completed"}).sort([("date", -1), ("time", -1)]).limit(3000):
        code = a.get("patientCode", "")
        if not code or code in seen:
            continue
        seen.add(code)
        if needle and needle not in f"{a.get('patient', '')} {code}".lower():
            continue
        rows.append(a)
        if len(rows) >= limit:
            break
    patients = {p.get("code"): p async for p in tdb.patients.find({"code": {"$in": [a.get("patientCode") for a in rows]}})}
    items = []
    for a in rows:
        p = patients.get(a.get("patientCode")) or {}
        last = p.get("lastVisit") or a.get("date", "")
        items.append({
            "patient_id": str(p["_id"]) if p else "", "patient": a.get("patient", "") or p.get("name", ""), "patient_code": a.get("patientCode", ""),
            "mobile": p.get("mobile", ""), "treatment": a.get("treatment", ""), "doctor": a.get("doctor", ""),
            "date": a.get("date", ""), "date_label": nice_date(a.get("date")), "time_label": nice_time(a.get("time")),
            "last_visit": last, "last_visit_label": nice_date(last) if last else "",
        })
    return {"items": items}


class NewPatient(BaseModel):
    name: str = Field(..., max_length=80)
    mobile: str = Field(..., max_length=15)
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: str = ""
    email: str = Field("", max_length=120)
    blood: str = Field("", max_length=5)
    allergy: str = Field("", max_length=200)
    history: str = Field("", max_length=300)
    address: str = Field("", max_length=200)
    city: str = Field("", max_length=60)
    emergencyName: str = Field("", max_length=80)
    emergencyMobile: str = Field("", max_length=15)
    source: str = Field("Walk-in", max_length=40)
    # the design's "Add patient" (dentor.fig 7977:4638): date of birth, reason for visit, vitals, insurance
    dob: str = Field("", max_length=10)
    visit_reason: str = Field("", max_length=200)
    bp: str = Field("", max_length=12)
    glucose: str = Field("", max_length=12)
    insurance_company: str = Field("", max_length=80)
    insurance_policy: str = Field("", max_length=40)
    allow_duplicate: bool = False


@router.post("/patients", status_code=201, dependencies=[front_desk])
async def add_patient(body: NewPatient, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    name = body.name.strip()
    mobile = re.sub(r"\D", "", body.mobile)[-10:]
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter the patient's full name.")
    if not MOBILE_RE.match(mobile):
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number.")
    if body.gender and body.gender not in ("Male", "Female", "Other"):
        raise HTTPException(status_code=400, detail="Gender must be Male, Female or Other.")
    if body.email and not re.match(r"^\S+@\S+\.\S+$", body.email.strip()):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    age = body.age
    if body.dob:
        born = parse_date(body.dob)
        today = date_cls.fromisoformat(clinic_today(await clinic_settings(tdb)))
        if born > today.isoformat():
            raise HTTPException(status_code=400, detail="The date of birth cannot be in the future.")
        b = date_cls.fromisoformat(born)
        age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
    if body.bp and not re.fullmatch(r"\d{2,3}/\d{2,3}", body.bp.strip()):
        raise HTTPException(status_code=400, detail="Write blood pressure like 120/80.")
    if body.glucose and not re.fullmatch(r"\d{2,3}(\.\d)?", body.glucose.strip()):
        raise HTTPException(status_code=400, detail="Write blood glucose in mg/dL, like 110.")
    emergency = re.sub(r"\D", "", body.emergencyMobile)[-10:]
    if emergency and not MOBILE_RE.match(emergency):
        raise HTTPException(status_code=400, detail="Enter a valid emergency contact number.")
    if not body.allow_duplicate:
        same = await tdb.patients.find_one({"mobile": mobile, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
        if same:
            raise HTTPException(status_code=409, detail=f"{same.get('name')} ({same.get('code')}) already has this mobile number. Open that patient, or add anyway.")
    stamp = now_iso()
    doc = {
        "code": await next_sequence(tdb, "patients", "DEN-", 1050), "name": name, "mobile": mobile, "age": age if age is not None else "",
        "dob": parse_date(body.dob) if body.dob else "", "visitReason": body.visit_reason.strip(),
        "vitals": {"bp": body.bp.strip(), "glucose": body.glucose.strip()} if (body.bp or body.glucose) else {},
        "insurance": {"company": body.insurance_company.strip(), "policy": body.insurance_policy.strip()} if body.insurance_company.strip() else {},
        "gender": body.gender, "email": body.email.strip().lower(), "blood": body.blood.strip(), "allergy": body.allergy.strip(),
        "history": body.history.strip(), "address": body.address.strip(), "city": body.city.strip(),
        "emergencyName": body.emergencyName.strip(), "emergencyMobile": emergency, "source": body.source.strip() or "Walk-in",
        "status": "New", "risk": "Low", "treatment": "", "doctor": "", "lastVisit": "", "photo": "",
        "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", ""),
    }
    result = await tdb.patients.insert_one(doc)
    return _patient_row(await tdb.patients.find_one({"_id": result.inserted_id}))


@router.get("/patients/{patient_id}")
async def patient_dashboard(patient_id: str, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """The patient dashboard: profile, appointment counts by state, clinical profile, accounts and consents."""
    p = await _patient(tdb, patient_id)
    code = p.get("code", "")
    settings = await clinic_settings(tdb)
    doctors = await _doctor_types(tdb)
    appts = await tdb.appointments.find({"patientCode": code, "status": {"$ne": DRAFT}}).sort([("date", -1), ("time", -1)]).to_list(None)
    today = clinic_today(settings)
    by_state = {"upcoming": 0, "completed": 0, "cancelled": 0}
    for a in appts:
        if a.get("status") == "Cancelled":
            by_state["cancelled"] += 1
        elif a.get("status") == "Completed" or a.get("date", "") < today:
            by_state["completed"] += 1
        else:
            by_state["upcoming"] += 1
    treatments = await tdb.patient_treatments.find({"patientId": code}).sort("date", -1).to_list(None)
    procedures = await tdb.patient_procedures.find({"patientId": code}).sort("date", -1).to_list(None)
    consents = await tdb.patient_consents.find({"patientId": code}).sort("created_at", -1).to_list(None)
    files = await tdb.patient_files.find({"patientId": code}, {"category": 1}).to_list(None)
    prescriptions = await tdb.prescriptions.count_documents({"$or": [{"patientCode": code}, {"patientId": code}]})
    imaging = sum(1 for f in files if str(f.get("category", "")).lower() in ("x-ray", "imaging", "opg", "iopa", "photo"))
    cbct = sum(1 for f in files if "cbct" in str(f.get("category", "")).lower())
    out = {
        "profile": {**{k: p.get(k, "") for k in ("code", "name", "mobile", "age", "gender", "email", "blood", "allergy", "history", "dob",
                                                 "address", "city", "emergencyName", "emergencyMobile", "source", "status", "lastVisit", "visitReason")},
                    "vitals": p.get("vitals") or {}, "insurance": p.get("insurance") or {}},
        "id": str(p["_id"]),
        "appointments": {"counts": by_state, "items": [_appointment(a, doctors, settings) for a in appts[:30]]},
        "clinical": {
            "treatments": [{"name": t.get("name", ""), "tooth": t.get("tooth", ""), "status": t.get("status", ""), "date": t.get("date", ""),
                            "doctor": t.get("doctor", ""), "notes": t.get("notes", "")} for t in treatments],
            "procedures": [{"name": t.get("name", ""), "tooth": t.get("tooth", ""), "status": t.get("status", ""), "date": t.get("date", ""),
                            "doctor": t.get("doctor", "")} for t in procedures],
            # single or multi-visit, as the design's clinical profile tells them apart
            "multi_visit": sum(1 for t in treatments if t.get("status") == "In Progress"),
        },
        # the design's dashboard tiles (dentor.fig 7977:3276); the money tiles follow in "accounts"
        "tiles": {"appointments": len(appts), "clinical_chart": len(treatments) + len(procedures), "reports": len(files),
                  "prescriptions": prescriptions, "imaging": imaging, "cbct": cbct},
        "consents": [{"title": c.get("title", ""), "status": c.get("status", ""), "date": c.get("signedAt", "") or c.get("created_at", "")[:10]} for c in consents],
        "money": has_role(user, FINANCE_ROLES),
        "can_change": has_role(user, FRONT_DESK_ROLES),
    }
    if out["money"]:
        invoices = await tdb.invoices.find({"patientCode": code}).sort("date", -1).to_list(None)
        payments = await tdb.payments.find({"$or": [{"patientCode": code}, {"patient": p.get("name", "")}]}).sort("date", -1).limit(30).to_list(None)
        out["accounts"] = {
            "billed": sum(_f(i.get("total")) for i in invoices), "paid": sum(_f(i.get("paid")) for i in invoices),
            "balance": sum(_f(i.get("balance")) for i in invoices),
            "invoices": [{"id": str(i["_id"]), "number": i.get("number", ""), "date": i.get("date", ""), "treatment": i.get("treatment", ""),
                          "total": _f(i.get("total")), "paid": _f(i.get("paid")), "balance": _f(i.get("balance")), "status": i.get("status", "")}
                         for i in invoices],
            "payments": [{"receipt": x.get("receipt", ""), "date": x.get("date", ""), "mode": x.get("mode", ""), "amount": _f(x.get("amount")),
                          "invoice": x.get("invoice", "")} for x in payments],
        }
    else:
        out["accounts"] = None
    return serialize(out)


# ------------------------------------------------- book a visiting consultant

from .. import consult  # noqa: E402  (kept beside the endpoints that use it)


@router.get("/consult/consultants")
async def consult_consultants(specialty: str = "", tdb: TenantDB = Depends(get_tenant)):
    """"Consultant near me" (dentor.fig 7648:3664): the clinic's visiting consultants, by speciality."""
    query: dict = {"type": "Visiting", "status": {"$ne": "Inactive"}}
    if specialty.strip():
        query["specialty"] = {"$regex": re.escape(specialty.strip()), "$options": "i"}
    items = await tdb.consultants.find(query).sort("name", 1).to_list(None)
    out = []
    for c in items:
        done = await tdb.consultant_bookings.count_documents({"consultant": c.get("name"), "status": "Completed"})
        out.append({"id": str(c["_id"]), "code": c.get("code", ""), "name": c.get("name", ""), "specialty": c.get("specialty", ""),
                    "credentials": c.get("credentials", ""), "experience": c.get("experience", ""), "location": c.get("location", ""),
                    "fee": _f(c.get("fee")), "rating": c.get("rating", ""), "cases": done, "photo": bool(c.get("photo"))})
    return {"items": out, "types": [{"key": k, **v} for k, v in consult.DENTOR_TYPES.items()]}


async def _visiting(tdb: TenantDB, consultant_id: str) -> dict:
    c = await tdb.consultants.find_one({"_id": _oid(consultant_id), "type": "Visiting", "status": {"$ne": "Inactive"}})
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found.")
    return c


@router.get("/consult/consultants/{consultant_id}")
async def consult_profile(consultant_id: str, tdb: TenantDB = Depends(get_tenant)):
    """"Consultant Profile" (dentor.fig 2664:840): about, services, experience and recent reviews."""
    c = await _visiting(tdb, consultant_id)
    reviews = await tdb.reviews.find({"subject": c.get("name"), "status": "Approved"}).sort("created_at", -1).limit(5).to_list(None)
    return {"id": str(c["_id"]), "name": c.get("name", ""), "specialty": c.get("specialty", ""), "credentials": c.get("credentials", ""),
            "experience": c.get("experience", ""), "location": c.get("location", ""), "fee": _f(c.get("fee")), "rating": c.get("rating", ""),
            "about": c.get("about", ""), "services": c.get("services") or [s.strip() for s in str(c.get("specialty", "")).replace("&", ",").split(",") if s.strip()],
            "reviews": [{"by": r.get("reviewer", ""), "rating": r.get("rating", ""), "text": r.get("text", "")} for r in reviews]}


@router.get("/consult/consultants/{consultant_id}/slots")
async def consult_slots(consultant_id: str, date: str, tdb: TenantDB = Depends(get_tenant)):
    """"VIEW SLOT" (dentor.fig 7712:4441): the consultant's own hours that day, morning / afternoon / evening."""
    c = await _visiting(tdb, consultant_id)
    return {"date": parse_date(date), "slots": await consult.consultant_slots(tdb, c, parse_date(date), await clinic_settings(tdb))}


class ConsultRequest(BaseModel):
    patient_id: str
    choice: str  # "own" | "dentor"
    consultant_id: str = ""
    date: str = ""
    time: str = ""
    dentor_type: str = ""  # standard | peak | preferred
    diagnosis: str = Field("", max_length=200)
    treatment: str = Field(..., max_length=120)
    teeth: list[str] = []
    quadrants: list[str] = []
    history: list[str] = []
    history_note: str = Field("", max_length=300)
    lab_findings: str = Field("", max_length=500)
    bp: str = Field("", max_length=12)
    glucose: str = Field("", max_length=12)
    notes: str = Field("", max_length=500)
    images: list[str] = []
    declaration: bool = False


@router.post("/consult/requests", status_code=201, dependencies=[front_desk])
async def consult_request(body: ConsultRequest, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"BOOK YOUR APPOINTMENT" (dentor.fig 6470:3924): the case, then the clinic's own choice of consultant
    and slot, or "Dentor choice" with an appointment type. The consultant confirms or offers other times."""
    if not body.declaration:
        raise HTTPException(status_code=400, detail="Confirm the declaration that the instructions are legible and the patient is eligible.")
    if body.choice not in ("own", "dentor"):
        raise HTTPException(status_code=400, detail="Choose your own consultant or Dentor's choice.")
    if not body.treatment.strip():
        raise HTTPException(status_code=400, detail="Say which treatment is needed.")
    for tooth in body.teeth:
        if not re.fullmatch(r"[1-4][1-8]|[5-8][1-5]", str(tooth)):
            raise HTTPException(status_code=400, detail=f"{tooth} is not a tooth number (FDI, like 11 or 46).")
    if any(q not in ("1", "2", "3", "4", "full") for q in body.quadrants):
        raise HTTPException(status_code=400, detail="Quadrants are 1 to 4, or full mouth.")
    if body.bp and not re.fullmatch(r"\d{2,3}/\d{2,3}", body.bp.strip()):
        raise HTTPException(status_code=400, detail="Write blood pressure like 120/80.")
    if body.glucose and not re.fullmatch(r"\d{2,3}(\.\d)?", body.glucose.strip()):
        raise HTTPException(status_code=400, detail="Write blood glucose in mg/dL, like 110.")
    patient = await _patient(tdb, body.patient_id)
    settings = await clinic_settings(tdb)
    doc = {
        "patientId": str(patient["_id"]), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""),
        "choice": body.choice, "diagnosis": body.diagnosis.strip(), "treatment": body.treatment.strip(), "reason": body.treatment.strip(),
        "teeth": [str(t) for t in body.teeth][:32], "quadrants": body.quadrants, "history": [h.strip()[:40] for h in body.history][:15],
        "history_note": body.history_note.strip(), "lab_findings": body.lab_findings.strip(),
        "vitals": {"bp": body.bp.strip(), "glucose": body.glucose.strip()}, "notes": body.notes.strip(),
        "images": consult.clean_images(body.images), "status": "Requested", "source": "Clinic App", "start_attempts": 0,
    }
    if body.choice == "own":
        c = await _visiting(tdb, body.consultant_id)
        day = parse_date(body.date) if body.date else ""
        if not day or not body.time:
            raise HTTPException(status_code=400, detail="Choose a date and one of the consultant's free slots.")
        slot = next((s for s in await consult.consultant_slots(tdb, c, day, settings) if s["time"] == body.time), None)
        if not slot or not slot["available"]:
            raise HTTPException(status_code=409, detail="Sorry, that slot is no longer available. Please choose another.")
        doc.update({"consultantId": str(c["_id"]), "consultantCode": c.get("code", ""), "consultant": c.get("name", ""),
                    "specialty": c.get("specialty", ""), "fee": _f(c.get("fee")), "location": c.get("location", ""), "date": day, "time": body.time})
    else:
        if body.dentor_type not in consult.DENTOR_TYPES:
            raise HTTPException(status_code=400, detail="Choose the appointment type: standard, peak hour or clinic preferred.")
        doc.update({"dentor_type": body.dentor_type, "consultant": "", "fee": 0, "extra_fee": consult.DENTOR_TYPES[body.dentor_type]["extra"],
                    "date": "", "time": ""})
        if body.dentor_type in ("preferred", "peak"):
            if not body.date or not body.time or not consult.valid_hhmm(body.time):
                raise HTTPException(status_code=400, detail="Choose the date and time you would like.")
            if body.dentor_type == "peak" and not ("17:00" <= body.time < "21:00"):
                raise HTTPException(status_code=400, detail="Peak hour appointments are between 5 and 9 PM.")
            day = parse_date(body.date)
            if day < clinic_today(settings):
                raise HTTPException(status_code=400, detail="Choose a date from today on.")
            doc.update({"date": day, "time": body.time})
    stamp = now_iso()
    doc.update({"code": await next_sequence(tdb, "consultant_bookings", "CNS-", 2001), "created_at": stamp, "updated_at": stamp,
                "created_by": user.get("email", ""), "timeline": [{"status": "Requested", "at": stamp, "by": user.get("name") or user.get("email", ""), "note": ""}]})
    result = await tdb.consultant_bookings.insert_one(doc)
    booking = await tdb.consultant_bookings.find_one({"_id": result.inserted_id})
    when = f" on {nice_date(doc['date'])} at {nice_time(doc['time'])}" if doc.get("date") else ""
    if body.choice == "own":
        await consult.tell_consultant(tdb, doc["consultant"], booking, "New appointment requested",
                                      f"{doc['patient']} · {doc['treatment']}{when}. Please confirm it.")
    else:
        async for c in tdb.consultants.find({"type": "Visiting", "status": {"$ne": "Inactive"}}, {"name": 1}):
            await consult.tell_consultant(tdb, c["name"], booking, "Open request from the clinic",
                                          f"{doc['treatment']} · {consult.DENTOR_TYPES[body.dentor_type]['label']}{when}.")
    return consult.booking_view(booking, for_clinic=True)


@router.get("/consult/requests")
async def consult_requests(scope: str = "active", tdb: TenantDB = Depends(get_tenant)):
    statuses = {"active": list(consult.OPEN + consult.LIVE), "past": list(consult.DONE), "all": None}.get(scope, None)
    query = {"status": {"$in": statuses}} if statuses else {}
    items = await tdb.consultant_bookings.find(query, {"images": 0}).sort("created_at", -1).limit(100).to_list(None)
    return {"items": [consult.booking_view(b, for_clinic=True) for b in items]}


async def _booking(tdb: TenantDB, booking_id: str) -> dict:
    b = await tdb.consultant_bookings.find_one({"_id": _oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return b


@router.get("/consult/requests/{booking_id}")
async def consult_request_detail(booking_id: str, tdb: TenantDB = Depends(get_tenant)):
    return consult.booking_view(await _booking(tdb, booking_id), for_clinic=True)


class ChooseProposal(BaseModel):
    index: int = Field(..., ge=0, le=4)


@router.post("/consult/requests/{booking_id}/accept-proposal", dependencies=[front_desk])
async def accept_proposal(booking_id: str, body: ChooseProposal, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """The consultant offered other times (dentor.fig 3093:1203); the clinic takes one and it is confirmed."""
    b = await _booking(tdb, booking_id)
    proposals = b.get("proposals") or []
    if b.get("status") != "Proposed" or body.index >= len(proposals):
        raise HTTPException(status_code=400, detail="There is no offered time to accept.")
    pick = proposals[body.index]
    appointment_id = await consult.mirror_appointment(tdb, b, b.get("consultant", ""), pick["date"], pick["time"])
    await tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {
        "status": "Confirmed", "date": pick["date"], "time": pick["time"], "appointmentId": appointment_id,
        "start_code": consult.new_start_code(), "updated_at": now_iso()}})
    await consult.timeline(tdb, b, "Confirmed", user.get("name") or user.get("email", ""), f"Clinic accepted {nice_date(pick['date'])} {nice_time(pick['time'])}")
    b = await _booking(tdb, booking_id)
    await consult.tell_consultant(tdb, b.get("consultant", ""), b, "Appointment confirmed", f"{b.get('patient')} · {nice_date(b['date'])} at {nice_time(b['time'])}.")
    return consult.booking_view(b, for_clinic=True)


class ReasonBody(BaseModel):
    reason: str = Field(..., max_length=200)


async def cancel_booking(tdb: TenantDB, b: dict, reason: str, actor: str) -> None:
    if b.get("status") in consult.DONE or b.get("status") == "Started":
        raise HTTPException(status_code=400, detail=f"This booking is {b.get('status', '').lower()} and cannot be cancelled.")
    if len(reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Give a reason for cancelling.")
    await tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "Cancelled", "cancelReason": reason.strip(), "updated_at": now_iso()}})
    if b.get("appointmentId"):
        await tdb.appointments.update_one({"_id": _oid(b["appointmentId"])}, {"$set": {"status": "Cancelled", "cancelReason": reason.strip(), "updated_at": now_iso()}})
    await consult.timeline(tdb, b, "Cancelled", actor, reason.strip())


@router.post("/consult/requests/{booking_id}/cancel", dependencies=[front_desk])
async def consult_cancel(booking_id: str, body: ReasonBody, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    b = await _booking(tdb, booking_id)
    await cancel_booking(tdb, b, body.reason, user.get("name") or user.get("email", ""))
    if b.get("consultant"):
        await consult.tell_consultant(tdb, b["consultant"], b, "Appointment cancelled", f"The clinic cancelled {b.get('patient')}'s {b.get('treatment')}: {body.reason.strip()}.")
    return consult.booking_view(await _booking(tdb, booking_id), for_clinic=True)


# ------------------------------------------------------------------ callbacks

@router.get("/callbacks")
async def callbacks(tdb: TenantDB = Depends(get_tenant)):
    """Patients who asked for a call from the patient app ("Request Callback")."""
    items = await tdb.callback_requests.find({"status": "Open"}).sort("created_at", 1).to_list(100)
    return {"items": [{"id": str(c["_id"]), "patient": c.get("patient", ""), "patient_code": c.get("patientCode", ""), "mobile": c.get("mobile", ""),
                       "when": c.get("when", ""), "note": c.get("note", ""), "created_at": c.get("created_at", "")} for c in items]}


@router.post("/callbacks/{callback_id}/done", dependencies=[front_desk])
async def callback_done(callback_id: str, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    result = await tdb.callback_requests.update_one({"_id": _oid(callback_id), "status": "Open"},
                                                     {"$set": {"status": "Called", "called_by": user.get("email", ""), "called_at": now_iso()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Callback request not found.")
    return {"ok": True}



# ------------------------------------------------------------------ analytics

@router.get("/analytics/consultants")
async def consultant_analytics(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """The web's consultant page (cms.fig 383:1566): per doctor, the period's load — appointments, completed,
    cancelled, completion rate, hours booked, consultant visits — and the average rating."""
    today = clinic_today(await clinic_settings(tdb))
    start = parse_date(date_from) if date_from else today[:8] + "01"
    end = parse_date(date_to) if date_to else today
    appts = await tdb.appointments.find({"date": {"$gte": start, "$lte": end}, "status": {"$ne": DRAFT}}, {"doctor": 1, "status": 1, "duration": 1}).to_list(None)
    visits = await tdb.consultant_bookings.find({"date": {"$gte": start, "$lte": end}}, {"consultant": 1, "status": 1}).to_list(None)
    out = []
    async for c in tdb.consultants.find({"status": {"$ne": "Inactive"}}).sort("name", 1):
        name = c.get("name", "")
        mine = [a for a in appts if a.get("doctor") == name]
        done = sum(1 for a in mine if a.get("status") == "Completed")
        cancelled = sum(1 for a in mine if a.get("status") == "Cancelled")
        minutes = sum(int(re.sub(r"\D", "", str(a.get("duration") or "30")) or 30) for a in mine if a.get("status") != "Cancelled")
        ratings = [float(r.get("rating") or 0) async for r in tdb.reviews.find({"subject": name, "status": "Approved"}, {"rating": 1}) if r.get("rating")]
        held = len(mine) - cancelled
        out.append({"id": str(c["_id"]), "name": name, "type": c.get("type", ""), "specialty": c.get("specialty", ""),
                    "appointments": len(mine), "completed": done, "cancelled": cancelled,
                    "completion_rate": round(done / held * 100) if held else None, "hours": round(minutes / 60, 1),
                    "visits": sum(1 for v in visits if v.get("consultant") == name and v.get("status") == "Completed"),
                    "rating": round(sum(ratings) / len(ratings), 1) if ratings else (c.get("rating") or None)})
    return {"from": start, "to": end, "items": out}

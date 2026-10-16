"""Consultant app API.

A consultant login is linked to one `consultants` record. Everything here is limited to
that consultant's own work: appointments booked with them, the patients they treat, the
prescriptions they write and the invoices raised in their name.
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..hooks import after_appointment, after_prescription, nice_date, nice_time
from ..roles import require_consultant
from ..rules import ACTIVE_APPT_STATUSES, clinic_settings, validate_clinical_record
from ..scheduling import clinic_today, parse_date
from ..tenancy import TenantDB, get_tenant
from ..util import next_sequence, now_iso, serialize, text_filter, to_object_id

router = APIRouter(prefix="/api/consultant", tags=["consultant app"])


@dataclass
class ConsultantCtx:
    user: dict
    consultant: dict
    tdb: TenantDB

    @property
    def name(self) -> str:
        return self.consultant.get("name", "")


async def get_consultant_ctx(user: dict = Depends(require_consultant), tdb: TenantDB = Depends(get_tenant)) -> ConsultantCtx:
    consultant = None
    if user.get("consultant_id"):
        try:
            consultant = await tdb.consultants.find_one({"_id": to_object_id(user["consultant_id"])})
        except HTTPException:
            consultant = None
    if not consultant:
        raise HTTPException(status_code=403, detail="Your login is not linked to a consultant profile. Ask the clinic to link it.")
    return ConsultantCtx(user=user, consultant=consultant, tdb=tdb)


def _clean(doc: dict) -> dict:
    out = serialize(doc)
    for key in ("clinic_id", "created_by"):
        out.pop(key, None)
    return out


def _appointment(a: dict) -> dict:
    out = _clean(a)
    out.update({"date_label": nice_date(a.get("date")), "time_label": nice_time(a.get("time"))})
    return out


def _profile(ctx: ConsultantCtx) -> dict:
    c = ctx.consultant
    return {
        "id": str(c["_id"]), "code": c.get("code", ""), "name": c.get("name", ""), "specialty": c.get("specialty", ""),
        "type": c.get("type", ""), "credentials": c.get("credentials", ""), "experience": c.get("experience", ""),
        "availability": c.get("availability", ""), "location": c.get("location", ""), "fee": c.get("fee", 0),
        "rating": c.get("rating", 0), "about": c.get("about", ""), "phone": c.get("phone", ""),
        "email": ctx.user.get("email", ""), "login_name": ctx.user.get("name", ""),
    }


# -------------------------------------------------------------- profile

class ProfileUpdate(BaseModel):
    availability: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=80)
    about: Optional[str] = Field(default=None, max_length=600)
    phone: Optional[str] = Field(default=None, max_length=20)


@router.get("/me")
async def me(ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    settings = await clinic_settings(ctx.tdb)
    return {"profile": _profile(ctx),
            "clinic": {"name": settings.get("clinicName", ""), "phone": settings.get("phone", ""),
                       "address": settings.get("address", "")}}


@router.patch("/me")
async def update_me(body: ProfileUpdate, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if changes:
        changes["updated_at"] = now_iso()
        await ctx.tdb.consultants.update_one({"_id": ctx.consultant["_id"]}, {"$set": changes})
        ctx.consultant = await ctx.tdb.consultants.find_one({"_id": ctx.consultant["_id"]})
    return _profile(ctx)


# ---------------------------------------------------- dashboard & schedule

@router.get("/dashboard")
async def dashboard(date: Optional[str] = None, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    settings = await clinic_settings(ctx.tdb)
    day = parse_date(date) if date else clinic_today(settings)
    todays = await ctx.tdb.appointments.find({"doctor": ctx.name, "date": day}).sort("time", 1).to_list(None)
    by_status = {s: sum(1 for a in todays if a.get("status") == s) for s in ("Scheduled", "Waiting", "Completed", "Cancelled")}
    upcoming = await ctx.tdb.appointments.find(
        {"doctor": ctx.name, "date": {"$gt": day}, "status": {"$in": list(ACTIVE_APPT_STATUSES)}}
    ).sort([("date", 1), ("time", 1)]).limit(5).to_list(None)
    next_up = next((a for a in todays if a.get("status") in ACTIVE_APPT_STATUSES), None)
    return {
        "date": day, "date_label": nice_date(day), "profile": _profile(ctx),
        "total": len(todays), "by_status": by_status,
        "next": _appointment(next_up) if next_up else None,
        "today": [_appointment(a) for a in todays],
        "upcoming": [_appointment(a) for a in upcoming],
        "patients": len(await _my_patient_codes(ctx)),
    }


@router.get("/appointments")
async def appointments(date: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
                       status: Optional[str] = None, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    query: dict = {"doctor": ctx.name}
    if date:
        query["date"] = parse_date(date)
    elif date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = parse_date(date_from)
        if date_to:
            rng["$lte"] = parse_date(date_to)
        query["date"] = rng
    if status:
        query["status"] = status
    items = await ctx.tdb.appointments.find(query).sort([("date", 1), ("time", 1)]).limit(500).to_list(None)
    return {"items": [_appointment(a) for a in items]}


async def _my_appointment(ctx: ConsultantCtx, appointment_id: str) -> dict:
    doc = await ctx.tdb.appointments.find_one({"_id": to_object_id(appointment_id), "doctor": ctx.name})
    if not doc:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return doc


@router.get("/appointments/{appointment_id}")
async def appointment_detail(appointment_id: str, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    doc = await _my_appointment(ctx, appointment_id)
    patient = None
    if doc.get("patientCode"):
        patient = await ctx.tdb.patients.find_one({"code": doc["patientCode"]})
    return {**_appointment(doc), "patient_record": _patient_summary(patient) if patient else None}


ALLOWED_TRANSITIONS = {
    "Scheduled": {"Waiting", "Completed", "Cancelled"},
    "Waiting": {"Completed", "Scheduled", "Cancelled"},
}


class StatusBody(BaseModel):
    status: str
    notes: Optional[str] = Field(default=None, max_length=1000)


@router.post("/appointments/{appointment_id}/status")
async def set_appointment_status(appointment_id: str, body: StatusBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    before = await _my_appointment(ctx, appointment_id)
    current = before.get("status", "Scheduled")
    if body.status != current and body.status not in ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=400, detail=f"A {current.lower()} appointment cannot be marked {body.status.lower()}.")
    changes = {"status": body.status, "updated_at": now_iso()}
    if body.notes is not None:
        changes["notes"] = body.notes.strip()
    await ctx.tdb.appointments.update_one({"_id": before["_id"]}, {"$set": changes})
    doc = await ctx.tdb.appointments.find_one({"_id": before["_id"]})
    await after_appointment(ctx.tdb, "update", doc, before, actor="consultant")
    return _appointment(doc)


# ---------------------------------------------------------------- patients

async def _my_patient_codes(ctx: ConsultantCtx) -> set[str]:
    codes: set[str] = set()
    async for a in ctx.tdb.appointments.find({"doctor": ctx.name}, {"patientCode": 1}):
        if a.get("patientCode"):
            codes.add(a["patientCode"])
    async for b in ctx.tdb.consultant_bookings.find({"consultant": ctx.name}, {"patientCode": 1}):
        if b.get("patientCode"):
            codes.add(b["patientCode"])
    async for p in ctx.tdb.patients.find({"doctor": ctx.name}, {"code": 1}):
        if p.get("code"):
            codes.add(p["code"])
    return codes


def _patient_summary(p: dict) -> dict:
    return {
        "id": str(p["_id"]), "code": p.get("code", ""), "name": p.get("name", ""), "age": p.get("age", ""),
        "gender": p.get("gender", ""), "mobile": p.get("mobile", ""), "blood": p.get("blood", ""),
        "allergy": p.get("allergy", ""), "history": p.get("history", ""), "risk": p.get("risk", ""),
        "treatment": p.get("treatment", ""), "status": p.get("status", ""), "lastVisit": p.get("lastVisit", ""),
        "photo": p.get("photo", ""),
    }


@router.get("/patients")
async def my_patients(q: str = "", ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    codes = await _my_patient_codes(ctx)
    query: dict = {"code": {"$in": sorted(codes)}}
    if q.strip():
        query = {"$and": [query, text_filter(q.strip(), ["name", "code", "mobile", "treatment"])]}
    items = await ctx.tdb.patients.find(query).sort("name", 1).limit(300).to_list(None)
    return {"items": [_patient_summary(p) for p in items], "total": len(items)}


async def _my_patient(ctx: ConsultantCtx, patient_id: str) -> dict:
    patient = await ctx.tdb.patients.find_one({"_id": to_object_id(patient_id)})
    if not patient or patient.get("code") not in await _my_patient_codes(ctx):
        # Same answer for "does not exist" and "not yours": never confirm other patients exist.
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@router.get("/patients/{patient_id}")
async def patient_detail(patient_id: str, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    patient = await _my_patient(ctx, patient_id)
    code = patient["code"]
    own = {"patientId": code}
    chart = await ctx.tdb.charts.find_one({**own, "type": "dental"})
    files = await ctx.tdb.patient_files.aggregate([
        {"$match": own}, {"$sort": {"created_at": -1}},
        {"$project": {"name": 1, "category": 1, "size": 1, "created_at": 1}},
    ]).to_list(None)
    return {
        "patient": _patient_summary(patient),
        "appointments": [_appointment(a) for a in await ctx.tdb.appointments.find(
            {"doctor": ctx.name, "patientCode": code}).sort([("date", -1), ("time", -1)]).limit(50).to_list(None)],
        "treatments": [_clean(d) for d in await ctx.tdb.patient_treatments.find(own).sort("date", -1).to_list(None)],
        "procedures": [_clean(d) for d in await ctx.tdb.patient_procedures.find(own).sort("date", -1).to_list(None)],
        "prescriptions": [_clean(d) for d in await ctx.tdb.prescriptions.find({"patientCode": code}).sort("created_at", -1).to_list(None)],
        "consents": [_clean(d) for d in await ctx.tdb.patient_consents.find(own).sort("date", -1).to_list(None)],
        "files": [{"id": str(f["_id"]), "name": f.get("name", ""), "category": f.get("category", ""),
                   "size": f.get("size", 0), "created_at": f.get("created_at", "")} for f in files],
        "teeth": (chart or {}).get("teeth") or {},
    }


@router.get("/patients/{patient_id}/files/{file_id}")
async def patient_file(patient_id: str, file_id: str, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    patient = await _my_patient(ctx, patient_id)
    doc = await ctx.tdb.patient_files.find_one({"_id": to_object_id(file_id), "patientId": patient["code"]})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found.")
    return _clean(doc)


# ------------------------------------------------ prescriptions & treatments

class MedRow(BaseModel):
    drug: str = Field(min_length=1, max_length=120)
    dose: str = Field(default="", max_length=60)
    freq: str = Field(default="TDS", max_length=20)
    days: str = Field(default="5", max_length=6)
    unit: str = Field(default="Days", max_length=12)
    instruction: str = Field(default="After food", max_length=60)


class PrescriptionBody(BaseModel):
    diagnosis: str = Field(min_length=2, max_length=200)
    complaint: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=1000)
    meds: list[MedRow] = Field(min_length=1, max_length=20)
    advice: str = Field(default="", max_length=1000)
    followUp: str = ""


@router.post("/patients/{patient_id}/prescriptions", status_code=201)
async def write_prescription(patient_id: str, body: PrescriptionBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    patient = await _my_patient(ctx, patient_id)
    settings = await clinic_settings(ctx.tdb)
    stamp = now_iso()
    doc = {
        "code": await next_sequence(ctx.tdb, "prescriptions", "RX-", 1001),
        "patientId": str(patient["_id"]), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""),
        "age": patient.get("age", ""), "gender": patient.get("gender", ""), "allergy": patient.get("allergy", ""),
        "date": clinic_today(settings), "doctor": ctx.name,
        "complaint": body.complaint.strip(), "diagnosis": body.diagnosis.strip(), "note": body.note.strip(),
        "meds": [m.model_dump() for m in body.meds], "advice": body.advice.strip(),
        "followUp": parse_date(body.followUp) if body.followUp else "", "status": "Signed", "source": "Consultant App",
        "created_at": stamp, "updated_at": stamp, "created_by": ctx.user.get("email"),
    }
    result = await ctx.tdb.prescriptions.insert_one(doc)
    saved = await ctx.tdb.prescriptions.find_one({"_id": result.inserted_id})
    await after_prescription(ctx.tdb, "create", saved, None, actor="consultant")
    return _clean(saved)


@router.get("/prescriptions")
async def my_prescriptions(ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    items = await ctx.tdb.prescriptions.find({"doctor": ctx.name}).sort("created_at", -1).limit(200).to_list(None)
    return {"items": [_clean(d) for d in items]}


class TreatmentBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    tooth: str = Field(default="", max_length=30)
    date: str = ""
    status: str = "Planned"
    cost: float = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=1000)


@router.post("/patients/{patient_id}/treatments", status_code=201)
async def add_treatment(patient_id: str, body: TreatmentBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    patient = await _my_patient(ctx, patient_id)
    if body.status not in ("Planned", "In Progress", "Completed"):
        raise HTTPException(status_code=400, detail="Status must be Planned, In Progress or Completed.")
    settings = await clinic_settings(ctx.tdb)
    stamp = now_iso()
    payload = {
        "patientId": patient["code"], "name": body.name.strip(), "tooth": body.tooth.strip(), "doctor": ctx.name,
        "date": parse_date(body.date) if body.date else clinic_today(settings), "status": body.status,
        "cost": body.cost, "notes": body.notes.strip(),
    }
    await validate_clinical_record(ctx.tdb, payload, None)  # same consent rule as the front desk
    payload.update({"created_at": stamp, "updated_at": stamp, "created_by": ctx.user.get("email")})
    result = await ctx.tdb.patient_treatments.insert_one(payload)
    return _clean(await ctx.tdb.patient_treatments.find_one({"_id": result.inserted_id}))


@router.get("/catalog")
async def catalog(ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """Medicine and treatment names for the prescription and treatment forms."""
    meds = await ctx.tdb.pharmacy_items.find({}).sort("name", 1).limit(500).to_list(None)
    treatments = await ctx.tdb.treatment_masters.find({"status": {"$ne": "Inactive"}}).sort("name", 1).to_list(None)
    return {
        "medicines": [{"name": m.get("name", ""), "form": m.get("form", ""), "in_stock": float(m.get("stock") or 0) > 0} for m in meds],
        "treatments": [{"name": t.get("name", ""), "category": t.get("category", ""), "price": t.get("price", 0),
                        "duration": t.get("duration", 0)} for t in treatments],
    }


# ------------------------------------------------------ bookings & earnings

@router.get("/bookings")
async def bookings(ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """Referral bookings made for this consultant through 'Book a Consultant'."""
    items = await ctx.tdb.consultant_bookings.find({"consultant": ctx.name}).sort([("date", -1), ("time", -1)]).limit(200).to_list(None)
    return {"items": [{**_clean(b), "date_label": nice_date(b.get("date")), "time_label": nice_time(b.get("time"))} for b in items]}


@router.get("/earnings")
async def earnings(date_from: Optional[str] = None, date_to: Optional[str] = None,
                   ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    settings = await clinic_settings(ctx.tdb)
    today = clinic_today(settings)
    start = parse_date(date_from) if date_from else today[:8] + "01"
    end = parse_date(date_to) if date_to else today
    invoices = await ctx.tdb.invoices.find({"doctor": ctx.name, "date": {"$gte": start, "$lte": end}}).sort("date", -1).to_list(None)
    by_treatment: dict[str, float] = {}
    for inv in invoices:
        key = inv.get("treatment") or "Other"
        by_treatment[key] = by_treatment.get(key, 0) + float(inv.get("total") or 0)
    completed = await ctx.tdb.appointments.count_documents(
        {"doctor": ctx.name, "status": "Completed", "date": {"$gte": start, "$lte": end}}
    )
    return {
        "from": start, "to": end,
        "billed": sum(float(i.get("total") or 0) for i in invoices),
        "collected": sum(float(i.get("paid") or 0) for i in invoices),
        "outstanding": sum(float(i.get("balance") or 0) for i in invoices),
        "invoices": len(invoices), "completed_visits": completed,
        "by_treatment": [{"treatment": k, "amount": v} for k, v in sorted(by_treatment.items(), key=lambda kv: -kv[1])],
        "items": [{"id": str(i["_id"]), "number": i.get("number", ""), "date": i.get("date", ""),
                   "date_label": nice_date(i.get("date")), "patient": i.get("patient", ""),
                   "treatment": i.get("treatment", ""), "total": i.get("total", 0), "paid": i.get("paid", 0),
                   "balance": i.get("balance", 0), "status": i.get("status", "")} for i in invoices],
    }



# ------------------------------------------- requests from clinics (Phase 4)

from .. import consult  # noqa: E402


def _req_query(ctx: ConsultantCtx) -> dict:
    """Bookings addressed to me, and the clinic's open "Dentor choice" requests anyone may take."""
    return {"$or": [{"consultant": ctx.name}, {"choice": "dentor", "consultant": "", "status": {"$in": ["Requested", "Viewed"]}}]}


@router.get("/requests")
async def requests(scope: str = "pending", ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Pending appointments" / "Upcoming" / "Previous" (dentor.fig 6992:4101, 6907:5456, 5142:5289)."""
    statuses = {"pending": list(consult.OPEN), "upcoming": list(consult.LIVE), "previous": list(consult.DONE)}.get(scope)
    if statuses is None:
        raise HTTPException(status_code=400, detail="scope must be pending, upcoming or previous.")
    items = await ctx.tdb.consultant_bookings.find({**_req_query(ctx), "status": {"$in": statuses}}, {"images": 0}) \
        .sort([("date", 1 if scope != "previous" else -1), ("time", 1)]).limit(200).to_list(None)
    counts = {k: await ctx.tdb.consultant_bookings.count_documents({**_req_query(ctx), "status": {"$in": list(v)}})
              for k, v in (("pending", consult.OPEN), ("upcoming", consult.LIVE), ("previous", consult.DONE))}
    return {"items": [consult.booking_view(b, for_clinic=False) for b in items], "counts": counts}


async def _my_request(ctx: ConsultantCtx, booking_id: str) -> dict:
    try:
        oid = to_object_id(booking_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Request not found.")
    b = await ctx.tdb.consultant_bookings.find_one({"_id": oid, **_req_query(ctx)})
    if not b:
        raise HTTPException(status_code=404, detail="Request not found.")
    return b


@router.get("/requests/{booking_id}")
async def request_detail(booking_id: str, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """The case (dentor.fig "Appointment summary" 3973:32234). Opening a new request marks it viewed for the clinic."""
    b = await _my_request(ctx, booking_id)
    if b.get("status") == "Requested" and b.get("consultant") == ctx.name:
        await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "Viewed", "updated_at": now_iso()}})
        await consult.timeline(ctx.tdb, b, "Viewed", ctx.name)
        b = await _my_request(ctx, booking_id)
    out = consult.booking_view(b, for_clinic=False)
    out["image_data"] = b.get("images") or []
    out["mine"] = b.get("consultant") == ctx.name
    return out


class AcceptBody(BaseModel):
    date: str = ""
    time: str = ""


@router.post("/requests/{booking_id}/accept")
async def accept_request(booking_id: str, body: AcceptBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """Accept: the requested slot (own choice), or take an open Dentor-choice request at a time of mine."""
    b = await _my_request(ctx, booking_id)
    if b.get("status") not in ("Requested", "Viewed"):
        raise HTTPException(status_code=400, detail=f"This request is {b.get('status', '').lower()}.")
    date, time = b.get("date", ""), b.get("time", "")
    if b.get("choice") == "dentor" and b.get("dentor_type") == "standard":
        if not body.date or not body.time:
            raise HTTPException(status_code=400, detail="Choose the date and time you will come.")
        date, time = parse_date(body.date), body.time
    if not date or not time:
        raise HTTPException(status_code=400, detail="This request has no time yet: choose one.")
    settings = await clinic_settings(ctx.tdb)
    if b.get("choice") == "dentor" or body.date:
        slot = next((s for s in await consult.consultant_slots(ctx.tdb, ctx.consultant, date, settings) if s["time"] == time), None)
        if b.get("dentor_type") == "standard" and (not slot or not slot["available"]):
            raise HTTPException(status_code=409, detail="That time is not free in your availability.")
    # claim an open request atomically: the first consultant to accept gets it
    claimed = await ctx.tdb.consultant_bookings.find_one_and_update(
        {"_id": b["_id"], "status": {"$in": ["Requested", "Viewed"]}, "consultant": {"$in": [ctx.name, ""]}},
        {"$set": {"consultant": ctx.name, "consultantId": str(ctx.consultant["_id"]), "consultantCode": ctx.consultant.get("code", ""),
                  "specialty": ctx.consultant.get("specialty", ""), "fee": float(ctx.consultant.get("fee") or 0), "status": "Accepting"}})
    if not claimed:
        raise HTTPException(status_code=409, detail="Another consultant has already taken this request.")
    try:
        appointment_id = await consult.mirror_appointment(ctx.tdb, claimed, ctx.name, date, time)
    except HTTPException:
        await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": b.get("status"), "consultant": b.get("consultant", "")}})
        raise
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {
        "status": "Confirmed", "date": date, "time": time, "appointmentId": appointment_id, "start_code": consult.new_start_code(),
        "updated_at": now_iso()}})
    await consult.timeline(ctx.tdb, b, "Confirmed", ctx.name)
    b = await _my_request(ctx, booking_id)
    await consult.tell_clinic(ctx.tdb, b, "Consultant confirmed", f"{ctx.name} will see {b.get('patient')} on {nice_date(date)} at {nice_time(time)}.")
    return consult.booking_view(b, for_clinic=False)


class ProposeBody(BaseModel):
    slots: list[AcceptBody]
    note: str = Field("", max_length=200)


@router.post("/requests/{booking_id}/propose")
async def propose_times(booking_id: str, body: ProposeBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Selected slots" (dentor.fig 3973:62953): offer up to three other times; the clinic picks one."""
    b = await _my_request(ctx, booking_id)
    if b.get("status") not in ("Requested", "Viewed") or b.get("consultant") != ctx.name:
        raise HTTPException(status_code=400, detail="Only a request addressed to you, not yet answered, can get other times.")
    if not 1 <= len(body.slots) <= 3:
        raise HTTPException(status_code=400, detail="Offer one to three times.")
    settings = await clinic_settings(ctx.tdb)
    proposals = []
    for s in body.slots:
        day = parse_date(s.date)
        slot = next((x for x in await consult.consultant_slots(ctx.tdb, ctx.consultant, day, settings) if x["time"] == s.time), None)
        if not slot or not slot["available"]:
            raise HTTPException(status_code=409, detail=f"{nice_date(day)} {nice_time(s.time)} is not free in your availability.")
        proposals.append({"date": day, "time": s.time})
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "Proposed", "proposals": proposals, "proposal_note": body.note.strip(), "updated_at": now_iso()}})
    await consult.timeline(ctx.tdb, b, "Proposed", ctx.name, body.note.strip())
    await consult.tell_clinic(ctx.tdb, b, "Consultant offered other times", f"{ctx.name} cannot make the requested time for {b.get('patient')}. Choose one of the offered times.")
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


class DeclineBody(BaseModel):
    reason: str = Field(..., max_length=200)


@router.post("/requests/{booking_id}/decline")
async def decline_request(booking_id: str, body: DeclineBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    b = await _my_request(ctx, booking_id)
    if b.get("consultant") != ctx.name or b.get("status") not in consult.OPEN:
        raise HTTPException(status_code=400, detail="Only an open request addressed to you can be declined.")
    if len(body.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Give a reason.")
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "Declined", "cancelReason": body.reason.strip(), "updated_at": now_iso()}})
    await consult.timeline(ctx.tdb, b, "Declined", ctx.name, body.reason.strip())
    await consult.tell_clinic(ctx.tdb, b, "Consultant declined", f"{ctx.name} declined {b.get('patient')}'s {b.get('treatment')}: {body.reason.strip()}.")
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


class TrackBody(BaseModel):
    status: str
    minutes: int = Field(0, ge=0, le=240)


@router.post("/requests/{booking_id}/track")
async def track(booking_id: str, body: TrackBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """Live status for the clinic: on the way, running late (minutes), arrived. (A live map needs a maps service; see the plan.)"""
    b = await _my_request(ctx, booking_id)
    if body.status not in consult.TRACKING:
        raise HTTPException(status_code=400, detail="Status must be On the way, Running late or Arrived.")
    if b.get("consultant") != ctx.name or b.get("status") not in ("Confirmed",) + consult.TRACKING:
        raise HTTPException(status_code=400, detail="Only a confirmed appointment of yours can be tracked.")
    note = f"{body.minutes} minutes late" if body.status == "Running late" and body.minutes else ""
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": body.status, "late_minutes": body.minutes, "updated_at": now_iso()}})
    await consult.timeline(ctx.tdb, b, body.status, ctx.name, note)
    text = {"On the way": f"{ctx.name} is on the way for {b.get('patient')}.",
            "Running late": f"{ctx.name} is running {body.minutes or 'a few'} minutes late for {b.get('patient')}.",
            "Arrived": f"{ctx.name} has arrived and is ready to start {b.get('treatment')}."}[body.status]
    await consult.tell_clinic(ctx.tdb, b, "Consultant arrived" if body.status == "Arrived" else body.status, text)
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


class StartBody(BaseModel):
    code: str = Field(..., min_length=4, max_length=4)


@router.post("/requests/{booking_id}/start")
async def start_procedure(booking_id: str, body: StartBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Start Procedure" (dentor.fig 3973:42644): the clinic reads its 4-digit code to the consultant at the chair."""
    b = await _my_request(ctx, booking_id)
    if b.get("consultant") != ctx.name or b.get("status") not in ("Confirmed",) + consult.TRACKING:
        raise HTTPException(status_code=400, detail="Only a confirmed appointment of yours can be started.")
    if int(b.get("start_attempts") or 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many wrong codes. Ask the clinic to read the code again from the Clinic app.")
    if not secrets_equal(body.code, b.get("start_code", "")):
        await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$inc": {"start_attempts": 1}})
        raise HTTPException(status_code=400, detail="That is not the clinic's code. Ask the clinic for the code shown in their app.")
    stamp = now_iso()
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "Started", "started_at": stamp, "updated_at": stamp}})
    if b.get("appointmentId"):
        await ctx.tdb.appointments.update_one({"_id": to_object_id(b["appointmentId"])}, {"$set": {"status": "Waiting", "updated_at": stamp}})
    await consult.timeline(ctx.tdb, b, "Started", ctx.name)
    await consult.tell_clinic(ctx.tdb, b, "Procedure started", f"{ctx.name} started {b.get('treatment')} for {b.get('patient')}.")
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


def secrets_equal(a: str, b: str) -> bool:
    import hmac
    return bool(b) and hmac.compare_digest(str(a), str(b))


class VitalsBody(BaseModel):
    bp: str = Field("", max_length=12)
    glucose: str = Field("", max_length=12)


@router.post("/requests/{booking_id}/vitals")
async def update_vitals(booking_id: str, body: VitalsBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Vitals update" (dentor.fig 3973:41000)."""
    import re as _re
    b = await _my_request(ctx, booking_id)
    if b.get("consultant") != ctx.name or b.get("status") in consult.DONE:
        raise HTTPException(status_code=400, detail="Vitals can be updated on your open appointments only.")
    if body.bp and not _re.fullmatch(r"\d{2,3}/\d{2,3}", body.bp.strip()):
        raise HTTPException(status_code=400, detail="Write blood pressure like 120/80.")
    if body.glucose and not _re.fullmatch(r"\d{2,3}(\.\d)?", body.glucose.strip()):
        raise HTTPException(status_code=400, detail="Write blood glucose in mg/dL, like 110.")
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {"vitals": {"bp": body.bp.strip(), "glucose": body.glucose.strip()}, "updated_at": now_iso()}})
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


class CompleteBody(BaseModel):
    treatment_provided: str = Field(..., max_length=300)
    notes: str = Field("", max_length=1000)
    next_date: str = ""
    next_time: str = ""


@router.post("/requests/{booking_id}/complete")
async def complete_procedure(booking_id: str, body: CompleteBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"End Procedure" / "Complete Procedure" (dentor.fig 3973:42694, 3973:38065): what was done, notes and,
    when another sitting is needed, its date and time (booked at once as a confirmed visit)."""
    b = await _my_request(ctx, booking_id)
    if b.get("consultant") != ctx.name or b.get("status") != "Started":
        raise HTTPException(status_code=400, detail="Start the procedure with the clinic's code first.")
    if len(body.treatment_provided.strip()) < 2:
        raise HTTPException(status_code=400, detail="Say what treatment was provided.")
    stamp = now_iso()
    next_visit = None
    if body.next_date or body.next_time:
        if not body.next_date or not body.next_time:
            raise HTTPException(status_code=400, detail="Give both the date and the time of the next sitting.")
        day = parse_date(body.next_date)
        if day <= b.get("date", ""):
            raise HTTPException(status_code=400, detail="The next sitting must be after this one.")
        follow = {k: v for k, v in b.items() if k not in ("_id", "timeline", "start_code", "start_attempts", "appointmentId", "started_at",
                                                         "completed_at", "treatment_provided", "completion_notes", "proposals", "code")}
        follow.update({"status": "Confirmed", "date": day, "time": body.next_time, "previous_id": str(b["_id"]), "start_code": consult.new_start_code(),
                       "start_attempts": 0, "code": await next_sequence(ctx.tdb, "consultant_bookings", "CNS-", 2001), "created_at": stamp, "updated_at": stamp,
                       "timeline": [{"status": "Confirmed", "at": stamp, "by": ctx.name, "note": "Next sitting"}]})
        result = await ctx.tdb.consultant_bookings.insert_one(follow)
        follow["_id"] = result.inserted_id
        try:
            appt = await consult.mirror_appointment(ctx.tdb, follow, ctx.name, day, body.next_time)
        except HTTPException:
            await ctx.tdb.consultant_bookings.delete_one({"_id": result.inserted_id})
            raise
        await ctx.tdb.consultant_bookings.update_one({"_id": result.inserted_id}, {"$set": {"appointmentId": appt}})
        next_visit = {"id": str(result.inserted_id), "date": day, "time": body.next_time}
    await ctx.tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {
        "status": "Completed", "completed_at": stamp, "treatment_provided": body.treatment_provided.strip(),
        "completion_notes": body.notes.strip(), "next_visit": next_visit, "updated_at": stamp}})
    if b.get("appointmentId"):
        await ctx.tdb.appointments.update_one({"_id": to_object_id(b["appointmentId"])}, {"$set": {"status": "Completed", "updated_at": stamp}})
    await consult.timeline(ctx.tdb, b, "Completed", ctx.name, body.treatment_provided.strip())
    tail = f" Next sitting: {nice_date(next_visit['date'])} at {nice_time(next_visit['time'])}." if next_visit else ""
    await consult.tell_clinic(ctx.tdb, b, "Procedure completed", f"{ctx.name} completed {b.get('treatment')} for {b.get('patient')}.{tail}")
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


@router.post("/requests/{booking_id}/cancel")
async def consultant_cancel(booking_id: str, body: DeclineBody, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Cancel APPOINTMENT" (dentor.fig 3973:36639) for a confirmed appointment of mine."""
    from .clinic_app import cancel_booking
    b = await _my_request(ctx, booking_id)
    if b.get("consultant") != ctx.name:
        raise HTTPException(status_code=404, detail="Request not found.")
    await cancel_booking(ctx.tdb, b, body.reason, ctx.name)
    await consult.tell_clinic(ctx.tdb, b, "Consultant cancelled", f"{ctx.name} cancelled {b.get('patient')}'s {b.get('treatment')}: {body.reason.strip()}.")
    return consult.booking_view(await _my_request(ctx, booking_id), for_clinic=False)


# ------------------------------------------------------------- availability

@router.get("/availability")
async def get_availability(ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    return await consult.availability_of(ctx.tdb, ctx.consultant)


class Availability(BaseModel):
    weekly: dict[str, dict[str, list[str]]] = {}
    custom: dict[str, list[list[str]]] = {}
    agreed: bool = False


@router.put("/availability")
async def set_availability(body: Availability, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Set Availability" (dentor.fig 3973:48456, 5792:7761): default weekly hours (morning and evening) and custom days."""
    if not body.agreed:
        raise HTTPException(status_code=400, detail="Confirm that your hours are accurate and that you agree to the terms.")
    weekly: dict = {}
    for day, parts in body.weekly.items():
        if day not in consult.WEEKDAYS:
            raise HTTPException(status_code=400, detail=f"{day} is not a weekday.")
        clean = {}
        for part, rng in parts.items():
            if part not in ("morning", "evening") or len(rng) != 2 or not all(consult.valid_hhmm(t) for t in rng) or rng[0] >= rng[1]:
                raise HTTPException(status_code=400, detail=f"Check the {part} hours on {day.title()}: the start must be before the end.")
            clean[part] = rng
        weekly[day] = clean
    custom: dict = {}
    for day, ranges in body.custom.items():
        day = parse_date(day)
        for rng in ranges:
            if len(rng) != 2 or not all(consult.valid_hhmm(t) for t in rng) or rng[0] >= rng[1]:
                raise HTTPException(status_code=400, detail=f"Check the hours on {nice_date(day)}.")
        custom[day] = ranges
    await ctx.tdb.consultant_availability.update_one(
        {"consultant_id": str(ctx.consultant["_id"])},
        {"$set": {"weekly": weekly, "custom": custom, "updated_at": now_iso(), "consultant": ctx.name}}, upsert=True)
    return await consult.availability_of(ctx.tdb, ctx.consultant)


@router.get("/my-slots")
async def my_slots(date: str, ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """My free half-hours on a day, from my availability: used to accept or offer times."""
    day = parse_date(date)
    return {"date": day, "slots": await consult.consultant_slots(ctx.tdb, ctx.consultant, day, await clinic_settings(ctx.tdb))}


@router.get("/earnings/visits")
async def earning_visits(status: str = "all", ctx: ConsultantCtx = Depends(get_consultant_ctx)):
    """"Earnings history" (dentor.fig 414–417): my visits booked by clinics with their fee — completed (earned),
    pending (confirmed, not yet done) and cancelled (no fee). Payment itself happens outside the app."""
    groups = {"completed": ["Completed"], "pending": ["Confirmed", "On the way", "Running late", "Arrived", "Started"], "cancelled": ["Cancelled", "Declined"]}
    if status != "all" and status not in groups:
        raise HTTPException(status_code=400, detail="status is all, completed, pending or cancelled.")
    wanted = sum(groups.values(), []) if status == "all" else groups[status]
    items = await ctx.tdb.consultant_bookings.find({"consultant": ctx.name, "status": {"$in": wanted}}, {"images": 0, "start_code": 0}) \
        .sort("date", -1).limit(200).to_list(None)
    clinic = await ctx.tdb._db.clinics.find_one({"_id": to_object_id(ctx.tdb.clinic_id)})
    fee = lambda b: float(b.get("fee") or 0) + float(b.get("extra_fee") or 0)  # noqa: E731
    everything = await ctx.tdb.consultant_bookings.find({"consultant": ctx.name, "status": {"$in": sum(groups.values(), [])}}, {"status": 1, "fee": 1, "extra_fee": 1}).to_list(None)
    return {
        "clinic": (clinic or {}).get("name", ""),
        "totals": {k: sum(fee(b) for b in everything if b.get("status") in v) for k, v in groups.items() if k != "cancelled"},
        "items": [{"id": str(b["_id"]), "code": b.get("code", ""), "date": b.get("date", ""), "date_label": nice_date(b.get("date")) if b.get("date") else "",
                   "patient": b.get("patient", ""), "treatment": b.get("treatment", ""), "fee": fee(b), "status": b.get("status", ""),
                   "group": next(k for k, v in groups.items() if b.get("status") in v)} for b in items],
    }

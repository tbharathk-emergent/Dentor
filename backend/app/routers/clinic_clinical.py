"""Dentor Clinic app: clinical work — labs, lab complaints and invoices, recall, e-prescriptions,
certificates and the treatment tariff (dentor.fig #3–12, #152–191, #261–272, #303–306, #317–324).

Everything uses the collections the reception web app already has (lab_orders, prescriptions,
rx_combos, pharmacy_items, omni_templates, certificates, treatment_masters); labs and lab complaints
are new. Clinical writing (prescriptions, certificates, new medicines) is for owners, administrators
and dentists; labs and recall for the front desk; an accountant reads lab invoices.
"""
import re
from datetime import timedelta, date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..hooks import after_prescription, nice_date
from ..notify import notify_patient
from ..roles import CLINICAL_ROLES, CLINIC_APP_ROLES, FRONT_DESK_ROLES, require_roles
from ..rules import clinic_settings
from ..scheduling import clinic_today, parse_date
from ..tenancy import TenantDB, get_tenant
from ..db import db
from ..util import next_sequence, now_iso, serialize
from .clinic_app import _oid, _patient

router = APIRouter(prefix="/api/clinic-app", tags=["clinic app"],
                   dependencies=[Depends(require_roles(CLINIC_APP_ROLES, "This login cannot use the Dentor Clinic app."))])
front_desk = Depends(require_roles(FRONT_DESK_ROLES, "Your role can see this but not change it."))
clinical = Depends(require_roles(CLINICAL_ROLES, "Only a dentist, the owner or an administrator can write clinical records."))

LAB_TYPES = ("Blood", "X-ray", "Dental", "CBCT")
BLOOD_TESTS = ("CBC", "Blood Sugar", "HbA1c", "Lipid Profile", "Liver Function", "Kidney Function", "Coagulation Profile", "Thyroid Profile")
XRAY_TYPES = ("IOPA", "Bitewing", "Occlusal", "OPG", "Lateral Ceph")
DENTAL_WORK = ("Crown", "Bridge", "Veneer", "Inlay / Onlay", "Complete Denture", "Partial Denture", "Implant Crown", "Implant Bridge", "Night Guard", "Clear Retainer")
CBCT_INDICATIONS = ("Implant Planning", "Endodontics", "Oral Surgery", "Orthodontics", "TMJ", "Pathology")
FOV = ("Small FOV (5x5 cm)", "Medium FOV (8x8 cm)", "Large FOV (full maxillofacial)")
COMPLAINT_TYPES = ("Fit issue", "Shade mismatch", "Breakage", "Delay", "Wrong item", "Other")
TOOTH = re.compile(r"^([1-4][1-8]|[5-8][1-5])$")
MAX_FILE_CHARS = 2_800_000


def _strings(values: list, allowed: tuple, what: str) -> list[str]:
    out = []
    for v in values or []:
        if v not in allowed:
            raise HTTPException(status_code=400, detail=f"{v} is not a {what} this form offers.")
        out.append(v)
    return out


def _teeth(values: list) -> list[str]:
    for t in values or []:
        if not TOOTH.match(str(t)):
            raise HTTPException(status_code=400, detail=f"{t} is not a tooth number (FDI, like 11 or 46).")
    return [str(t) for t in values or []][:32]


def _files(values: list) -> list[str]:
    out = []
    for v in (values or [])[:3]:
        v = str(v or "")
        if not v.startswith(("data:image/", "data:application/pdf")) or len(v) > MAX_FILE_CHARS:
            raise HTTPException(status_code=400, detail="Attach photos or PDFs of up to 2 MB each.")
        out.append(v)
    return out


# ------------------------------------------------------------------------- labs

def _lab(l: dict) -> dict:
    return {"id": str(l["_id"]), "name": l.get("name", ""), "type": l.get("type", ""), "rating": l.get("rating", ""),
            "about": l.get("about", ""), "services": l.get("services") or [], "city": l.get("city", ""), "phone": l.get("phone", ""),
            "turnaround_days": l.get("turnaround_days", 5)}


@router.get("/labs")
async def labs(type: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """"Diagnostic Labs" (dentor.fig 160): blood, X-ray, dental and CBCT labs the clinic works with."""
    query: dict = {"status": {"$ne": "Inactive"}}
    if type:
        if type not in LAB_TYPES:
            raise HTTPException(status_code=400, detail=f"type is one of {', '.join(LAB_TYPES)}.")
        query["type"] = type
    items = await tdb.labs.find(query).sort("name", 1).to_list(None)
    counts = {t: await tdb.labs.count_documents({"type": t, "status": {"$ne": "Inactive"}}) for t in LAB_TYPES}
    return {"items": [_lab(l) for l in items], "counts": counts,
            "options": {"blood_tests": BLOOD_TESTS, "xray_types": XRAY_TYPES, "dental_work": DENTAL_WORK, "cbct_indications": CBCT_INDICATIONS,
                        "fov": FOV, "complaint_types": COMPLAINT_TYPES}}


@router.get("/labs/{lab_id}")
async def lab_profile(lab_id: str, tdb: TenantDB = Depends(get_tenant)):
    l = await tdb.labs.find_one({"_id": _oid(lab_id)})
    if not l:
        raise HTTPException(status_code=404, detail="Lab not found.")
    out = _lab(l)
    out["orders"] = await tdb.lab_orders.count_documents({"lab": l.get("name")})
    return out


class LabOrder(BaseModel):
    patient_id: str
    lab_id: str
    details: dict = {}
    date: str = ""
    time: str = ""
    notes: str = Field("", max_length=500)
    attachments: list[str] = []
    declaration: bool = False


@router.post("/lab-orders", status_code=201, dependencies=[front_desk])
async def book_lab(body: LabOrder, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"Book a Service": the form for the lab's kind — blood tests (dentor.fig 167), X-ray (176), dental lab work
    with shades and implant details (168–170, 189–191) or a CBCT referral (172–175) — then "sent" (178)."""
    if not body.declaration:
        raise HTTPException(status_code=400, detail="Confirm the declaration that the instructions are legible and the patient is eligible.")
    patient = await _patient(tdb, body.patient_id)
    lab = await tdb.labs.find_one({"_id": _oid(body.lab_id), "status": {"$ne": "Inactive"}})
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    d = body.details or {}
    kind = lab.get("type")
    clean: dict = {}
    if kind == "Blood":
        clean["tests"] = _strings(d.get("tests"), BLOOD_TESTS, "blood test")
        if not clean["tests"]:
            raise HTTPException(status_code=400, detail="Choose at least one test.")
        clean["collection"] = d.get("collection") if d.get("collection") in ("Home Visit", "Lab") else ""
        if not clean["collection"]:
            raise HTTPException(status_code=400, detail="Choose home visit or at the lab.")
        case = f"Blood test: {', '.join(clean['tests'])}"
    elif kind == "X-ray":
        if d.get("xray_type") not in XRAY_TYPES:
            raise HTTPException(status_code=400, detail="Choose the X-ray type.")
        clean.update({"xray_type": d["xray_type"], "teeth": _teeth(d.get("teeth")), "reason": str(d.get("reason", ""))[:200]})
        if d["xray_type"] in ("IOPA", "Bitewing") and not clean["teeth"]:
            raise HTTPException(status_code=400, detail="Select the teeth for this X-ray.")
        case = f"X-ray: {d['xray_type']}"
    elif kind == "Dental":
        if d.get("work") not in DENTAL_WORK:
            raise HTTPException(status_code=400, detail="Choose the work needed (crown, bridge, denture…).")
        clean.update({"work": d["work"], "teeth": _teeth(d.get("teeth")), "material": str(d.get("material", ""))[:60],
                      "shade_guide": str(d.get("shade_guide", ""))[:40], "primary_shade": str(d.get("primary_shade", ""))[:10],
                      "stump_shade": str(d.get("stump_shade", ""))[:10], "cervical_shade": str(d.get("cervical_shade", ""))[:10],
                      "pontic_design": str(d.get("pontic_design", ""))[:40], "margin_design": str(d.get("margin_design", ""))[:40],
                      "implant_system": str(d.get("implant_system", ""))[:60], "abutment": str(d.get("abutment", ""))[:60]})
        if not clean["teeth"]:
            raise HTTPException(status_code=400, detail="Select the teeth for this work.")
        case = clean["work"]
    elif kind == "CBCT":
        clean.update({"indications": _strings(d.get("indications"), CBCT_INDICATIONS, "clinical indication"),
                      "region": d.get("region") if d.get("region") in ("Maxilla", "Mandible", "Full Maxillofacial") else "",
                      "fov": d.get("fov") if d.get("fov") in FOV else "", "consent": bool(d.get("consent"))})
        if not clean["indications"] or not clean["region"] or not clean["fov"]:
            raise HTTPException(status_code=400, detail="Tick the indications and choose the region and field of view.")
        if not clean["consent"]:
            raise HTTPException(status_code=400, detail="The patient's consent to the CBCT scan is required.")
        case = "CBCT scan"
    else:
        raise HTTPException(status_code=400, detail="This lab has no service form.")
    settings = await clinic_settings(tdb)
    today = clinic_today(settings)
    when = parse_date(body.date) if body.date else today
    if when < today:
        raise HTTPException(status_code=400, detail="Choose a date from today on.")
    due = (date_cls.fromisoformat(when) + timedelta(days=int(lab.get("turnaround_days") or 5))).isoformat()
    stamp = now_iso()
    doc = {
        "code": await next_sequence(tdb, "lab_orders", "LAB-", 2685), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""),
        "patientId": str(patient["_id"]), "caseType": case, "kind": kind, "details": clean, "teeth": ", ".join(clean.get("teeth", [])),
        "shade": clean.get("primary_shade", ""), "material": clean.get("material", ""), "doctor": user.get("name", ""), "lab": lab.get("name", ""),
        "labId": str(lab["_id"]), "received": when, "time": body.time if re.fullmatch(r"\d{2}:\d{2}", body.time or "") else "", "due": due,
        "stage": "Order Received", "status": "In Progress", "priority": "Normal", "amount": 0, "paid": 0, "progress": 17,
        "notes": body.notes.strip(), "attachments": _files(body.attachments), "source": "Clinic App",
        "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", ""),
    }
    result = await tdb.lab_orders.insert_one(doc)
    return _order(await tdb.lab_orders.find_one({"_id": result.inserted_id}))


def _order(o: dict) -> dict:
    out = serialize({k: v for k, v in o.items() if k not in ("attachments", "clinic_id")})
    out["attachments"] = len(o.get("attachments") or [])
    amount, paid = float(o.get("amount") or 0), float(o.get("paid") or 0)
    out.update({"due_label": nice_date(o.get("due")), "balance": max(0.0, amount - paid)})
    return out


@router.get("/lab-orders")
async def lab_orders(scope: str = "ongoing", q: str = "", tdb: TenantDB = Depends(get_tenant)):
    """"Ongoing Cases" and the completed ones."""
    query: dict = {"status": {"$nin": ["Delivered"]}} if scope == "ongoing" else {"status": "Delivered"} if scope == "completed" else {}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"patient": rx}, {"code": rx}, {"lab": rx}, {"caseType": rx}]
    items = await tdb.lab_orders.find(query).sort("received", -1).limit(100).to_list(None)
    return {"items": [_order(o) for o in items]}


@router.get("/lab-invoices")
async def lab_invoices(tdb: TenantDB = Depends(get_tenant)):
    """"Invoice" (dentor.fig 188): what each lab order costs, what is paid and the receipts."""
    orders = await tdb.lab_orders.find({"amount": {"$gt": 0}}).sort("received", -1).limit(100).to_list(None)
    receipts = await tdb.lab_payments.find({}).sort("date", -1).limit(100).to_list(None)
    return {"items": [_order(o) for o in orders],
            "receipts": [serialize({k: v for k, v in r.items() if k != "clinic_id"}) for r in receipts],
            "totals": {"billed": sum(float(o.get("amount") or 0) for o in orders), "paid": sum(float(o.get("paid") or 0) for o in orders)}}


# ------------------------------------------------------------------- complaints

class Complaint(BaseModel):
    order_id: str
    type: str
    description: str = Field(..., max_length=1000)
    attachments: list[str] = []


def _complaint(c: dict) -> dict:
    out = serialize({k: v for k, v in c.items() if k not in ("attachments", "clinic_id")})
    out["attachments"] = len(c.get("attachments") or [])
    return out


@router.get("/lab-complaints")
async def complaints(status: str = "New", tdb: TenantDB = Depends(get_tenant)):
    """"COMPLAINTS" (dentor.fig 179–183): new, ongoing (In progress) and completed (Resolved)."""
    if status not in ("New", "In progress", "Resolved", "all"):
        raise HTTPException(status_code=400, detail="status is New, In progress, Resolved or all.")
    query = {} if status == "all" else {"status": status}
    items = await tdb.lab_complaints.find(query).sort("created_at", -1).limit(100).to_list(None)
    counts = {s: await tdb.lab_complaints.count_documents({"status": s}) for s in ("New", "In progress", "Resolved")}
    return {"items": [_complaint(c) for c in items], "counts": counts}


@router.post("/lab-complaints", status_code=201, dependencies=[front_desk])
async def raise_complaint(body: Complaint, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"Create complaints" (dentor.fig 184); "submitted" (187)."""
    order = await tdb.lab_orders.find_one({"_id": _oid(body.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found.")
    if body.type not in COMPLAINT_TYPES:
        raise HTTPException(status_code=400, detail="Choose the complaint type.")
    if len(body.description.strip()) < 5:
        raise HTTPException(status_code=400, detail="Describe the problem.")
    stamp = now_iso()
    doc = {"code": await next_sequence(tdb, "lab_complaints", "LCM-", 101), "order_id": str(order["_id"]), "order_code": order.get("code", ""),
           "patient": order.get("patient", ""), "patientCode": order.get("patientCode", ""), "lab": order.get("lab", ""), "treatment": order.get("caseType", ""),
           "type": body.type, "description": body.description.strip(), "attachments": _files(body.attachments), "status": "New",
           "timeline": [{"status": "New", "at": stamp, "by": user.get("name") or user.get("email", "")}],
           "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.lab_complaints.insert_one(doc)
    return _complaint(await tdb.lab_complaints.find_one({"_id": result.inserted_id}))


class ComplaintStatus(BaseModel):
    status: str
    note: str = Field("", max_length=300)


@router.post("/lab-complaints/{complaint_id}/status", dependencies=[front_desk])
async def complaint_status(complaint_id: str, body: ComplaintStatus, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """The lab is working on it (In progress), or "marked as resolved" (dentor.fig 186)."""
    c = await tdb.lab_complaints.find_one({"_id": _oid(complaint_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    allowed = {"New": ("In progress", "Resolved"), "In progress": ("Resolved",), "Resolved": ()}[c.get("status", "New")]
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"A {c.get('status', '').lower()} complaint cannot become {body.status.lower()}.")
    stamp = now_iso()
    await tdb.lab_complaints.update_one({"_id": c["_id"]}, {"$set": {"status": body.status, "updated_at": stamp},
                                                           "$push": {"timeline": {"status": body.status, "at": stamp, "by": user.get("name") or user.get("email", ""), "note": body.note.strip()}}})
    return _complaint(await tdb.lab_complaints.find_one({"_id": c["_id"]}))


# ----------------------------------------------------------------------- recall

def _template(t: dict) -> dict:
    return {"id": str(t["_id"]), "name": t.get("name", ""), "text": t.get("text", ""), "category": t.get("category", "")}


@router.get("/recall/templates")
async def recall_templates(tdb: TenantDB = Depends(get_tenant)):
    """"Message Templates" (dentor.fig 152)."""
    items = await tdb.omni_templates.find({"category": "Recall"}).sort("name", 1).to_list(None)
    return {"items": [_template(t) for t in items]}


class Template(BaseModel):
    name: str = Field(..., max_length=60)
    text: str = Field(..., max_length=160)


def _check_template(body: Template) -> None:
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Give the template a name.")
    if len(body.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Write the message (at least a sentence).")


@router.post("/recall/templates", status_code=201, dependencies=[front_desk])
async def create_template(body: Template, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"Create template" (dentor.fig 157): up to 160 characters, as the design's counter shows."""
    _check_template(body)
    stamp = now_iso()
    result = await tdb.omni_templates.insert_one({"code": await next_sequence(tdb, "omni_templates", "TPL-", 7), "name": body.name.strip(),
                                                  "text": body.text.strip(), "category": "Recall", "channel": "App", "status": "Approved",
                                                  "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")})
    return _template(await tdb.omni_templates.find_one({"_id": result.inserted_id}))


@router.patch("/recall/templates/{template_id}", dependencies=[front_desk])
async def edit_template(template_id: str, body: Template, tdb: TenantDB = Depends(get_tenant)):
    """"Edit Template" (dentor.fig 156); "successfully updated" (158)."""
    _check_template(body)
    t = await tdb.omni_templates.find_one({"_id": _oid(template_id), "category": "Recall"})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found.")
    await tdb.omni_templates.update_one({"_id": t["_id"]}, {"$set": {"name": body.name.strip(), "text": body.text.strip(), "updated_at": now_iso()}})
    return _template(await tdb.omni_templates.find_one({"_id": t["_id"]}))


class RecallBody(BaseModel):
    patient_id: str
    message: str = Field(..., max_length=500)
    due: str = ""
    template_id: str = ""


@router.post("/recall", status_code=201, dependencies=[front_desk])
async def send_recall(body: RecallBody, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"Recall" (dentor.fig 153–155): the message goes to the patient app's notifications. SMS and WhatsApp are
    excluded, so a patient without the app is reported back for a phone call instead."""
    patient = await _patient(tdb, body.patient_id)
    clinic = await db.clinics.find_one({"_id": _oid(tdb.clinic_id)})
    text = body.message.replace("[Patient Name]", patient.get("name", "")).replace("[Clinic Name]", (clinic or {}).get("name", "")).strip()
    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Write the message (at least a sentence).")
    due = parse_date(body.due) if body.due else ""
    mobile = re.sub(r"\D", "", patient.get("mobile", ""))[-10:]
    has_app = bool(mobile) and bool(await db.patient_accounts.find_one({"mobile": {"$regex": f"{mobile}$"}, "status": {"$ne": "Disabled"}}))
    if has_app:
        await notify_patient(db, tdb.clinic_id, str(patient["_id"]), "A reminder from your clinic", text, "recall", {"screen": "book"})
    stamp = now_iso()
    doc = {"patientId": str(patient["_id"]), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""), "message": text,
           "due": due, "template_id": body.template_id, "channel": "Patient app" if has_app else "Not sent: no patient app",
           "delivered": has_app, "sent_at": stamp, "created_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.recalls.insert_one(doc)
    out = serialize({k: v for k, v in doc.items() if k != "clinic_id"})
    out["id"] = str(result.inserted_id)
    out["mobile"] = patient.get("mobile", "")
    return out


@router.get("/recall")
async def recall_history(patient_id: str = "", tdb: TenantDB = Depends(get_tenant)):
    query = {"patientId": patient_id} if patient_id else {}
    items = await tdb.recalls.find(query).sort("sent_at", -1).limit(100).to_list(None)
    return {"items": [serialize({k: v for k, v in r.items() if k != "clinic_id"}) for r in items]}


# --------------------------------------------------------------- e-prescription

@router.get("/rx/catalog")
async def rx_catalog(tdb: TenantDB = Depends(get_tenant)):
    """Drugs by category and type, the saved combos, and recent prescriptions to copy (dentor.fig 261–270)."""
    drugs = await tdb.pharmacy_items.find({"status": {"$ne": "Inactive"}}).sort("name", 1).to_list(None)
    combos = await tdb.rx_combos.find({}).sort("name", 1).to_list(None)
    recent = await tdb.prescriptions.find({}).sort("created_at", -1).limit(15).to_list(None)
    return {
        "drugs": [{"id": str(x["_id"]), "name": x.get("name", ""), "category": x.get("category", ""), "type": x.get("form", ""),
                   "dosage": x.get("dosage", "")} for x in drugs],
        "categories": sorted({x.get("category", "") for x in drugs if x.get("category")}),
        "types": sorted({x.get("form", "") for x in drugs if x.get("form")} | {"Tablet", "Capsule", "Ointment - Gel", "Ointment - Paste", "Mouth wash", "Syrup", "Injection"}),
        "combos": [{"id": str(c["_id"]), "name": c.get("name", ""), "meds": c.get("meds") or []} for c in combos],
        "recent": [{"id": str(p["_id"]), "code": p.get("code", ""), "patient": p.get("patient", ""), "patientCode": p.get("patientCode", ""),
                    "date": p.get("date", ""), "meds": p.get("meds") or []} for p in recent],
    }


class NewDrug(BaseModel):
    name: str = Field(..., max_length=80)
    category: str = Field(..., max_length=40)
    type: str = Field(..., max_length=30)
    dosage: str = Field("", max_length=40)


@router.post("/rx/drugs", status_code=201, dependencies=[clinical])
async def add_drug(body: NewDrug, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"add new medicine" (dentor.fig 303–304): it joins the prescription list (stock is managed at the pharmacy)."""
    name = body.name.strip()
    if len(name) < 2 or not body.category.strip() or not body.type.strip():
        raise HTTPException(status_code=400, detail="Give the medicine's name, category and type.")
    if await tdb.pharmacy_items.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail=f"{name} is already in the list.")
    stamp = now_iso()
    doc = {"code": await next_sequence(tdb, "pharmacy_items", "MED-", 1011), "name": name, "category": body.category.strip(), "form": body.type.strip(),
           "dosage": body.dosage.strip(), "stock": 0, "reorder": 0, "purchasePrice": 0, "salePrice": 0, "gst": 0, "status": "Active", "unit": "",
           "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.pharmacy_items.insert_one(doc)
    return {"id": str(result.inserted_id), "name": name, "category": doc["category"], "type": doc["form"], "dosage": doc["dosage"]}


class Med(BaseModel):
    drug: str = Field(..., max_length=80)
    dose: str = Field("", max_length=40)
    freq: str = Field("", max_length=20)
    days: str = Field("", max_length=6)
    unit: str = Field("Days", max_length=10)
    instruction: str = Field("", max_length=80)


class Prescription(BaseModel):
    patient_id: str
    complaint: str = Field("", max_length=200)
    diagnosis: str = Field("", max_length=200)
    meds: list[Med]
    advice: str = Field("", max_length=500)
    followUp: str = ""
    note: str = Field("", max_length=500)


@router.post("/prescriptions", status_code=201, dependencies=[clinical])
async def write_prescription(body: Prescription, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"E-prescription" (dentor.fig 261), "PREVIEW" (272): it reaches the patient app, as the web app's do."""
    if not body.meds:
        raise HTTPException(status_code=400, detail="Add at least one medicine.")
    for m in body.meds:
        if not m.drug.strip():
            raise HTTPException(status_code=400, detail="Every medicine needs a name.")
        if m.days and not m.days.isdigit():
            raise HTTPException(status_code=400, detail=f"Duration of {m.drug} must be a number of days.")
    patient = await _patient(tdb, body.patient_id)
    settings = await clinic_settings(tdb)
    follow = parse_date(body.followUp) if body.followUp else ""
    if follow and follow <= clinic_today(settings):
        raise HTTPException(status_code=400, detail="The next appointment must be after today.")
    stamp = now_iso()
    doc = {"code": await next_sequence(tdb, "prescriptions", "RX-", 1001), "patient": patient.get("name", ""), "patientCode": patient.get("code", ""),
           "patientId": str(patient["_id"]), "age": patient.get("age", ""), "gender": patient.get("gender", ""), "allergy": patient.get("allergy", ""),
           "date": clinic_today(settings), "doctor": user.get("name", ""), "complaint": body.complaint.strip(), "diagnosis": body.diagnosis.strip(),
           "note": body.note.strip(), "meds": [m.model_dump() for m in body.meds], "advice": body.advice.strip(), "followUp": follow, "status": "Signed",
           "source": "Clinic App", "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.prescriptions.insert_one(doc)
    saved = await tdb.prescriptions.find_one({"_id": result.inserted_id})
    await after_prescription(tdb, "create", saved, None)
    return serialize({k: v for k, v in saved.items() if k != "clinic_id"})


@router.get("/prescriptions")
async def prescriptions(patient_id: str = "", q: str = "", tdb: TenantDB = Depends(get_tenant)):
    query: dict = {}
    if patient_id:
        p = await _patient(tdb, patient_id)
        query["patientCode"] = p.get("code", "")
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"patient": rx}, {"code": rx}, {"diagnosis": rx}]
    items = await tdb.prescriptions.find(query).sort("created_at", -1).limit(100).to_list(None)
    return {"items": [serialize({k: v for k, v in p.items() if k != "clinic_id"}) for p in items]}


# ------------------------------------------------------------------ certificates

class Certificate(BaseModel):
    patient_id: str
    type: str  # Fitness | Referral
    marital_status: str = Field("", max_length=20)
    examination: str = Field("", max_length=200)
    findings: str = Field("", max_length=500)
    fitness: str = Field("", max_length=60)
    remarks: str = Field("", max_length=500)
    specialist: str = Field("", max_length=80)
    reason: str = Field("", max_length=300)
    investigations: str = Field("", max_length=300)
    date: str = ""


@router.post("/certificates", status_code=201, dependencies=[clinical])
async def issue_certificate(body: Certificate, tdb: TenantDB = Depends(get_tenant), user: dict = Depends(get_current_user)):
    """"Fitness certificate" (dentor.fig 320) and "Referral certificate" (322–323), then the preview (321, 324)."""
    if body.type not in ("Fitness", "Referral"):
        raise HTTPException(status_code=400, detail="Choose a fitness or a referral certificate.")
    if body.type == "Fitness" and (not body.findings.strip() or not body.fitness.strip()):
        raise HTTPException(status_code=400, detail="Give the findings and the fitness opinion.")
    if body.type == "Referral" and (not body.specialist.strip() or len(body.reason.strip()) < 3):
        raise HTTPException(status_code=400, detail="Give the specialist and the reason for referral.")
    patient = await _patient(tdb, body.patient_id)
    settings = await clinic_settings(tdb)
    stamp = now_iso()
    doc = {"code": await next_sequence(tdb, "certificates", "CERT-", 1001), "type": body.type, "patient": patient.get("name", ""),
           "patientCode": patient.get("code", ""), "patientId": str(patient["_id"]), "age": patient.get("age", ""), "gender": patient.get("gender", ""),
           "mobile": patient.get("mobile", ""), "address": ", ".join(x for x in (patient.get("address"), patient.get("city")) if x),
           "doctor": user.get("name", ""), "date": parse_date(body.date) if body.date else clinic_today(settings),
           "details": {k: v.strip() for k, v in body.model_dump().items() if isinstance(v, str) and k not in ("patient_id", "type", "date") and v.strip()},
           "status": "Issued", "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.certificates.insert_one(doc)
    return serialize({k: v for k, v in (await tdb.certificates.find_one({"_id": result.inserted_id})).items() if k != "clinic_id"})


@router.get("/certificates")
async def certificates(type: str = "", q: str = "", tdb: TenantDB = Depends(get_tenant)):
    query: dict = {}
    if type:
        query["type"] = type
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"patient": rx}, {"code": rx}, {"doctor": rx}]
    items = await tdb.certificates.find(query).sort("created_at", -1).limit(100).to_list(None)
    return {"items": [serialize({k: v for k, v in c.items() if k != "clinic_id"}) for c in items]}


@router.get("/certificates/{certificate_id}")
async def certificate(certificate_id: str, tdb: TenantDB = Depends(get_tenant)):
    c = await tdb.certificates.find_one({"_id": _oid(certificate_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    clinic = await db.clinics.find_one({"_id": _oid(tdb.clinic_id)})
    out = serialize({k: v for k, v in c.items() if k != "clinic_id"})
    out["clinic"] = {"name": (clinic or {}).get("name", ""), "address": (clinic or {}).get("address", ""), "phone": (clinic or {}).get("phone", ""),
                     "city": (clinic or {}).get("city", "")}
    return out


# ----------------------------------------------------------------------- tariff

@router.get("/tariff")
async def tariff(tdb: TenantDB = Depends(get_tenant)):
    """"Treatment tariff" (dentor.fig 305–306): the clinic's treatments and fees, by speciality."""
    items = await tdb.treatment_masters.find({"status": {"$ne": "Inactive"}}).sort([("category", 1), ("name", 1)]).to_list(None)
    groups: dict[str, list] = {}
    for t in items:
        groups.setdefault(t.get("category") or "Other", []).append({
            "name": t.get("name", ""), "code": t.get("code", ""), "price": float(t.get("price") or 0), "duration": t.get("duration", ""),
            "unit": t.get("unit", ""), "description": t.get("description", "")})
    return {"groups": [{"category": k, "items": v} for k, v in groups.items()]}

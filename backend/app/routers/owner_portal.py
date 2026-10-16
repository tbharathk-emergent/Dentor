"""Dentor Clinic app API (formerly the owner app): clinic-wide figures and oversight.

Overview and operations are open to every role the Clinic app admits; money (finance) to the
owner, administrators and accountants; the team and the clinic record to owners and administrators.

Everything is computed from the same clinic-scoped collections the reception app writes,
so the owner sees live figures. A super admin may call these for a chosen clinic.
"""
from datetime import date as date_cls, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import db
from ..hooks import nice_date, nice_time
from ..auth import get_current_user
from ..roles import CLINIC_ADMIN_ROLES, CLINIC_APP_ROLES, FINANCE_ROLES, has_role, require_roles
from ..rules import clinic_settings
from ..scheduling import clinic_today, parse_date
from ..tenancy import TenantDB, get_tenant
from ..util import now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/owner", tags=["clinic app"], dependencies=[Depends(require_roles(CLINIC_APP_ROLES, "This login cannot use the Dentor Clinic app."))])
finance_only = Depends(require_roles(FINANCE_ROLES, "Only the owner, an administrator or an accountant can see the clinic's money."))
admin_only = Depends(require_roles(CLINIC_ADMIN_ROLES, "Only the clinic owner or an administrator can do this."))

MAX_RANGE_DAYS = 366


def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


async def _range(tdb: TenantDB, date_from: Optional[str], date_to: Optional[str]) -> tuple[str, str, str]:
    """(start, end, today) — defaults to the current month to date."""
    today = clinic_today(await clinic_settings(tdb))
    start = parse_date(date_from) if date_from else today[:8] + "01"
    end = parse_date(date_to) if date_to else today
    if start > end:
        raise HTTPException(status_code=400, detail="The start date must be before the end date.")
    if (date_cls.fromisoformat(end) - date_cls.fromisoformat(start)).days > MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail="Choose a period of one year or less.")
    return start, end, today


def _days(start: str, end: str) -> list[str]:
    d0, d1 = date_cls.fromisoformat(start), date_cls.fromisoformat(end)
    return [(d0 + timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)]


@router.get("/overview")
async def overview(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant),
                   user: dict = Depends(get_current_user)):
    start, end, today = await _range(tdb, date_from, date_to)
    in_range = {"date": {"$gte": start, "$lte": end}}
    invoices = await tdb.invoices.find(in_range).to_list(None)
    payments = await tdb.payments.find(in_range).to_list(None)
    appointments = await tdb.appointments.find(in_range).to_list(None)
    all_invoices = await tdb.invoices.find({}, {"balance": 1}).to_list(None)

    by_status: dict[str, int] = {}
    for a in appointments:
        by_status[a.get("status") or "Scheduled"] = by_status.get(a.get("status") or "Scheduled", 0) + 1

    # Daily series (collections + appointments); long ranges are bucketed by the app if needed.
    days = _days(start, end)[-62:]
    collected_by_day = {d: 0.0 for d in days}
    appts_by_day = {d: 0 for d in days}
    for p in payments:
        if p.get("date") in collected_by_day:
            collected_by_day[p["date"]] += _f(p.get("amount"))
    for a in appointments:
        if a.get("date") in appts_by_day:
            appts_by_day[a["date"]] += 1

    todays = await tdb.appointments.find({"date": today}).to_list(None)
    billed = sum(_f(i.get("total")) for i in invoices)
    out = {
        "from": start, "to": end, "today": today,
        "billed": billed,
        "collected": sum(_f(p.get("amount")) for p in payments),
        "outstanding": sum(_f(i.get("balance")) for i in all_invoices),
        "invoices": len(invoices),
        "average_invoice": round(billed / len(invoices)) if invoices else 0,
        "appointments": len(appointments),
        "appointments_by_status": by_status,
        "patients_total": await tdb.patients.count_documents({}),
        "patients_new": await tdb.patients.count_documents({"created_at": {"$gte": start, "$lte": end + "T23:59:59.999999+00:00"}}),
        "series": [{"date": d, "label": datetime.strptime(d, "%Y-%m-%d").strftime("%d %b"),
                    "collected": collected_by_day[d], "appointments": appts_by_day[d]} for d in days],
        "today_summary": {
            "appointments": len(todays),
            "waiting": sum(1 for a in todays if a.get("status") == "Waiting"),
            "completed": sum(1 for a in todays if a.get("status") == "Completed"),
            "collected": sum(_f(p.get("amount")) for p in await tdb.payments.find({"date": today}).to_list(None)),
        },
        "money": True,
    }
    if not has_role(user, FINANCE_ROLES):
        # Front desk and dentists see the clinic's activity, not its money.
        for key in ("billed", "collected", "outstanding", "average_invoice"):
            out[key] = None
        out["today_summary"]["collected"] = None
        out["series"] = [{**day, "collected": None} for day in out["series"]]
        out["money"] = False
    return out


@router.get("/finance", dependencies=[finance_only])
async def finance(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    start, end, _ = await _range(tdb, date_from, date_to)
    in_range = {"date": {"$gte": start, "$lte": end}}
    invoices = await tdb.invoices.find(in_range).sort("date", -1).to_list(None)
    payments = await tdb.payments.find(in_range).sort("date", -1).to_list(None)

    def bucket(rows, key, amount):
        out: dict[str, dict] = {}
        for r in rows:
            k = r.get(key) or "Other"
            b = out.setdefault(k, {"name": k, "amount": 0.0, "count": 0})
            b["amount"] += _f(r.get(amount))
            b["count"] += 1
        return sorted(out.values(), key=lambda b: -b["amount"])

    due = await tdb.invoices.find({"balance": {"$gt": 0}}).sort("date", 1).limit(100).to_list(None)
    return {
        "from": start, "to": end,
        "billed": sum(_f(i.get("total")) for i in invoices),
        "collected": sum(_f(p.get("amount")) for p in payments),
        "by_mode": bucket(payments, "mode", "amount"),
        "by_doctor": bucket(invoices, "doctor", "total"),
        "by_treatment": bucket(invoices, "treatment", "total")[:12],
        "outstanding_total": sum(_f(i.get("balance")) for i in due),
        "outstanding": [{"id": str(i["_id"]), "number": i.get("number", ""), "date": i.get("date", ""),
                         "date_label": nice_date(i.get("date")), "patient": i.get("patient", ""),
                         "doctor": i.get("doctor", ""), "total": i.get("total", 0), "balance": i.get("balance", 0),
                         "status": i.get("status", "")} for i in due],
        "recent_payments": [{"id": str(p["_id"]), "receipt": p.get("receipt", ""), "date": p.get("date", ""),
                             "date_label": nice_date(p.get("date")), "patient": p.get("patient", ""),
                             "mode": p.get("mode", ""), "amount": p.get("amount", 0), "invoice": p.get("invoice", "")}
                            for p in payments[:50]],
    }


@router.get("/operations")
async def operations(tdb: TenantDB = Depends(get_tenant)):
    settings = await clinic_settings(tdb)
    today = clinic_today(settings)
    appts = await tdb.appointments.find({"date": today}).sort("time", 1).to_list(None)
    labs = await tdb.lab_orders.find({}).to_list(None)
    pharmacy = await tdb.pharmacy_items.find({}).to_list(None)
    inventory = await tdb.inventory_items.find({}).to_list(None)
    leads = await tdb.leads.find({}).to_list(None)
    reviews = await tdb.reviews.find({}).to_list(None)

    def low(items, name_key="name"):
        rows = [i for i in items if _f(i.get("stock")) <= _f(i.get("reorder"))]
        return [{"id": str(i["_id"]), "name": i.get(name_key, ""), "code": i.get("code", ""), "stock": i.get("stock", 0),
                 "reorder": i.get("reorder", 0), "out": _f(i.get("stock")) <= 0} for i in sorted(rows, key=lambda r: _f(r.get("stock")))]

    lab_by_status: dict[str, int] = {}
    for o in labs:
        lab_by_status[o.get("status") or "In Progress"] = lab_by_status.get(o.get("status") or "In Progress", 0) + 1
    lead_by_stage: dict[str, int] = {}
    for lead in leads:
        lead_by_stage[lead.get("stage") or "New"] = lead_by_stage.get(lead.get("stage") or "New", 0) + 1
    rated = [r for r in reviews if r.get("rating")]
    return {
        "today": today,
        "appointments": [{"id": str(a["_id"]), "time": a.get("time", ""), "time_label": nice_time(a.get("time")),
                          "patient": a.get("patient", ""), "treatment": a.get("treatment", ""), "doctor": a.get("doctor", ""),
                          "chair": a.get("chair", ""), "status": a.get("status", ""), "source": a.get("source", "")} for a in appts],
        "lab": {"by_status": lab_by_status,
                "attention": [{"id": str(o["_id"]), "code": o.get("code", ""), "patient": o.get("patient", ""),
                               "caseType": o.get("caseType", ""), "lab": o.get("lab", ""), "due": o.get("due", ""),
                               "due_label": nice_date(o.get("due")), "status": o.get("status", ""), "stage": o.get("stage", "")}
                              for o in labs if o.get("status") in ("Delayed", "Ready")]},
        "pharmacy_low": low(pharmacy), "inventory_low": low(inventory),
        "leads": {"total": len(leads), "by_stage": lead_by_stage,
                  "pipeline_value": sum(_f(x.get("value")) for x in leads if x.get("stage") not in ("Converted", "Lost"))},
        "reviews": {"total": len(reviews), "pending": sum(1 for r in reviews if r.get("status") in ("Pending", "Flagged")),
                    "average": round(sum(_f(r.get("rating")) for r in rated) / len(rated), 1) if rated else 0},
    }


@router.get("/team", dependencies=[admin_only])
async def team(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    start, end, _ = await _range(tdb, date_from, date_to)
    in_range = {"date": {"$gte": start, "$lte": end}}
    consultants = await tdb.consultants.find({}).sort("name", 1).to_list(None)
    appts = await tdb.appointments.find(in_range).to_list(None)
    invoices = await tdb.invoices.find(in_range).to_list(None)
    staff = await tdb.staff.find({}).sort("name", 1).to_list(None)
    doctors = []
    for c in consultants:
        name = c.get("name", "")
        mine = [a for a in appts if a.get("doctor") == name]
        bills = [i for i in invoices if i.get("doctor") == name]
        doctors.append({
            "id": str(c["_id"]), "name": name, "code": c.get("code", ""), "specialty": c.get("specialty", ""),
            "type": c.get("type", ""), "status": c.get("status", ""),
            "appointments": len(mine), "completed": sum(1 for a in mine if a.get("status") == "Completed"),
            "billed": sum(_f(i.get("total")) for i in bills), "collected": sum(_f(i.get("paid")) for i in bills),
        })
    return {
        "from": start, "to": end,
        "doctors": sorted(doctors, key=lambda d: -d["billed"]),
        "staff": [{"id": str(s["_id"]), "code": s.get("code", ""), "name": s.get("name", ""), "role": s.get("role", ""),
                   "department": s.get("department", ""), "mobile": s.get("mobile", ""), "status": s.get("status", ""),
                   "employment": s.get("employment", "")} for s in staff],
    }


class ClinicUpdate(BaseModel):
    phone: Optional[str] = Field(default=None, max_length=30)
    email: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=80)


def _clinic(clinic: dict) -> dict:
    out = serialize(clinic)
    out.pop("created_by", None)
    return out


@router.get("/clinic")
async def clinic_profile(tdb: TenantDB = Depends(get_tenant)):
    clinic = await db.clinics.find_one({"_id": to_object_id(tdb.clinic_id)})
    settings = await clinic_settings(tdb)
    return {"clinic": _clinic(clinic), "settings": settings}


@router.patch("/clinic", dependencies=[admin_only])
async def update_clinic_profile(body: ClinicUpdate, tdb: TenantDB = Depends(get_tenant)):
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if "email" in changes:
        changes["email"] = changes["email"].lower()
    if changes:
        changes["updated_at"] = now_iso()
        await db.clinics.update_one({"_id": to_object_id(tdb.clinic_id)}, {"$set": changes})
    return _clinic(await db.clinics.find_one({"_id": to_object_id(tdb.clinic_id)}))

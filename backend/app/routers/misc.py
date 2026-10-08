"""Global search, dashboard stats, settings & other cross-cutting endpoints."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import get_current_user
from ..rules import clinic_settings
from ..tenancy import TenantDB, get_tenant
from ..util import now_iso, serialize, text_filter

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/search")
async def global_search(q: str = "", user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    q = q.strip()
    if len(q) < 2:
        return {"results": []}
    results = []

    patients = await tdb.patients.find(text_filter(q, ["name", "code", "mobile", "treatment", "email"])).limit(6).to_list(None)
    for p in patients:
        results.append({
            "type": "patient",
            "id": str(p["_id"]),
            "title": p.get("name", ""),
            "subtitle": f"{p.get('code', '')} · {p.get('mobile', '') or p.get('treatment', '')}",
            "href": f"/patients/{p['_id']}",
        })

    appts = await tdb.appointments.find(text_filter(q, ["patient", "code", "treatment", "doctor"])).sort("date", -1).limit(5).to_list(None)
    for a in appts:
        results.append({
            "type": "appointment",
            "id": str(a["_id"]),
            "title": f"{a.get('patient', '')} — {a.get('treatment', '')}",
            "subtitle": f"{a.get('date', '')} {a.get('time', '')} · {a.get('doctor', '')} · {a.get('status', '')}",
            "href": f"/appointments?focus={a['_id']}",
        })

    invoices = await tdb.invoices.find(text_filter(q, ["number", "patient", "patientCode", "treatment", "doctor"])).sort("date", -1).limit(5).to_list(None)
    for inv in invoices:
        results.append({
            "type": "invoice",
            "id": str(inv["_id"]),
            "title": f"{inv.get('number', '')} · {inv.get('patient', '')}",
            "subtitle": f"{inv.get('treatment', '')} · ₹{inv.get('total', 0):,} · {inv.get('status', '')}",
            "href": f"/accounts?focus={inv['_id']}",
        })

    return {"results": results[:14]}


@router.get("/dashboard")
async def dashboard_stats(date: str, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """Live KPIs for the given local date (yyyy-mm-dd)."""
    total_patients = await tdb.patients.count_documents({})
    total_consultants = await tdb.consultants.count_documents({})
    today_q = {"date": date}
    today_total = await tdb.appointments.count_documents(today_q)
    by_status = {
        s: await tdb.appointments.count_documents({**today_q, "status": s})
        for s in ["Scheduled", "Waiting", "Completed", "Cancelled"]
    }
    morning = await tdb.appointments.count_documents({**today_q, "time": {"$lt": "13:00"}})
    evening = await tdb.appointments.count_documents({**today_q, "time": {"$gte": "13:00"}})

    # Financials
    pipeline = [
        {"$group": {
            "_id": None,
            "revenue": {"$sum": {"$ifNull": ["$total", 0]}},
            "outstanding": {"$sum": {"$ifNull": ["$balance", 0]}},
        }}
    ]
    agg = await tdb.invoices.aggregate(pipeline).to_list(1)
    revenue = agg[0]["revenue"] if agg else 0
    outstanding = agg[0]["outstanding"] if agg else 0
    pay_agg = await tdb.payments.aggregate([
        {"$match": {"date": date}},
        {"$group": {"_id": None, "sum": {"$sum": {"$ifNull": ["$amount", 0]}}}},
    ]).to_list(1)
    today_collection = pay_agg[0]["sum"] if pay_agg else 0

    low_stock = await tdb.pharmacy_items.count_documents({"$expr": {"$lte": ["$stock", "$reorder"]}})
    pharmacy_available = await tdb.pharmacy_items.count_documents({"$expr": {"$gt": ["$stock", "$reorder"]}})
    frs_count = await tdb.frs_records.count_documents({"completionStatus": {"$ne": "Treatment Completed"}})

    activities = await tdb.activities.find({}).sort("at", -1).limit(8).to_list(None)
    notes = await tdb.schedule_notes.find({"date": date, "status": {"$ne": "Completed"}}).sort("time", 1).limit(4).to_list(None)
    upcoming = await tdb.appointments.find({"date": date}).sort("time", 1).to_list(None)

    first = date[:7] + "-01"
    new_this_month = await tdb.patients.count_documents({"created_at": {"$gte": first}})

    settings = await clinic_settings(tdb)
    return {
        "financialLock": bool(settings.get("financialLock", False)),
        "patients": total_patients,
        "newPatientsThisMonth": new_this_month,
        "consultants": total_consultants,
        "appointmentsToday": today_total,
        "byStatus": by_status,
        "morning": morning,
        "evening": evening,
        "revenue": revenue,
        "outstanding": outstanding,
        "todayCollection": today_collection,
        "pharmacyLowStock": low_stock,
        "pharmacyAvailable": pharmacy_available,
        "frs": frs_count,
        "activities": serialize(activities),
        "scheduleNotes": serialize(notes),
        "todayAppointments": serialize(upcoming),
    }


class SettingsBody(BaseModel):
    values: dict


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    doc = await tdb.app_settings.find_one({"key": "settings"})
    return (doc or {}).get("values", {})


@router.put("/settings")
async def put_settings(body: SettingsBody, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    await tdb.app_settings.update_one(
        {"key": "settings"},
        {"$set": {"values": body.values, "updated_at": now_iso(), "updated_by": user["email"]}},
        upsert=True,
    )
    await tdb.activities.insert_one({"type": "settings", "message": "Settings updated", "at": now_iso(), "user": user["email"]})
    return {"ok": True}


@router.get("/advertisement")
async def get_ad(user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    doc = await tdb.app_settings.find_one({"key": "advertisement"})
    return (doc or {}).get("values", {})


@router.put("/advertisement")
async def put_ad(body: SettingsBody, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    await tdb.app_settings.update_one(
        {"key": "advertisement"},
        {"$set": {"values": body.values, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}

"""Dentor Clinic app: accounts (dentor.fig "Accounts" #194–212).

The accounts dashboard (in-house and Dentor accounts), invoices and receipts, expenses by the design's
categories, and the statement of accounts for a period. Only the owner, administrators and
accountants may see any of it. Expenses are recorded in the new `expenses` collection (also served to
the reception web app as `/api/expenses`); lab payments and consultant fees for completed consultant
visits are added to the expense categories they belong to, read from the lab orders and bookings.
Online payments and refunds are excluded: refunds are never paid out by Dentor.
"""
import re
from datetime import date as date_cls, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..hooks import nice_date
from ..roles import FINANCE_ROLES, require_roles
from ..rules import clinic_settings
from ..scheduling import clinic_today, parse_date
from ..tenancy import TenantDB, get_tenant
from ..util import serialize
from .clinic_app import _oid

router = APIRouter(prefix="/api/clinic-app/accounts", tags=["clinic app"],
                   dependencies=[Depends(require_roles(FINANCE_ROLES, "Only the owner, an administrator or an accountant can see the clinic's accounts."))])

EXPENSE_CATEGORIES = ("Consultant", "Duty Doctors", "Purchase", "Lab Orders", "Miscellaneous", "Staff", "Domestic")
MAX_DAYS = 400


def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


async def validate_expense(tdb, payload: dict, existing: dict | None) -> None:
    """The `/api/expenses` resource's checks (main.py), shared by the web app and the Clinic app."""
    merged = {**(existing or {}), **payload}
    if merged.get("category") not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of: {', '.join(EXPENSE_CATEGORIES)}.")
    try:
        amount = float(merged.get("amount"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Enter the amount.")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="The amount must be more than zero.")
    if "amount" in payload:
        payload["amount"] = round(amount, 2)
    if not str(merged.get("payee", "")).strip():
        raise HTTPException(status_code=400, detail="Say who was paid (vendor, staff member, landlord…).")
    if "date" in payload or not existing:
        payload["date"] = parse_date(merged.get("date") or clinic_today(await clinic_settings(tdb)))
    if merged.get("mode") and merged["mode"] not in ("Cash", "UPI", "Card", "Bank Transfer", "Cheque"):
        raise HTTPException(status_code=400, detail="Mode is Cash, UPI, Card, Bank Transfer or Cheque.")


async def _period(tdb: TenantDB, date_from: Optional[str], date_to: Optional[str]) -> tuple[str, str]:
    today = clinic_today(await clinic_settings(tdb))
    start = parse_date(date_from) if date_from else today[:8] + "01"
    end = parse_date(date_to) if date_to else today
    if start > end:
        raise HTTPException(status_code=400, detail="The start date must be before the end date.")
    if (date_cls.fromisoformat(end) - date_cls.fromisoformat(start)).days > MAX_DAYS:
        raise HTTPException(status_code=400, detail="Choose a period of a year or less.")
    return start, end


def _previous(start: str, end: str) -> tuple[str, str]:
    d0, d1 = date_cls.fromisoformat(start), date_cls.fromisoformat(end)
    span = (d1 - d0).days + 1
    return (d0 - timedelta(days=span)).isoformat(), (d0 - timedelta(days=1)).isoformat()


async def _expense_lines(tdb: TenantDB, start: str, end: str, category: str = "") -> list[dict]:
    """Recorded expenses plus the lab payments and consultant fees of the period, each in its category."""
    lines: list[dict] = []
    if not category or category not in ("Lab Orders",):
        query: dict = {"date": {"$gte": start, "$lte": end}}
        if category:
            query["category"] = category
        async for e in tdb.expenses.find(query):
            lines.append({"id": str(e["_id"]), "source": "Recorded", "date": e.get("date", ""), "category": e.get("category", ""),
                          "payee": e.get("payee", ""), "description": e.get("description", ""), "amount": _f(e.get("amount")),
                          "mode": e.get("mode", ""), "reference": e.get("reference", ""), "code": e.get("code", "")})
    if not category or category == "Lab Orders":
        async for o in tdb.lab_orders.find({"received": {"$gte": start, "$lte": end}, "paid": {"$gt": 0}}):
            lines.append({"id": str(o["_id"]), "source": "Lab order", "date": o.get("received", ""), "category": "Lab Orders",
                          "payee": o.get("lab", ""), "description": f"{o.get('caseType', '')} · {o.get('patient', '')}",
                          "amount": _f(o.get("paid")), "mode": "", "reference": o.get("code", ""), "code": o.get("code", "")})
    if not category or category == "Consultant":
        async for b in tdb.consultant_bookings.find({"status": "Completed", "date": {"$gte": start, "$lte": end}, "fee": {"$gt": 0}}):
            lines.append({"id": str(b["_id"]), "source": "Consultant visit", "date": b.get("date", ""), "category": "Consultant",
                          "payee": b.get("consultant", ""), "description": f"{b.get('treatment', '')} · {b.get('patient', '')}",
                          "amount": _f(b.get("fee")) + _f(b.get("extra_fee")), "mode": "", "reference": b.get("code", ""), "code": b.get("code", "")})
    lines.sort(key=lambda x: (x["date"], x["code"]), reverse=True)
    for line in lines:
        line["date_label"] = nice_date(line["date"])
    return lines


def _change(now: float, before: float) -> Optional[float]:
    return round((now - before) / before * 100, 1) if before else None


@router.get("/summary")
async def summary(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """"Accounts Dashboard" (dentor.fig 194): revenue and expenses with the change on the period before, and
    the expense categories with their totals and number of entries."""
    start, end = await _period(tdb, date_from, date_to)
    p0, p1 = _previous(start, end)

    async def revenue(a: str, b: str) -> tuple[float, float]:
        invoices = await tdb.invoices.find({"date": {"$gte": a, "$lte": b}}, {"total": 1}).to_list(None)
        payments = await tdb.payments.find({"date": {"$gte": a, "$lte": b}}, {"amount": 1}).to_list(None)
        return sum(_f(i.get("total")) for i in invoices), sum(_f(p.get("amount")) for p in payments)

    billed, collected = await revenue(start, end)
    _, collected_before = await revenue(p0, p1)
    lines = await _expense_lines(tdb, start, end)
    before_lines = await _expense_lines(tdb, p0, p1)
    spent, spent_before = sum(x["amount"] for x in lines), sum(x["amount"] for x in before_lines)
    categories = []
    for c in EXPENSE_CATEGORIES:
        mine = [x for x in lines if x["category"] == c]
        categories.append({"category": c, "amount": sum(x["amount"] for x in mine), "entries": len(mine)})
    dentor = await tdb.consultant_bookings.find({"date": {"$gte": start, "$lte": end}, "fee": {"$gt": 0}}, {"status": 1, "fee": 1, "extra_fee": 1}).to_list(None)
    return {
        "from": start, "to": end, "billed": billed, "collected": collected, "collected_change": _change(collected, collected_before),
        "expenses": spent, "expenses_change": _change(spent, spent_before), "net": collected - spent, "categories": categories,
        "dentor": {
            "completed": sum(_f(b.get("fee")) + _f(b.get("extra_fee")) for b in dentor if b.get("status") == "Completed"),
            "pending": sum(_f(b.get("fee")) + _f(b.get("extra_fee")) for b in dentor if b.get("status") not in ("Completed", "Cancelled", "Declined")),
            "cancelled": sum(_f(b.get("fee")) for b in dentor if b.get("status") in ("Cancelled", "Declined")),
        },
    }


@router.get("/expenses")
async def expenses(category: str = "", date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """"Expenses" by category (dentor.fig 203–210)."""
    if category and category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category is one of {', '.join(EXPENSE_CATEGORIES)}.")
    start, end = await _period(tdb, date_from, date_to)
    lines = await _expense_lines(tdb, start, end, category)
    return {"from": start, "to": end, "items": lines, "total": sum(x["amount"] for x in lines), "categories": EXPENSE_CATEGORIES}


@router.get("/invoices")
async def invoices(date_from: Optional[str] = None, date_to: Optional[str] = None, q: str = "", tdb: TenantDB = Depends(get_tenant)):
    """"Invoice" list (dentor.fig 198, 201)."""
    start, end = await _period(tdb, date_from, date_to)
    query: dict = {"date": {"$gte": start, "$lte": end}}
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"patient": rx}, {"number": rx}, {"patientCode": rx}]
    items = await tdb.invoices.find(query).sort([("date", -1), ("number", -1)]).limit(200).to_list(None)
    return {"from": start, "to": end, "items": [{
        "id": str(i["_id"]), "number": i.get("number", ""), "date": i.get("date", ""), "date_label": nice_date(i.get("date")),
        "patient": i.get("patient", ""), "patientCode": i.get("patientCode", ""), "treatment": i.get("treatment", ""), "doctor": i.get("doctor", ""),
        "total": _f(i.get("total")), "paid": _f(i.get("paid")), "balance": _f(i.get("balance")), "status": i.get("status", "")} for i in items]}


@router.get("/invoices/{invoice_id}")
async def invoice(invoice_id: str, tdb: TenantDB = Depends(get_tenant)):
    """"invoice view" (dentor.fig 202): the invoice, its lines and its receipts."""
    i = await tdb.invoices.find_one({"_id": _oid(invoice_id)})
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    payments = await tdb.payments.find({"invoice": i.get("number")}).sort("date", 1).to_list(None)
    clinic = await db.clinics.find_one({"_id": _oid(tdb.clinic_id)})
    out = serialize({k: v for k, v in i.items() if k != "clinic_id"})
    out["receipts"] = [{"receipt": p.get("receipt", ""), "date": p.get("date", ""), "mode": p.get("mode", ""), "amount": _f(p.get("amount")),
                        "reference": p.get("reference", "")} for p in payments]
    out["clinic"] = {"name": (clinic or {}).get("name", ""), "address": (clinic or {}).get("address", ""), "city": (clinic or {}).get("city", ""),
                     "phone": (clinic or {}).get("phone", "")}
    return out


@router.get("/receipts")
async def receipts(date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """"Reciept" list (dentor.fig 199–200)."""
    start, end = await _period(tdb, date_from, date_to)
    items = await tdb.payments.find({"date": {"$gte": start, "$lte": end}}).sort([("date", -1)]).limit(200).to_list(None)
    return {"from": start, "to": end, "items": [{
        "id": str(p["_id"]), "receipt": p.get("receipt", ""), "date": p.get("date", ""), "date_label": nice_date(p.get("date")),
        "patient": p.get("patient", ""), "patientCode": p.get("patientCode", ""), "invoice": p.get("invoice", ""), "mode": p.get("mode", ""),
        "amount": _f(p.get("amount")), "reference": p.get("reference", "")} for p in items]}


@router.get("/statement")
async def statement(date_from: str, date_to: str, tdb: TenantDB = Depends(get_tenant)):
    """"Statement of accounts" (dentor.fig 211–212): every invoice, receipt and expense of the period in date
    order, with what came in, what went out and the running balance."""
    start, end = await _period(tdb, date_from, date_to)
    rows: list[dict] = []
    async for p in tdb.payments.find({"date": {"$gte": start, "$lte": end}}):
        rows.append({"date": p.get("date", ""), "kind": "Receipt", "reference": p.get("receipt", ""), "party": p.get("patient", ""),
                     "detail": f"{p.get('mode', '')} · {p.get('invoice', '')}".strip(" ·"), "in": _f(p.get("amount")), "out": 0.0})
    for e in await _expense_lines(tdb, start, end):
        rows.append({"date": e["date"], "kind": f"Expense · {e['category']}", "reference": e["code"], "party": e["payee"],
                     "detail": e["description"], "in": 0.0, "out": e["amount"]})
    rows.sort(key=lambda r: (r["date"], r["kind"] != "Receipt"))
    balance = 0.0
    for r in rows:
        balance += r["in"] - r["out"]
        r["balance"] = round(balance, 2)
        r["date_label"] = nice_date(r["date"])
    billed = sum(_f(i.get("total")) for i in await tdb.invoices.find({"date": {"$gte": start, "$lte": end}}, {"total": 1}).to_list(None))
    return {"from": start, "to": end, "rows": rows, "billed": billed, "received": sum(r["in"] for r in rows),
            "paid_out": sum(r["out"] for r in rows), "net": round(balance, 2)}


@router.get("/dentor")
async def dentor_accounts(status: str = "completed", date_from: Optional[str] = None, date_to: Optional[str] = None, tdb: TenantDB = Depends(get_tenant)):
    """"Dentor Accounts" / "Payments" (dentor.fig 253–256): consultant visits by fee status. Cancelled visits are
    listed as not charged; Dentor does not take or refund payments in this version."""
    start, end = await _period(tdb, date_from, date_to)
    statuses = {"completed": ["Completed"], "pending": ["Requested", "Viewed", "Proposed", "Confirmed", "On the way", "Running late", "Arrived", "Started"],
                "cancelled": ["Cancelled", "Declined"]}.get(status)
    if statuses is None:
        raise HTTPException(status_code=400, detail="status is completed, pending or cancelled.")
    items = await tdb.consultant_bookings.find({"status": {"$in": statuses}, "$or": [{"date": {"$gte": start, "$lte": end}}, {"date": ""}]},
                                               {"images": 0, "start_code": 0}).sort("date", -1).limit(200).to_list(None)
    return {"from": start, "to": end, "items": [{
        "id": str(b["_id"]), "code": b.get("code", ""), "date": b.get("date", ""), "date_label": nice_date(b.get("date")) if b.get("date") else "",
        "patient": b.get("patient", ""), "patientCode": b.get("patientCode", ""), "consultant": b.get("consultant", "") or "Not assigned",
        "treatment": b.get("treatment", ""), "fee": _f(b.get("fee")) + _f(b.get("extra_fee")), "status": b.get("status", "")} for b in items],
        "total": sum(_f(b.get("fee")) + _f(b.get("extra_fee")) for b in items)}

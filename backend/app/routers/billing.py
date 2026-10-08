"""Billing endpoints with invariants: invoice numbering, payment recording, balances."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from ..tenancy import TenantDB, get_tenant
from ..util import next_sequence, now_iso, serialize, to_object_id

router = APIRouter(prefix="/api", tags=["billing"])


class PaymentBody(BaseModel):
    invoice_id: Optional[str] = None  # None = on-account payment
    patient: str
    patientCode: Optional[str] = ""
    amount: float
    mode: str = "Cash"  # Cash / Card / UPI / Bank Transfer / Cheque
    reference: Optional[str] = ""
    date: str
    notes: Optional[str] = ""


@router.post("/payments/record", status_code=201)
async def record_payment(body: PaymentBody, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    receipt = await next_sequence(tdb, "receipts", "DEN-RCP-", 1948)
    invoice_number = "On Account"

    if body.invoice_id:
        inv = await tdb.invoices.find_one({"_id": to_object_id(body.invoice_id)})
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        balance = float(inv.get("balance", inv.get("total", 0)))
        if body.amount > balance + 0.01:
            raise HTTPException(status_code=400, detail=f"Amount exceeds invoice balance (₹{balance:,.0f}).")
        new_paid = float(inv.get("paid", 0)) + body.amount
        new_balance = max(0.0, float(inv.get("total", 0)) - new_paid)
        status = "Paid" if new_balance <= 0.01 else "Partial"
        await tdb.invoices.update_one(
            {"_id": inv["_id"]},
            {"$set": {"paid": new_paid, "balance": new_balance, "status": status, "updated_at": now_iso()}},
        )
        invoice_number = inv.get("number", "")

    doc = {
        "receipt": receipt,
        "invoice": invoice_number,
        "invoice_id": body.invoice_id,
        "patient": body.patient,
        "patientCode": body.patientCode,
        "amount": body.amount,
        "mode": body.mode,
        "reference": body.reference or receipt,
        "date": body.date,
        "notes": body.notes,
        "entered_by": user.get("name", user["email"]),
        "created_at": now_iso(),
    }
    result = await tdb.payments.insert_one(doc)
    await tdb.activities.insert_one(
        {"type": "accounts", "message": f"Payment of ₹{body.amount:,.0f} received from {body.patient}", "at": now_iso(), "user": user["email"]}
    )
    saved = await tdb.payments.find_one({"_id": result.inserted_id})
    return serialize(saved)


@router.get("/accounts/summary")
async def accounts_summary(date_from: str = "", date_to: str = "", user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    match: dict = {}
    if date_from or date_to:
        rng: dict = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        match["date"] = rng

    inv_agg = await tdb.invoices.aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total": {"$sum": {"$ifNull": ["$total", 0]}},
            "outstanding": {"$sum": {"$ifNull": ["$balance", 0]}},
            "collected": {"$sum": {"$ifNull": ["$paid", 0]}},
            "withBalance": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$balance", 0]}, 0]}, 1, 0]}},
            "withCollections": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$paid", 0]}, 0]}, 1, 0]}},
        }},
    ]).to_list(1)
    base = inv_agg[0] if inv_agg else {}
    base.pop("_id", None)

    mode_agg = await tdb.payments.aggregate([
        {"$match": match},
        {"$group": {"_id": "$mode", "sum": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(None)

    return {
        "invoices": base.get("count", 0),
        "totalValue": base.get("total", 0),
        "outstanding": base.get("outstanding", 0),
        "collected": base.get("collected", 0),
        "invoicesWithBalance": base.get("withBalance", 0),
        "invoicesWithCollections": base.get("withCollections", 0),
        "byMode": [{"mode": m["_id"] or "Other", "sum": m["sum"], "count": m["count"]} for m in mode_agg],
    }

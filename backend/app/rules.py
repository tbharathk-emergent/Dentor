"""Server-side enforcement of clinic Settings.

The Settings page stores a per-clinic `values` map. Anything that is a business rule
is enforced HERE, on the API, so it cannot be bypassed by calling endpoints directly.
Display-only preferences (masking, default durations, allergy banners) are read by the
frontend from GET /api/settings.
"""
import re

from fastapi import HTTPException


async def clinic_settings(tdb) -> dict:
    doc = await tdb.app_settings.find_one({"key": "settings"})
    return (doc or {}).get("values", {})


def _is_on(settings: dict, key: str, default: bool = False) -> bool:
    return bool(settings.get(key, default))


def check_password_strength(password: str, strong: bool) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if strong and not (
        re.search(r"[A-Z]", password)
        and re.search(r"[a-z]", password)
        and re.search(r"\d", password)
        and re.search(r"[^A-Za-z0-9]", password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Strong passwords are required: use upper and lower case letters, a digit and a symbol.",
        )


# ---------------------------------------------------------------- appointments

ACTIVE_APPT_STATUSES = ("Scheduled", "Waiting")


async def validate_appointment(tdb, payload: dict, existing: dict | None) -> None:
    """Enforce the 'Allow double booking' setting on create AND update.

    A conflict is another non-cancelled appointment in the same clinic at the same
    date+time with the same doctor or the same chair — the same rule the UI warns about.
    """
    merged = {**(existing or {}), **payload}
    status = merged.get("status", "Scheduled")
    if status not in ACTIVE_APPT_STATUSES:
        return  # cancelling or completing can never create a new overlap
    date, time_, doctor, chair = merged.get("date"), merged.get("time"), merged.get("doctor"), merged.get("chair")
    if not date or not time_:
        raise HTTPException(status_code=400, detail="Appointment date and time are required.")

    settings = await clinic_settings(tdb)
    if _is_on(settings, "doubleBooking"):
        return

    clauses = []
    if doctor:
        clauses.append({"doctor": doctor})
    if chair:
        clauses.append({"chair": chair})
    if not clauses:
        return
    query: dict = {"date": date, "time": time_, "status": {"$in": list(ACTIVE_APPT_STATUSES)}, "$or": clauses}
    if existing:
        query["_id"] = {"$ne": existing["_id"]}
    clash = await tdb.appointments.find_one(query)
    if clash:
        what = "doctor" if clash.get("doctor") == doctor else "chair"
        raise HTTPException(
            status_code=409,
            detail=(
                f"Double booking blocked: {clash.get(what, '')} already has {clash.get('patient', 'a patient')} "
                f"at {time_}. Pick another slot, or enable 'Allow double booking' in Settings."
            ),
        )


# ------------------------------------------------- clinical records need consent

async def validate_clinical_record(tdb, payload: dict, existing: dict | None) -> None:
    """Enforce 'Consent required before procedures' for treatment/procedure records."""
    if existing:  # edits to an existing record are always allowed
        return
    settings = await clinic_settings(tdb)
    if not _is_on(settings, "consentRequired"):
        return
    patient_code = payload.get("patientId") or payload.get("patientCode")
    if not patient_code:
        raise HTTPException(status_code=400, detail="A patient is required for this record.")
    signed = await tdb.patient_consents.find_one({"patientId": patient_code, "status": "Signed"})
    if not signed:
        raise HTTPException(
            status_code=400,
            detail=(
                "This clinic requires a signed consent before treatment records. Record a signed "
                "consent in the patient's Consents tab first, or disable 'Consent required' in Settings."
            ),
        )


# ---------------------------------------------------------------------- invoices

_MONEY_FIELDS = ("subtotal", "tax", "discount", "total", "paid", "balance")


async def validate_invoice(tdb, payload: dict, existing: dict | None) -> None:
    """Keep invoice money fields numeric and consistent; apply 'Round off totals'."""
    settings = await clinic_settings(tdb)
    round_off = _is_on(settings, "roundOff", True)
    for field in _MONEY_FIELDS:
        if field in payload:
            try:
                value = float(payload[field])
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Invoice {field} must be a number.")
            if value < 0:
                raise HTTPException(status_code=400, detail=f"Invoice {field} cannot be negative.")
            payload[field] = round(value) if round_off else value
    merged = {**(existing or {}), **payload}
    if "total" in merged and "paid" in merged and "balance" in payload:
        expected = max(0, float(merged["total"]) - float(merged["paid"]))
        if abs(float(payload["balance"]) - expected) > 1:
            payload["balance"] = round(expected) if round_off else expected

"""Side effects of clinic data changes: notifications for the patient and consultant apps.

Called from the generic CRUD router (reception web app) and from the portal routers, so a
booking made at the front desk and one made in the patient app notify the same people.
Hooks never raise: a failed notification must not fail the write that triggered it.
"""
import logging
from datetime import datetime

from .notify import notify_doctor, notify_front_desk, notify_patient, resolve_patient_id
from .roles import CLINIC_ADMIN_ROLES
from .util import inr

log = logging.getLogger("dentor")


def nice_date(iso: str | None) -> str:
    try:
        return datetime.strptime(str(iso)[:10], "%Y-%m-%d").strftime("%d %b %Y")
    except Exception:
        return str(iso or "")


def nice_time(hhmm: str | None) -> str:
    try:
        return datetime.strptime(str(hhmm)[:5], "%H:%M").strftime("%I:%M %p").lstrip("0")
    except Exception:
        return str(hhmm or "")


def _when(doc: dict) -> str:
    return f"{nice_date(doc.get('date'))} at {nice_time(doc.get('time'))}"


async def after_appointment(tdb, action: str, doc: dict, before: dict | None, actor: str = "staff") -> None:
    """actor: 'staff' (front desk), 'patient' (patient app) or 'consultant' (consultant app)."""
    try:
        cid = tdb.clinic_id
        pid = await resolve_patient_id(tdb, doc)
        data = {"appointment_id": str(doc.get("_id", "")), "screen": "appointment"}
        who = doc.get("patient", "A patient")
        what = doc.get("treatment") or "Appointment"

        if action == "create":
            if actor != "patient" and pid:
                await notify_patient(tdb._db, cid, pid, "Appointment booked",
                                     f"{what} with {doc.get('doctor', 'your dentist')} on {_when(doc)}.", "appointment", data)
            if actor != "consultant":
                await notify_doctor(tdb._db, cid, doc.get("doctor", ""), "New appointment",
                                    f"{who} · {what} · {_when(doc)}", "appointment", data)
            if actor == "patient":
                await notify_front_desk(tdb._db, cid, "New booking from the patient app",
                                        f"{who} · {what} with {doc.get('doctor', '')} · {_when(doc)}", "appointment", data)
            return

        if action != "update" or not before:
            return
        old_status, new_status = before.get("status"), doc.get("status")
        moved = (before.get("date"), before.get("time")) != (doc.get("date"), doc.get("time"))

        if new_status != old_status:
            if new_status == "Cancelled":
                if actor != "patient" and pid:
                    await notify_patient(tdb._db, cid, pid, "Appointment cancelled",
                                         f"Your {what} on {_when(before)} was cancelled. Contact the clinic to rebook.", "appointment", data)
                if actor != "consultant":
                    await notify_doctor(tdb._db, cid, doc.get("doctor", ""), "Appointment cancelled",
                                        f"{who} · {what} · {_when(before)}", "appointment", data)
                if actor == "patient":
                    await notify_front_desk(tdb._db, cid, "Patient cancelled an appointment",
                                            f"{who} · {what} · {_when(before)} — the slot is free again.", "appointment", data)
            elif new_status == "Waiting" and pid:
                await notify_patient(tdb._db, cid, pid, "You are checked in",
                                     f"{doc.get('doctor', 'Your dentist')} will see you shortly.", "appointment", data)
                if actor != "consultant":
                    await notify_doctor(tdb._db, cid, doc.get("doctor", ""), "Patient waiting",
                                        f"{who} has checked in for {what}.", "appointment", data)
            elif new_status == "Completed" and pid:
                await notify_patient(tdb._db, cid, pid, "Visit completed",
                                     f"Thank you for visiting. Your {what} is marked complete.", "appointment", data)
        if moved and new_status in ("Scheduled", "Waiting"):
            if actor != "patient" and pid:
                await notify_patient(tdb._db, cid, pid, "Appointment rescheduled",
                                     f"Your {what} is now on {_when(doc)}.", "appointment", data)
            if actor != "consultant":
                await notify_doctor(tdb._db, cid, doc.get("doctor", ""), "Appointment rescheduled",
                                    f"{who} · {what} moved to {_when(doc)}", "appointment", data)
            if actor == "patient":
                await notify_front_desk(tdb._db, cid, "Patient rescheduled an appointment",
                                        f"{who} · {what} moved from {_when(before)} to {_when(doc)}", "appointment", data)
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("appointment hook failed: %s", exc)


async def after_prescription(tdb, action: str, doc: dict, before: dict | None, actor: str = "staff") -> None:
    try:
        if action != "create":
            return
        pid = await resolve_patient_id(tdb, doc)
        if pid:
            await notify_patient(tdb._db, tdb.clinic_id, pid, "New prescription",
                                 f"{doc.get('doctor', 'Your dentist')} issued a prescription for {doc.get('diagnosis') or 'your treatment'}.",
                                 "prescription", {"prescription_id": str(doc.get("_id", "")), "screen": "prescription"})
    except Exception as exc:  # pragma: no cover
        log.warning("prescription hook failed: %s", exc)


async def after_invoice(tdb, action: str, doc: dict, before: dict | None) -> None:
    try:
        if action != "create":
            return
        pid = await resolve_patient_id(tdb, doc)
        if pid:
            await notify_patient(tdb._db, tdb.clinic_id, pid, "New bill",
                                 f"Invoice {doc.get('number', '')} for {inr(doc.get('total', 0))} is ready.",
                                 "invoice", {"invoice_id": str(doc.get("_id", "")), "screen": "invoice"})
    except Exception as exc:  # pragma: no cover
        log.warning("invoice hook failed: %s", exc)


async def after_payment(tdb, payment: dict) -> None:
    try:
        pid = await resolve_patient_id(tdb, payment)
        if pid:
            await notify_patient(tdb._db, tdb.clinic_id, pid, "Payment received",
                                 f"{inr(payment.get('amount', 0))} received. Receipt {payment.get('receipt', '')}.",
                                 "payment", {"invoice_id": str(payment.get("invoice_id") or ""), "screen": "invoice"})
    except Exception as exc:  # pragma: no cover
        log.warning("payment hook failed: %s", exc)


async def after_consent(tdb, action: str, doc: dict, before: dict | None) -> None:
    try:
        if action == "create" and doc.get("status") == "Pending":
            pid = await resolve_patient_id(tdb, doc)
            if pid:
                await notify_patient(tdb._db, tdb.clinic_id, pid, "Consent form to review",
                                     f"Please review and sign: {doc.get('title', 'Consent form')}.",
                                     "consent", {"consent_id": str(doc.get("_id", "")), "screen": "consents"})
    except Exception as exc:  # pragma: no cover
        log.warning("consent hook failed: %s", exc)


PATIENT_APP_CHANNEL = "Patient App"


async def after_conversation(tdb, action: str, doc: dict, before: dict | None) -> None:
    """A clinic reply in a Patient App chat thread reaches the patient as unread + notification."""
    try:
        if action != "update" or doc.get("channel") != PATIENT_APP_CHANNEL:
            return
        old = (before or {}).get("messages") or []
        new = doc.get("messages") or []
        fresh = [m for m in new[len(old):] if isinstance(m, (list, tuple)) and len(m) >= 2 and m[0] == "out"]
        if not fresh:
            return
        await tdb.omni_conversations.update_one({"_id": doc["_id"]}, {"$inc": {"patientUnread": len(fresh)}})
        pid = await resolve_patient_id(tdb, doc)
        if pid:
            await notify_patient(tdb._db, tdb.clinic_id, pid, "New message from the clinic",
                                 str(fresh[-1][1])[:140], "chat", {"screen": "chat"})
    except Exception as exc:  # pragma: no cover
        log.warning("conversation hook failed: %s", exc)


__all__ = [
    "after_appointment", "after_prescription", "after_invoice", "after_payment",
    "after_consent", "after_conversation", "nice_date", "nice_time",
    "PATIENT_APP_CHANNEL", "CLINIC_ADMIN_ROLES",
]

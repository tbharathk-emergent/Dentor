"""Booking a visiting consultant: the request a clinic sends and the consultant's answer.

dentor.fig "BOOK YOUR APPOINTMENT" (#82–111) on the clinic side and "Pending appointments",
"set availability", "start procedure", "Complete Procedure" (#355–391) on the consultant's. The
record lives in `consultant_bookings`, the collection the reception web app's "Book a Consultant"
already writes, so all three see the same bookings. A confirmed booking has a mirror appointment
(chair "Consultation Room") so it appears in the clinic's and the consultant's day lists.

Statuses: Requested → Viewed → (Proposed: the consultant offered other times) → Confirmed →
On the way / Running late / Arrived → Started (the consultant enters the clinic's 4-digit code) →
Completed. Declined and Cancelled end it. Payment is excluded: fees are shown, nothing is charged.
"""
import secrets
from datetime import date as date_cls, datetime, timedelta

from fastapi import HTTPException

from .hooks import nice_date, nice_time
from .notify import notify_doctor, notify_front_desk
from .rules import ACTIVE_APPT_STATUSES
from .scheduling import clinic_now, clinic_today
from .util import next_sequence, now_iso, serialize

OPEN = ("Requested", "Viewed", "Proposed")
LIVE = ("Confirmed", "On the way", "Running late", "Arrived", "Started")
DONE = ("Completed", "Declined", "Cancelled")
TRACKING = ("On the way", "Running late", "Arrived")
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
# the design's appointment types for a "Dentor choice" booking (dentor.fig 6349:3575, 6349:3618)
DENTOR_TYPES = {
    "standard": {"label": "Standard Appointment", "window": "Assigned by Dentor within 48 hours, between 9 AM and 5 PM", "extra": 0},
    "peak": {"label": "Peak Hour Appointment", "window": "5–9 PM; peak tariff: base fare + ₹200", "extra": 200},
    "preferred": {"label": "Clinic Preferred Timing", "window": "Your chosen time, confirmed within 24 hours; additional charge", "extra": 300},
}
DEFAULT_AVAILABILITY = {d: {"morning": ["09:00", "12:00"], "evening": ["14:00", "18:00"]} for d in WEEKDAYS[:6]}
MAX_IMAGES = 4
MAX_IMAGE_CHARS = 2_800_000


def half_hours(start: str, end: str) -> list[str]:
    out = []
    t = datetime.strptime(start, "%H:%M")
    stop = datetime.strptime(end, "%H:%M")
    while t < stop:
        out.append(t.strftime("%H:%M"))
        t += timedelta(minutes=30)
    return out


def valid_hhmm(value: str) -> bool:
    try:
        datetime.strptime(value, "%H:%M")
        return len(value) == 5
    except ValueError:
        return False


async def availability_of(tdb, consultant: dict) -> dict:
    doc = await tdb.consultant_availability.find_one({"consultant_id": str(consultant["_id"])})
    return {
        "weekly": (doc or {}).get("weekly") or DEFAULT_AVAILABILITY,
        "custom": (doc or {}).get("custom") or {},
        "is_default": not doc,
        "updated_at": (doc or {}).get("updated_at", ""),
    }


async def consultant_slots(tdb, consultant: dict, day: str, settings: dict) -> list[dict]:
    """Half-hour slots the consultant has set for `day`, minus what is already booked with them."""
    avail = await availability_of(tdb, consultant)
    if day in avail["custom"]:
        ranges = avail["custom"][day]  # a list of [from, to]; [] = not available that day
    else:
        weekday = WEEKDAYS[date_cls.fromisoformat(day).weekday()]
        ranges = [r for r in (avail["weekly"].get(weekday) or {}).values() if r]
    times = sorted({t for r in ranges if len(r) == 2 for t in half_hours(r[0], r[1])})
    taken = {a.get("time") async for a in tdb.appointments.find(
        {"date": day, "doctor": consultant.get("name"), "status": {"$in": list(ACTIVE_APPT_STATUSES)}}, {"time": 1})}
    now = clinic_now(settings)
    today = now.date().isoformat()
    out = []
    for t in times:
        past = day < today or (day == today and t <= now.strftime("%H:%M"))
        part = "Morning" if t < "12:00" else "Afternoon" if t < "17:00" else "Evening"
        out.append({"time": t, "label": nice_time(t), "part": part, "available": t not in taken and not past})
    return out


def clean_images(images: list) -> list[str]:
    out = []
    for value in (images or [])[:MAX_IMAGES]:
        value = str(value or "")
        if not value:
            continue
        if not value.startswith(("data:image/", "data:application/pdf")) or len(value) > MAX_IMAGE_CHARS:
            raise HTTPException(status_code=400, detail="Attach photos or PDFs of up to 2 MB each.")
        out.append(value)
    return out


def booking_view(b: dict, *, for_clinic: bool) -> dict:
    out = serialize({k: v for k, v in b.items() if k not in ("start_code", "start_attempts", "images", "clinic_id")})
    out["date_label"] = nice_date(b.get("date")) if b.get("date") else ""
    out["time_label"] = nice_time(b.get("time")) if b.get("time") else ""
    out["images"] = len(b.get("images") or [])
    out["proposals"] = [{**p, "date_label": nice_date(p.get("date")), "time_label": nice_time(p.get("time"))} for p in b.get("proposals") or []]
    out["dentor_type_label"] = DENTOR_TYPES.get(b.get("dentor_type", ""), {}).get("label", "")
    # the clinic reads the start code to the consultant at the chair; the consultant never receives it
    if for_clinic and b.get("status") in LIVE and b.get("status") != "Started":
        out["start_code"] = b.get("start_code", "")
    return out


async def timeline(tdb, booking: dict, status: str, actor: str, note: str = "") -> None:
    await tdb.consultant_bookings.update_one({"_id": booking["_id"]}, {"$push": {"timeline": {
        "status": status, "at": now_iso(), "by": actor, "note": note}}})


async def mirror_appointment(tdb, booking: dict, consultant_name: str, date: str, time: str) -> str:
    """The appointment a confirmed booking puts on the clinic's and the consultant's day."""
    clash = await tdb.appointments.find_one({"date": date, "time": time, "doctor": consultant_name, "status": {"$in": list(ACTIVE_APPT_STATUSES)}})
    if clash:
        raise HTTPException(status_code=409, detail=f"{consultant_name} already has {clash.get('patient', 'a patient')} at {nice_time(time)} on {nice_date(date)}.")
    stamp = now_iso()
    doc = {
        "patientId": booking.get("patientId", ""), "patient": booking.get("patient", ""), "patientCode": booking.get("patientCode", ""),
        "date": date, "time": time, "treatment": booking.get("treatment") or f"Consultant · {booking.get('specialty', '')}",
        "doctor": consultant_name, "chair": "Consultation Room", "duration": "30 min", "status": "Scheduled",
        "notes": booking.get("notes", ""), "source": "Consultant booking", "bookingId": str(booking["_id"]),
        "code": await next_sequence(tdb, "appointments", "APT-", 5001), "created_at": stamp, "updated_at": stamp, "created_by": "consult",
    }
    result = await tdb.appointments.insert_one(doc)
    return str(result.inserted_id)


def new_start_code() -> str:
    return f"{secrets.randbelow(10 ** 4):04d}"


async def tell_clinic(tdb, booking: dict, title: str, body: str) -> None:
    await notify_front_desk(tdb._db, tdb.clinic_id, title, body, "consult", {"booking_id": str(booking["_id"]), "screen": "consult"})


async def tell_consultant(tdb, name: str, booking: dict, title: str, body: str) -> None:
    await notify_doctor(tdb._db, tdb.clinic_id, name, title, body, "consult", {"booking_id": str(booking["_id"]), "screen": "request"})

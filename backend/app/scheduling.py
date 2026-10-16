"""Appointment slots shared by the patient and consultant APIs (same grid as the web calendar)."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from .rules import ACTIVE_APPT_STATUSES, clinic_settings

# Half-hour slots 09:00–17:30, matching the reception calendar.
SLOT_TIMES = [f"{9 + i // 2:02d}:{'30' if i % 2 else '00'}" for i in range(18)]
CHAIRS = ["Chair 01", "Chair 02", "Chair 03"]
BOOKING_HORIZON_DAYS = 90


def clinic_now(settings: dict) -> datetime:
    try:
        tz = ZoneInfo(str(settings.get("timezone") or "Asia/Kolkata"))
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    return datetime.now(tz)


def clinic_today(settings: dict) -> str:
    return clinic_now(settings).date().isoformat()


def parse_date(value: str) -> str:
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date().isoformat()
    except Exception:
        raise HTTPException(status_code=400, detail="Choose a valid date.")


def is_future(date: str, time: str, settings: dict) -> bool:
    now = clinic_now(settings)
    return (date, time) > (now.date().isoformat(), now.strftime("%H:%M"))


async def day_slots(tdb, date: str, doctor: str, ignore_id=None) -> list[dict]:
    """Availability of every slot on `date` for `doctor`, honouring the double-booking setting."""
    settings = await clinic_settings(tdb)
    now = clinic_now(settings)
    today = now.date().isoformat()
    horizon = (now.date() + timedelta(days=BOOKING_HORIZON_DAYS)).isoformat()
    if date < today or date > horizon:
        return [{"time": t, "available": False} for t in SLOT_TIMES]

    query: dict = {"date": date, "status": {"$in": list(ACTIVE_APPT_STATUSES)}}
    if ignore_id is not None:
        query["_id"] = {"$ne": ignore_id}
    taken = await tdb.appointments.find(query).to_list(None)
    allow_double = bool(settings.get("doubleBooking", False))
    now_hm = now.strftime("%H:%M")

    slots = []
    for t in SLOT_TIMES:
        at_slot = [a for a in taken if a.get("time") == t]
        doctor_busy = any(a.get("doctor") == doctor for a in at_slot)
        chairs_used = {a.get("chair") for a in at_slot}
        free_chair = any(c not in chairs_used for c in CHAIRS)
        available = allow_double or (not doctor_busy and free_chair)
        if date == today and t <= now_hm:
            available = False
        slots.append({"time": t, "available": available})
    return slots


async def free_chair(tdb, date: str, time: str, ignore_id=None) -> str:
    query: dict = {"date": date, "time": time, "status": {"$in": list(ACTIVE_APPT_STATUSES)}}
    if ignore_id is not None:
        query["_id"] = {"$ne": ignore_id}
    used = {a.get("chair") for a in await tdb.appointments.find(query).to_list(None)}
    for chair in CHAIRS:
        if chair not in used:
            return chair
    return CHAIRS[0]

"""Engagement and support for the Clinic and Consultant apps (dentor.fig #229–316, #392–442):
support tickets to Dentor, clinic–consultant chat, offers to patients, ratings after a visit,
notification settings, refer-and-earn points, subscription plans, the store catalogue,
the consultant's own inventory and job posts.

Agreed exclusions shape some of these: the wallet holds points only (no top-up), plans and store
items are requested from Dentor rather than bought, and offers reach patients through the patient
app (no SMS / WhatsApp).
"""
import asyncio
import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..db import db
from ..hooks import nice_date
from ..notify import notify_doctor, notify_front_desk, notify_patient, notify_users
from ..roles import CLINIC_ADMIN_ROLES, CLINIC_APP_ROLES, CONSULTANT, FRONT_DESK_ROLES, has_role, is_super_admin, require_roles
from ..scheduling import clinic_today, parse_date
from ..rules import clinic_settings
from ..tenancy import TenantDB, get_tenant
from ..util import now_iso, serialize, to_object_id

log = logging.getLogger("dentor")
APP_ROLES = CLINIC_APP_ROLES | {CONSULTANT}
router = APIRouter(prefix="/api/engage", tags=["engagement"], dependencies=[Depends(require_roles(APP_ROLES, "This login cannot use the Dentor apps."))])
admins = Depends(require_roles(CLINIC_ADMIN_ROLES, "Only the clinic owner or an administrator can do this."))

TICKET_TYPES = ("Appointment", "Payment", "Technical", "Account", "Lab", "Consultant", "Subscription", "Store enquiry", "Other")
PLANS = [
    {"key": "elite", "name": "ELITE", "price": 1999, "days": 60, "cases": 30, "benefits": ["E-Com purchase discounts", "Offers on all treatments", "30 cases applicable"]},
    {"key": "elite_pro", "name": "ELITE PRO", "price": 3999, "days": 90, "cases": 50, "benefits": ["15% off on the store", "Offers on all treatments", "50 cases applicable"], "best": True},
    {"key": "elite_premium", "name": "ELITE PREMIUM", "price": 9999, "days": 120, "cases": 100, "benefits": ["Best store prices", "Offers on all treatments", "100 cases applicable"]},
]
REFERRAL_POINTS = 150
TIERS = [(0, "Silver"), (300, "Gold"), (1000, "Platinum")]


def _oid(value: str):
    try:
        return to_object_id(value)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found.")


def _who(user: dict) -> str:
    return user.get("name") or user.get("email", "")


async def _global_code(name: str, prefix: str, start: int) -> str:
    doc = await db.counters.find_one_and_update({"name": f"global:{name}", "clinic_id": None}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
    return f"{prefix}{start + int(doc['value']) - 1}"


async def _consultant_of(user: dict, tdb: TenantDB) -> dict | None:
    if user.get("role") != CONSULTANT or not user.get("consultant_id"):
        return None
    return await tdb.consultants.find_one({"_id": _oid(user["consultant_id"])})


# --------------------------------------------------------------------- tickets

class TicketBody(BaseModel):
    type: str
    subject: str = Field(..., max_length=120)
    description: str = Field(..., max_length=2000)
    attachment: str = ""


def _ticket(t: dict) -> dict:
    out = serialize({k: v for k, v in t.items() if k != "attachment"})
    out["has_attachment"] = bool(t.get("attachment"))
    return out


async def create_ticket(user: dict, clinic_id: str, type_: str, subject: str, description: str, attachment: str = "") -> dict:
    if type_ not in TICKET_TYPES:
        raise HTTPException(status_code=400, detail="Choose the kind of query.")
    if len(subject.strip()) < 3 or len(description.strip()) < 5:
        raise HTTPException(status_code=400, detail="Give a subject and describe the problem.")
    if attachment and (not attachment.startswith(("data:image/", "data:application/pdf")) or len(attachment) > 2_800_000):
        raise HTTPException(status_code=400, detail="Attach a screenshot or PDF of up to 2 MB.")
    stamp = now_iso()
    doc = {"code": await _global_code("support_tickets", "DT-", 1001), "type": type_, "subject": subject.strip(), "description": description.strip(),
           "attachment": attachment, "status": "Open", "clinic_id": clinic_id, "raised_by": user.get("email", ""), "raised_name": _who(user),
           "raised_role": user.get("role", ""), "timeline": [{"status": "Ticket raised", "at": stamp, "by": _who(user), "text": ""}],
           "created_at": stamp, "updated_at": stamp}
    result = await db.support_tickets.insert_one(doc)
    return await db.support_tickets.find_one({"_id": result.inserted_id})


@router.get("/tickets")
async def my_tickets(scope: str = "open", user: dict = Depends(get_current_user)):
    """"Recent Tickets" / "Previous Tickets" (dentor.fig 276)."""
    statuses = ["Open", "In progress"] if scope == "open" else ["Resolved"]
    items = await db.support_tickets.find({"raised_by": user.get("email"), "status": {"$in": statuses}}, {"attachment": 0}).sort("created_at", -1).to_list(100)
    return {"items": [_ticket(t) for t in items], "types": TICKET_TYPES}


@router.post("/tickets", status_code=201)
async def raise_ticket(body: TicketBody, user: dict = Depends(get_current_user)):
    """"Create Ticket" (dentor.fig 277) → "submitted" (278)."""
    t = await create_ticket(user, user.get("clinic_id", ""), body.type, body.subject, body.description, body.attachment)
    return _ticket(t)


@router.get("/tickets/{ticket_id}")
async def ticket_detail(ticket_id: str, user: dict = Depends(get_current_user)):
    t = await db.support_tickets.find_one({"_id": _oid(ticket_id), "raised_by": user.get("email")})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return _ticket(t)


class TicketReply(BaseModel):
    text: str = Field(..., max_length=2000)


@router.post("/tickets/{ticket_id}/reply")
async def add_to_ticket(ticket_id: str, body: TicketReply, user: dict = Depends(get_current_user)):
    t = await db.support_tickets.find_one({"_id": _oid(ticket_id), "raised_by": user.get("email")})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if t.get("status") == "Resolved":
        raise HTTPException(status_code=400, detail="This ticket is closed. Raise a new one.")
    if len(body.text.strip()) < 2:
        raise HTTPException(status_code=400, detail="Write a message.")
    await db.support_tickets.update_one({"_id": t["_id"]}, {"$push": {"timeline": {"status": "Message", "at": now_iso(), "by": _who(user), "text": body.text.strip()}},
                                                           "$set": {"updated_at": now_iso()}})
    return _ticket(await db.support_tickets.find_one({"_id": t["_id"]}))


# ------------------------------------------------------------------------ chat

class ChatStart(BaseModel):
    consultant_id: str = ""
    subject: str = Field("", max_length=120)
    text: str = Field(..., max_length=2000)


class ChatMessage(BaseModel):
    text: str = Field(..., max_length=2000)


def _thread(t: dict, side: str) -> dict:
    last = (t.get("messages") or [{}])[-1]
    return {"id": str(t["_id"]), "side": side, "consultant": t.get("consultant", ""), "subject": t.get("subject", ""),
            "last": last.get("text", ""), "last_at": last.get("at", ""), "unread": int(t.get(f"unread_{side}") or 0),
            "messages": [{"from": m.get("from"), "name": m.get("name", ""), "text": m.get("text", ""), "at": m.get("at", "")} for m in t.get("messages") or []]}


async def _chat_side(user: dict, tdb: TenantDB) -> tuple[str, Optional[dict]]:
    me = await _consultant_of(user, tdb)
    return ("consultant", me) if me else ("clinic", None)


@router.get("/chats")
async def chats(user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"Chat" (dentor.fig 229, 344): conversations between the clinic and its consultants, newest first."""
    side, me = await _chat_side(user, tdb)
    query = {"consultant_id": str(me["_id"])} if me else {}
    items = await tdb.staff_chats.find(query).sort("updated_at", -1).limit(100).to_list(None)
    out = [_thread(t, side) for t in items]
    for t in out:
        t["messages"] = []
    consultants = [] if me else [{"id": str(c["_id"]), "name": c.get("name", ""), "specialty": c.get("specialty", "")}
                                 async for c in tdb.consultants.find({"status": {"$ne": "Inactive"}}).sort("name", 1)]
    return {"items": out, "consultants": consultants, "side": side}


@router.post("/chats", status_code=201)
async def start_chat(body: ChatStart, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"create message" (dentor.fig 232): a consultant and a case or treatment, then the first message."""
    side, me = await _chat_side(user, tdb)
    if len(body.text.strip()) < 1:
        raise HTTPException(status_code=400, detail="Write a message.")
    if me:
        consultant = me
    else:
        if not has_role(user, FRONT_DESK_ROLES | {"Accountant"}):
            raise HTTPException(status_code=403, detail="Your role cannot start a chat.")
        consultant = await tdb.consultants.find_one({"_id": _oid(body.consultant_id)}) if body.consultant_id else None
        if not consultant:
            raise HTTPException(status_code=400, detail="Choose the consultant.")
    stamp = now_iso()
    msg = {"from": side, "name": _who(user), "text": body.text.strip(), "at": stamp}
    doc = {"consultant_id": str(consultant["_id"]), "consultant": consultant.get("name", ""), "subject": body.subject.strip() or "General",
           "messages": [msg], f"unread_{'clinic' if side == 'consultant' else 'consultant'}": 1, "created_at": stamp, "updated_at": stamp}
    result = await tdb.staff_chats.insert_one(doc)
    await _tell_other(tdb, side, doc, body.text.strip(), str(result.inserted_id))
    return _thread(await tdb.staff_chats.find_one({"_id": result.inserted_id}), side)


async def _tell_other(tdb: TenantDB, side: str, thread: dict, text: str, thread_id: str) -> None:
    data = {"chat_id": thread_id, "screen": "chat"}
    if side == "clinic":
        await notify_doctor(db, tdb.clinic_id, thread.get("consultant", ""), f"Message from the clinic · {thread.get('subject', '')}", text[:140], "chat", data)
    else:
        await notify_front_desk(db, tdb.clinic_id, f"{thread.get('consultant', '')} · {thread.get('subject', '')}", text[:140], "chat", data)


async def _my_thread(tdb: TenantDB, user: dict, thread_id: str) -> tuple[dict, str]:
    side, me = await _chat_side(user, tdb)
    query = {"_id": _oid(thread_id)}
    if me:
        query["consultant_id"] = str(me["_id"])
    t = await tdb.staff_chats.find_one(query)
    if not t:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return t, side


@router.get("/chats/{thread_id}")
async def chat(thread_id: str, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"view" / "message" (dentor.fig 230–231, 345–346). Opening it marks it read."""
    t, side = await _my_thread(tdb, user, thread_id)
    await tdb.staff_chats.update_one({"_id": t["_id"]}, {"$set": {f"unread_{side}": 0}})
    t[f"unread_{side}"] = 0
    return _thread(t, side)


@router.post("/chats/{thread_id}/messages", status_code=201)
async def send_message(thread_id: str, body: ChatMessage, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    t, side = await _my_thread(tdb, user, thread_id)
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Write a message.")
    other = "clinic" if side == "consultant" else "consultant"
    stamp = now_iso()
    await tdb.staff_chats.update_one({"_id": t["_id"]}, {"$push": {"messages": {"from": side, "name": _who(user), "text": body.text.strip(), "at": stamp}},
                                                        "$inc": {f"unread_{other}": 1}, "$set": {"updated_at": stamp}})
    await _tell_other(tdb, side, t, body.text.strip(), str(t["_id"]))
    return _thread(await tdb.staff_chats.find_one({"_id": t["_id"]}), side)


# ---------------------------------------------------------------------- offers

class OfferBody(BaseModel):
    title: str = Field(..., max_length=80)
    kind: str  # treatment | general
    treatment: str = Field("", max_length=120)
    category: str = Field("", max_length=60)
    discount_type: str  # percentage | amount
    value: float
    valid_till: str
    send: str = "now"  # now | later
    send_at: str = ""  # ISO date-time in the clinic's time, for "later"


def _check_offer(body: OfferBody, today: str) -> None:
    if len(body.title.strip()) < 3:
        raise HTTPException(status_code=400, detail="Give the offer a title.")
    if body.kind not in ("treatment", "general"):
        raise HTTPException(status_code=400, detail="Choose a treatment-specific or a general offer.")
    if body.kind == "treatment" and not body.treatment.strip():
        raise HTTPException(status_code=400, detail="Choose the treatment.")
    if body.discount_type not in ("percentage", "amount"):
        raise HTTPException(status_code=400, detail="Choose percentage or amount.")
    if body.value <= 0 or (body.discount_type == "percentage" and body.value > 90):
        raise HTTPException(status_code=400, detail="A discount is more than 0 and at most 90%.")
    if parse_date(body.valid_till) < today:
        raise HTTPException(status_code=400, detail="The offer must be valid until today or later.")
    if body.send not in ("now", "later"):
        raise HTTPException(status_code=400, detail="Send now or later.")
    if body.send == "later" and not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", body.send_at or ""):
        raise HTTPException(status_code=400, detail="Choose when to send it.")


def _offer(o: dict) -> dict:
    out = serialize({k: v for k, v in o.items() if k not in ("clinic_id", "viewed_by")})
    out["viewed"] = len(o.get("viewed_by") or [])
    out["booked"] = len(o.get("booked_by") or [])
    out["label"] = f"{int(o['value']) if float(o.get('value', 0)).is_integer() else o['value']}{'%' if o.get('discount_type') == 'percentage' else ' ₹'} off"
    return out


async def deliver_offer(tdb: TenantDB, offer: dict) -> int:
    """Tells every patient of the clinic who has the patient app (in-app notification). Returns how many."""
    accounts = {re.sub(r"\D", "", a.get("mobile", ""))[-10:] async for a in db.patient_accounts.find({"status": {"$ne": "Disabled"}}, {"mobile": 1})}
    sent = 0
    async for p in tdb.patients.find({}, {"mobile": 1}):
        if re.sub(r"\D", "", p.get("mobile", ""))[-10:] in accounts:
            await notify_patient(db, tdb.clinic_id, str(p["_id"]), offer.get("title", "A new offer"),
                                 f"{_offer(offer)['label']}{' on ' + offer['treatment'] if offer.get('treatment') else ''}. Valid till {nice_date(offer.get('valid_till'))}.",
                                 "offer", {"offer_id": str(offer["_id"]), "screen": "offers"})
            sent += 1
    await tdb.offers.update_one({"_id": offer["_id"]}, {"$set": {"status": "Sent", "sent_at": now_iso(), "recipients": sent}})
    return sent


@router.get("/offers", dependencies=[admins])
async def offers(tdb: TenantDB = Depends(get_tenant)):
    """"my Post" (dentor.fig 249–250): the clinic's offers with how many patients viewed and booked."""
    items = await tdb.offers.find({}).sort("created_at", -1).limit(100).to_list(None)
    return {"items": [_offer(o) for o in items]}


@router.post("/offers", status_code=201, dependencies=[admins])
async def post_offer(body: OfferBody, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"Create a Offer" (dentor.fig 243–248): sent now, or scheduled for later."""
    today = clinic_today(await clinic_settings(tdb))
    _check_offer(body, today)
    stamp = now_iso()
    doc = {**body.model_dump(), "valid_till": parse_date(body.valid_till), "title": body.title.strip(), "status": "Scheduled" if body.send == "later" else "Sending",
           "viewed_by": [], "booked_by": [], "created_at": stamp, "updated_at": stamp, "created_by": user.get("email", "")}
    result = await tdb.offers.insert_one(doc)
    offer = await tdb.offers.find_one({"_id": result.inserted_id})
    if body.send == "now":
        await deliver_offer(tdb, offer)
        offer = await tdb.offers.find_one({"_id": result.inserted_id})
    return _offer(offer)


@router.patch("/offers/{offer_id}", dependencies=[admins])
async def edit_offer(offer_id: str, body: OfferBody, tdb: TenantDB = Depends(get_tenant)):
    o = await tdb.offers.find_one({"_id": _oid(offer_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Offer not found.")
    today = clinic_today(await clinic_settings(tdb))
    _check_offer(body, today)
    changes = {k: v for k, v in body.model_dump().items() if k not in ("send", "send_at")}
    changes["valid_till"] = parse_date(body.valid_till)
    if o.get("status") == "Scheduled":
        changes.update({"send": body.send, "send_at": body.send_at})
    await tdb.offers.update_one({"_id": o["_id"]}, {"$set": {**changes, "updated_at": now_iso()}})
    return _offer(await tdb.offers.find_one({"_id": o["_id"]}))


@router.get("/offers/{offer_id}", dependencies=[admins])
async def offer_detail(offer_id: str, tdb: TenantDB = Depends(get_tenant)):
    o = await tdb.offers.find_one({"_id": _oid(offer_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Offer not found.")
    out = _offer(o)
    out["viewers"] = [{"patient": v.get("name", ""), "code": v.get("code", ""), "at": v.get("at", "")} for v in o.get("viewed_by") or []]
    out["bookers"] = [{"patient": v.get("name", ""), "code": v.get("code", ""), "at": v.get("at", "")} for v in o.get("booked_by") or []]
    return out


async def deliver_due_offers() -> int:
    """Sends the scheduled offers whose time has come (run every minute by main.py's lifespan task)."""
    from zoneinfo import ZoneInfo
    count = 0
    async for clinic in db.clinics.find({"status": {"$ne": "Suspended"}}, {"_id": 1}):
        tdb = TenantDB(db, str(clinic["_id"]))
        now = datetime.now(ZoneInfo(str((await clinic_settings(tdb)).get("timezone") or "Asia/Kolkata"))).strftime("%Y-%m-%dT%H:%M")
        while True:
            # claim one at a time, so two API processes never send the same offer twice
            o = await tdb.offers.find_one_and_update({"status": "Scheduled", "send_at": {"$lte": now}}, {"$set": {"status": "Sending"}})
            if not o:
                break
            await deliver_offer(tdb, o)
            count += 1
    return count


async def offer_loop(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await deliver_due_offers()
        except Exception as exc:  # never let the loop die
            log.warning("Scheduled offers could not be sent this minute: %s", exc)
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass


# --------------------------------------------------------------------- ratings

class RatingBody(BaseModel):
    booking_id: str
    stars: int = Field(..., ge=1, le=5)
    recommend: Optional[bool] = None
    aspects: list[str] = []
    text: str = Field("", max_length=1000)


@router.post("/ratings", status_code=201)
async def rate(body: RatingBody, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """After a completed consultant visit the clinic rates the consultant (dentor.fig 368) and the consultant
    rates the clinic (437–441). Once per side per visit."""
    b = await tdb.consultant_bookings.find_one({"_id": _oid(body.booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Visit not found.")
    side, me = await _chat_side(user, tdb)
    if me and b.get("consultant") != me.get("name"):
        raise HTTPException(status_code=404, detail="Visit not found.")
    if b.get("status") != "Completed":
        raise HTTPException(status_code=400, detail="You can rate a visit once it is completed.")
    field = f"rated_by_{side}"
    if b.get(field):
        raise HTTPException(status_code=409, detail="You have already rated this visit.")
    clinic = await db.clinics.find_one({"_id": _oid(tdb.clinic_id)})
    stamp = now_iso()
    review = {"code": f"RV-{str(b['_id'])[-6:]}-{side[0].upper()}", "type": "Clinic" if side == "consultant" else "Consultant",
              "subject": (clinic or {}).get("name", "") if side == "consultant" else b.get("consultant", ""),
              "reviewer": _who(user), "rating": body.stars, "recommend": body.recommend, "aspects": body.aspects[:8], "text": body.text.strip(),
              "channel": "Consultant App" if side == "consultant" else "Clinic App", "status": "Approved", "booking_id": str(b["_id"]),
              "date": clinic_today(await clinic_settings(tdb)), "created_at": stamp, "updated_at": stamp}
    await tdb.reviews.insert_one(review)
    await tdb.consultant_bookings.update_one({"_id": b["_id"]}, {"$set": {field: body.stars}})
    if side == "clinic":
        await notify_doctor(db, tdb.clinic_id, b.get("consultant", ""), "Rating from the clinic", f"You have got a {body.stars}-star rating from {(clinic or {}).get('name', 'the clinic')}.", "review", {})
    return {"ok": True, "stars": body.stars}


@router.get("/reviews/mine")
async def my_reviews(user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"Reviews" (dentor.fig 440): what was said about me (a consultant) or about the clinic."""
    side, me = await _chat_side(user, tdb)
    if me:
        query = {"type": "Consultant", "subject": me.get("name"), "status": "Approved"}
    else:
        clinic = await db.clinics.find_one({"_id": _oid(tdb.clinic_id)})
        query = {"type": "Clinic", "subject": (clinic or {}).get("name", ""), "status": "Approved"}
    items = await tdb.reviews.find(query).sort("created_at", -1).limit(100).to_list(None)
    stars = [float(r.get("rating") or 0) for r in items if r.get("rating")]
    return {"average": round(sum(stars) / len(stars), 1) if stars else None, "count": len(items),
            "items": [{"by": r.get("reviewer", ""), "rating": r.get("rating", ""), "text": r.get("text", ""), "date": r.get("date", ""), "recommend": r.get("recommend")} for r in items]}


# ------------------------------------------------------- notification settings

class Prefs(BaseModel):
    mute: bool = False
    sound: bool = True
    vibrate: bool = True
    muted_minutes: int = Field(0, ge=0, le=24 * 60)
    sleep: dict = {}


@router.get("/prefs")
async def get_prefs(user: dict = Depends(get_current_user)):
    p = await db.user_prefs.find_one({"email": user.get("email")}) or {}
    return {"mute": bool(p.get("mute")), "sound": p.get("sound", True), "vibrate": p.get("vibrate", True), "muted_until": p.get("muted_until", ""),
            "sleep": p.get("sleep") or {"enabled": False, "start": "22:00", "end": "07:00"}}


@router.put("/prefs")
async def set_prefs(body: Prefs, user: dict = Depends(get_current_user)):
    """"notification setting" (dentor.fig 286–289): mute, sound, vibrate, silence for 30/60/90 minutes, sleep hours."""
    from zoneinfo import ZoneInfo
    sleep = body.sleep or {}
    if sleep.get("enabled"):
        for k in ("start", "end"):
            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", str(sleep.get(k, ""))):
                raise HTTPException(status_code=400, detail="Sleep hours are like 22:00 to 07:00.")
    until = (datetime.now(ZoneInfo("Asia/Kolkata")) + timedelta(minutes=body.muted_minutes)).isoformat() if body.muted_minutes else ""
    await db.user_prefs.update_one({"email": user.get("email")}, {"$set": {
        "mute": body.mute, "sound": body.sound, "vibrate": body.vibrate, "muted_until": until,
        "sleep": {"enabled": bool(sleep.get("enabled")), "start": sleep.get("start", "22:00"), "end": sleep.get("end", "07:00")}, "updated_at": now_iso()}}, upsert=True)
    return await get_prefs(user)


# ------------------------------------------------------- refer & earn, wallet

def referral_code(email: str) -> str:
    return "DEN" + hashlib.sha256(f"ref:{email}".encode()).hexdigest()[:5].upper()


async def credit_referral(code: str, new_email: str, kind: str) -> None:
    """When an application that named a referral code is approved, the referrer gets points (platform.py)."""
    code = (code or "").strip().upper()
    if not code:
        return
    async for u in db.users.find({"role": {"$in": list(APP_ROLES)}}, {"email": 1, "name": 1}):
        if referral_code(u["email"]) == code and u["email"] != new_email:
            if await db.points_ledger.find_one({"email": u["email"], "ref": new_email}):
                return
            await db.points_ledger.insert_one({"email": u["email"], "points": REFERRAL_POINTS, "reason": f"Referral: {kind} joined", "ref": new_email, "at": now_iso()})
            await notify_users(db, "", [u["email"]], "You earned points", f"{REFERRAL_POINTS} points for referring a new {kind}.", "wallet", {"screen": "wallet"})
            return


@router.get("/wallet")
async def wallet(user: dict = Depends(get_current_user)):
    """"wallet" and "Refer 'n' earn" (dentor.fig 307–311, 398–400): the referral code, points and tier. There is no
    money top-up: online payments are excluded, so the wallet holds points only."""
    ledger = await db.points_ledger.find({"email": user.get("email")}).sort("at", -1).to_list(200)
    points = sum(int(x.get("points") or 0) for x in ledger)
    tier = [name for floor, name in TIERS if points >= floor][-1]
    return {"code": referral_code(user.get("email", "")), "points": points, "tier": tier, "per_referral": REFERRAL_POINTS,
            "transactions": [{"points": x.get("points"), "reason": x.get("reason", ""), "at": x.get("at", "")} for x in ledger]}


# --------------------------------------------------------- plans and the store

@router.get("/plans")
async def plans(user: dict = Depends(get_current_user)):
    """"subscription" ELITE / ELITE PRO / ELITE PREMIUM (dentor.fig 312–315, 406–408)."""
    clinic = await db.clinics.find_one({"_id": _oid(user["clinic_id"])}) if user.get("clinic_id") else None
    pending = await db.support_tickets.find_one({"raised_by": user.get("email"), "type": "Subscription", "status": {"$ne": "Resolved"}})
    return {"plans": PLANS, "current": (clinic or {}).get("plan", ""), "pending_request": bool(pending)}


class PlanRequest(BaseModel):
    plan: str


@router.post("/plans/request", status_code=201)
async def request_plan(body: PlanRequest, user: dict = Depends(get_current_user)):
    """"Begin Journey": a request to Dentor (a support ticket), not a purchase."""
    plan = next((p for p in PLANS if p["key"] == body.plan), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Choose a plan.")
    if await db.support_tickets.find_one({"raised_by": user.get("email"), "type": "Subscription", "status": {"$ne": "Resolved"}}):
        raise HTTPException(status_code=409, detail="You already have a plan request with Dentor.")
    t = await create_ticket(user, user.get("clinic_id", ""), "Subscription", f"Upgrade to {plan['name']}",
                            f"Please activate {plan['name']} (₹{plan['price']}, {plan['days']} days, {plan['cases']} cases).")
    return _ticket(t)


@router.get("/products")
async def products(q: str = "", category: str = ""):
    """The Dentor store (dentor.fig "E-com", the home's products): a catalogue. Buying in the app is excluded;
    "Enquire" sends Dentor a request."""
    query: dict = {"status": {"$ne": "Inactive"}}
    if category:
        query["category"] = category
    if q.strip():
        query["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    items = await db.products.find(query).sort("name", 1).to_list(200)
    return {"items": [{"id": str(p["_id"]), "name": p.get("name", ""), "category": p.get("category", ""), "price": p.get("price", 0), "mrp": p.get("mrp", 0),
                       "brand": p.get("brand", ""), "description": p.get("description", "")} for p in items],
            "categories": sorted({p.get("category", "") for p in items if p.get("category")})}


class Enquiry(BaseModel):
    quantity: int = Field(1, ge=1, le=500)
    note: str = Field("", max_length=300)


@router.post("/products/{product_id}/enquire", status_code=201)
async def enquire(product_id: str, body: Enquiry, user: dict = Depends(get_current_user)):
    p = await db.products.find_one({"_id": _oid(product_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")
    t = await create_ticket(user, user.get("clinic_id", ""), "Store enquiry", f"{p.get('name')} × {body.quantity}",
                            body.note.strip() or f"Please send a quote for {body.quantity} × {p.get('name')}.")
    return _ticket(t)


# ------------------------------------------------------ the consultant's stock

class StockItem(BaseModel):
    name: str = Field(..., max_length=80)
    category: str = Field("", max_length=40)
    stock: int = Field(0, ge=0, le=100000)
    unit: str = Field("pcs", max_length=20)
    reorder: int = Field(0, ge=0, le=100000)


class StockChange(BaseModel):
    change: int = Field(..., ge=-100000, le=100000)
    reason: str = Field("", max_length=120)
    case: str = Field("", max_length=40)


async def _me(user: dict, tdb: TenantDB) -> dict:
    me = await _consultant_of(user, tdb)
    if not me:
        raise HTTPException(status_code=403, detail="The inventory is for consultants.")
    return me


@router.get("/inventory")
async def inventory(user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """The consultant's own kit (dentor.fig 401–404): items, low stock, cases today, history and usage."""
    me = await _me(user, tdb)
    items = await tdb.consultant_inventory.find({"consultant_id": str(me["_id"])}).sort("name", 1).to_list(None)
    today = clinic_today(await clinic_settings(tdb))
    cases = await tdb.appointments.count_documents({"doctor": me.get("name"), "date": today, "status": {"$ne": "Cancelled"}})
    history = await tdb.consultant_stock_moves.find({"consultant_id": str(me["_id"])}).sort("at", -1).limit(100).to_list(None)
    return {"items": [{"id": str(i["_id"]), "name": i.get("name", ""), "category": i.get("category", ""), "stock": i.get("stock", 0), "unit": i.get("unit", ""),
                       "reorder": i.get("reorder", 0), "low": int(i.get("stock", 0)) <= int(i.get("reorder", 0))} for i in items],
            "totals": {"items": len(items), "low": sum(1 for i in items if int(i.get("stock", 0)) <= int(i.get("reorder", 0))), "cases_today": cases},
            "history": [{"item": h.get("item", ""), "change": h.get("change", 0), "reason": h.get("reason", ""), "case": h.get("case", ""), "at": h.get("at", "")} for h in history]}


@router.post("/inventory", status_code=201)
async def add_stock_item(body: StockItem, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    me = await _me(user, tdb)
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Give the item a name.")
    if await tdb.consultant_inventory.find_one({"consultant_id": str(me["_id"]), "name": {"$regex": f"^{re.escape(body.name.strip())}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail=f"{body.name.strip()} is already in your inventory.")
    stamp = now_iso()
    result = await tdb.consultant_inventory.insert_one({**body.model_dump(), "name": body.name.strip(), "consultant_id": str(me["_id"]), "created_at": stamp, "updated_at": stamp})
    return {"id": str(result.inserted_id)}


@router.post("/inventory/{item_id}/adjust")
async def adjust_stock(item_id: str, body: StockChange, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
    """"adjust" / "Usage" (dentor.fig 402, 404–405): stock in or out, optionally against a case."""
    me = await _me(user, tdb)
    if body.change == 0:
        raise HTTPException(status_code=400, detail="Change the stock by at least one.")
    item = await tdb.consultant_inventory.find_one_and_update(
        {"_id": _oid(item_id), "consultant_id": str(me["_id"]), "stock": {"$gte": -body.change if body.change < 0 else 0}},
        {"$inc": {"stock": body.change}, "$set": {"updated_at": now_iso()}}, return_document=True)
    if not item:
        raise HTTPException(status_code=400, detail="Not enough stock for that.")
    await tdb.consultant_stock_moves.insert_one({"consultant_id": str(me["_id"]), "item": item.get("name", ""), "change": body.change,
                                                 "reason": body.reason.strip() or ("Used" if body.change < 0 else "Added"), "case": body.case.strip(), "at": now_iso()})
    return {"id": str(item["_id"]), "stock": item.get("stock", 0)}


# -------------------------------------------------------------------- job posts

class JobBody(BaseModel):
    kind: str  # hiring | seeking
    title: str = Field(..., max_length=100)
    specialty: str = Field("", max_length=60)
    location: str = Field("", max_length=60)
    description: str = Field(..., max_length=1500)
    contact: str = Field("", max_length=80)


def _job(j: dict, me: str) -> dict:
    out = serialize({k: v for k, v in j.items() if k != "clinic_id"})
    out["mine"] = j.get("posted_by") == me
    return out


@router.get("/jobs")
async def jobs(kind: str = "", mine: bool = False, user: dict = Depends(get_current_user)):
    """Job posts (dentor.fig 328–332): clinics hiring and consultants looking for work, across Dentor."""
    query: dict = {"status": "Open"}
    if kind in ("hiring", "seeking"):
        query["kind"] = kind
    if mine:
        query = {"posted_by": user.get("email")}
    items = await db.job_posts.find(query).sort("created_at", -1).limit(200).to_list(None)
    return {"items": [_job(j, user.get("email", "")) for j in items]}


@router.post("/jobs", status_code=201)
async def post_job(body: JobBody, user: dict = Depends(get_current_user)):
    """"post a job" / "Add post Job seeking" (dentor.fig 328, 331)."""
    if body.kind not in ("hiring", "seeking"):
        raise HTTPException(status_code=400, detail="Choose hiring or looking for work.")
    if body.kind == "hiring" and not has_role(user, CLINIC_ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Only the clinic owner or an administrator posts jobs for the clinic.")
    if len(body.title.strip()) < 3 or len(body.description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Give a title and a description.")
    clinic = await db.clinics.find_one({"_id": _oid(user["clinic_id"])}) if user.get("clinic_id") else None
    stamp = now_iso()
    doc = {**body.model_dump(), "title": body.title.strip(), "description": body.description.strip(), "status": "Open",
           "posted_by": user.get("email", ""), "poster": _who(user), "poster_role": user.get("role", ""), "clinic": (clinic or {}).get("name", ""),
           "clinic_id": user.get("clinic_id", ""), "city": (clinic or {}).get("city", ""), "created_at": stamp, "updated_at": stamp}
    result = await db.job_posts.insert_one(doc)
    return _job(await db.job_posts.find_one({"_id": result.inserted_id}), user.get("email", ""))


@router.post("/jobs/{job_id}/close")
async def close_job(job_id: str, user: dict = Depends(get_current_user)):
    j = await db.job_posts.find_one({"_id": _oid(job_id), "posted_by": user.get("email")})
    if not j:
        raise HTTPException(status_code=404, detail="Post not found.")
    await db.job_posts.update_one({"_id": j["_id"]}, {"$set": {"status": "Closed", "updated_at": now_iso()}})
    return _job(await db.job_posts.find_one({"_id": j["_id"]}), user.get("email", ""))

"""In-app notifications with optional push delivery.

Every notification is stored (the apps show a notification centre and unread badges).
Push is best-effort on top: it is only attempted when PUSH_PROVIDER is configured and never
blocks or fails the request that triggered it.
"""
import asyncio
import json
import logging
import urllib.request
from datetime import datetime, timedelta, timezone

from .config import NOTIFICATION_RETENTION_DAYS, PUSH_PROVIDER, PUSH_WEBHOOK_TOKEN, PUSH_WEBHOOK_URL
from .util import now_iso, to_object_id

log = logging.getLogger("dentor")

KIND_PATIENT = "patient"  # to_id = patient record id
KIND_USER = "user"        # to_id = user email


def _expiry() -> dict:
    """The date after which MongoDB removes a notification (see the TTL index in migrate.py)."""
    if NOTIFICATION_RETENTION_DAYS <= 0:
        return {}
    return {"expires_at": datetime.now(timezone.utc) + timedelta(days=NOTIFICATION_RETENTION_DAYS)}


def push_configured() -> bool:
    return PUSH_PROVIDER == "webhook" and bool(PUSH_WEBHOOK_URL)


def _send_webhook(payload: dict) -> None:
    headers = {"Content-Type": "application/json"}
    if PUSH_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {PUSH_WEBHOOK_TOKEN}"
    req = urllib.request.Request(PUSH_WEBHOOK_URL, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10):  # noqa: S310 (operator-configured URL)
        pass


def quiet_now(prefs: dict, now: datetime | None = None) -> bool:
    """A staff member's notification settings (dentor.fig "notification setting" 286–288): muted, muted until a
    time, or inside their sleep hours. In-app notifications are always stored; only phone alerts are held back."""
    from zoneinfo import ZoneInfo
    now = now or datetime.now(ZoneInfo("Asia/Kolkata"))
    if prefs.get("mute"):
        return True
    until = prefs.get("muted_until") or ""
    if until and now.isoformat() < until:
        return True
    sleep = prefs.get("sleep") or {}
    if sleep.get("enabled") and sleep.get("start") and sleep.get("end"):
        hm = now.strftime("%H:%M")
        start, end = sleep["start"], sleep["end"]
        return start <= hm < end if start < end else (hm >= start or hm < end)
    return False


async def _push(db, owner_kind: str, owner_ids: list[str], title: str, body: str, data: dict) -> None:
    if not push_configured() or not owner_ids:
        return
    if owner_kind == KIND_USER:
        quiet = {p["email"] async for p in db.user_prefs.find({"email": {"$in": owner_ids}}) if quiet_now(p)}
        owner_ids = [o for o in owner_ids if o not in quiet]
        if not owner_ids:
            return
    devices = [
        {"token": d["token"], "platform": d.get("platform", "")}
        async for d in db.device_tokens.find({"owner_kind": owner_kind, "owner_id": {"$in": owner_ids}})
    ]
    if not devices:
        return
    try:
        await asyncio.to_thread(_send_webhook, {"devices": devices, "title": title, "body": body, "data": data})
    except Exception as exc:
        log.warning("Push delivery failed (notifications remain available in-app): %s", exc)


def _spawn(coro) -> None:
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        coro.close()


# patient-app.fig "Notification settings" (96:803): which kinds of phone alert each switch controls
PATIENT_ALERT_GROUPS = {"appointment": "appointment_reminders", "prescription": "medicine_alerts", "report": "lab_alerts", "lab": "lab_alerts"}


def patient_wants(prefs: dict, kind: str) -> bool:
    """Phone alerts the patient turned off are not pushed; the notification is still stored in the app."""
    if prefs.get("general") is False:
        return False
    group = PATIENT_ALERT_GROUPS.get(kind)
    return prefs.get(group, True) is not False if group else True


async def notify_patient(db, clinic_id: str, patient_id: str, title: str, body: str,
                         kind: str = "general", data: dict | None = None) -> None:
    """Notify the patient record `patient_id` (and push to the app account on the same mobile)."""
    if not patient_id:
        return
    data = data or {}
    await db.notifications.insert_one({
        "clinic_id": clinic_id, "to_kind": KIND_PATIENT, "to_id": str(patient_id),
        "title": title, "body": body, "kind": kind, "data": data,
        "read_at": None, "created_at": now_iso(), **_expiry(),
    })
    if push_configured():
        patient = await db.patients.find_one({"_id": to_object_id(str(patient_id)), "clinic_id": clinic_id})
        mobile = "".join(c for c in str((patient or {}).get("mobile", "")) if c.isdigit())[-10:]
        if mobile:
            account = await db.patient_accounts.find_one({"mobile": mobile})
            if account and patient_wants(account.get("prefs") or {}, kind):
                _spawn(_push(db, KIND_PATIENT, [str(account["_id"])], title, body, data))


async def notify_users(db, clinic_id: str, emails: list[str], title: str, body: str,
                       kind: str = "general", data: dict | None = None) -> None:
    emails = sorted({e for e in emails if e})
    if not emails:
        return
    data = data or {}
    created = now_iso()
    expiry = _expiry()
    await db.notifications.insert_many([
        {"clinic_id": clinic_id, "to_kind": KIND_USER, "to_id": e, "title": title, "body": body,
         "kind": kind, "data": data, "read_at": None, "created_at": created, **expiry}
        for e in emails
    ])
    _spawn(_push(db, KIND_USER, emails, title, body, data))


async def notify_roles(db, clinic_id: str, roles: set[str], title: str, body: str,
                       kind: str = "general", data: dict | None = None) -> None:
    emails = [u["email"] async for u in db.users.find(
        {"clinic_id": clinic_id, "role": {"$in": list(roles)}, "status": {"$nin": ["Inactive", "Deleted"]}}, {"email": 1}
    )]
    await notify_users(db, clinic_id, emails, title, body, kind, data)


async def notify_front_desk(db, clinic_id: str, title: str, body: str,
                            kind: str = "general", data: dict | None = None) -> None:
    """Everyone who works the reception app for this clinic (all staff logins except consultants)."""
    emails = [u["email"] async for u in db.users.find(
        {"clinic_id": clinic_id, "role": {"$nin": ["Consultant", "Super Admin"]}, "status": {"$nin": ["Inactive", "Deleted"]}},
        {"email": 1},
    )]
    await notify_users(db, clinic_id, emails, title, body, kind, data)


async def notify_doctor(db, clinic_id: str, doctor_name: str, title: str, body: str,
                        kind: str = "general", data: dict | None = None) -> None:
    """Notify the consultant login(s) linked to the consultant record named `doctor_name`."""
    if not doctor_name:
        return
    ids = [str(c["_id"]) async for c in db.consultants.find({"clinic_id": clinic_id, "name": doctor_name}, {"_id": 1})]
    if not ids:
        return
    emails = [u["email"] async for u in db.users.find(
        {"clinic_id": clinic_id, "consultant_id": {"$in": ids}, "status": {"$nin": ["Inactive", "Deleted"]}}, {"email": 1}
    )]
    await notify_users(db, clinic_id, emails, title, body, kind, data)


async def resolve_patient_id(tdb, record: dict) -> str | None:
    """Find the patient record a clinic document (appointment, invoice, prescription…) refers to."""
    pid = record.get("patientId")
    if pid and len(str(pid)) == 24:
        try:
            found = await tdb.patients.find_one({"_id": to_object_id(str(pid))})
            if found:
                return str(found["_id"])
        except Exception:
            pass
    code = record.get("patientCode") or (pid if pid and len(str(pid)) != 24 else None)
    if code:
        found = await tdb.patients.find_one({"code": code})
        if found:
            return str(found["_id"])
    return None


# ---- read side, shared by the user and patient notification endpoints ----

async def list_notifications(db, clinic_id: str, to_kind: str, to_id: str, limit: int = 60) -> dict:
    query = {"clinic_id": clinic_id, "to_kind": to_kind, "to_id": to_id}
    items = await db.notifications.find(query).sort("created_at", -1).limit(min(limit, 200)).to_list(None)
    unread = await db.notifications.count_documents({**query, "read_at": None})
    out = []
    for n in items:
        out.append({
            "id": str(n["_id"]), "title": n.get("title", ""), "body": n.get("body", ""),
            "kind": n.get("kind", "general"), "data": n.get("data") or {},
            "read": n.get("read_at") is not None, "created_at": n.get("created_at"),
        })
    return {"items": out, "unread": unread}


async def mark_read(db, clinic_id: str, to_kind: str, to_id: str, ids: list[str] | None) -> int:
    query: dict = {"clinic_id": clinic_id, "to_kind": to_kind, "to_id": to_id, "read_at": None}
    if ids:
        query["_id"] = {"$in": [to_object_id(i) for i in ids]}
    result = await db.notifications.update_many(query, {"$set": {"read_at": now_iso()}})
    return result.modified_count


async def register_device(db, owner_kind: str, owner_id: str, token: str, platform: str) -> None:
    token = (token or "").strip()
    if not token or len(token) > 400:
        return
    await db.device_tokens.update_one(
        {"token": token},
        {"$set": {"owner_kind": owner_kind, "owner_id": owner_id, "platform": (platform or "")[:20], "updated_at": now_iso()}},
        upsert=True,
    )


async def unregister_device(db, token: str) -> None:
    if token:
        await db.device_tokens.delete_one({"token": token.strip()})

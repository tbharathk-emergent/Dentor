"""Super admin endpoints: manage clinics (tenants) and their login users."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import SUPER_ADMIN_ROLE, hash_password, is_super_admin, require_super_admin
from .. import config as _config
from ..config import EMAIL_PROVIDER, NOTIFICATION_RETENTION_DAYS, SMS_PROVIDER
from ..db import db
from ..email_codes import email_configured, send_email_message
from ..notify import push_configured
from ..otp import is_test_mobile, masked_mobile, sms_configured
from ..test_accounts import SOURCE as TEST_SOURCE
from ..account_deletion import DELETED, list_deleted, restore
from ..roles import CONSULTANT, STAFF_ROLE_OPTIONS
from ..rules import check_password_strength, clinic_settings
from ..seed import seed_reference
from ..sessions import revoke_all_sessions
from .clinic_users import validate_consultant_link
from ..tenancy import TenantDB
from ..util import next_sequence, now_iso, serialize, text_filter, to_object_id

router = APIRouter(prefix="/api/platform", tags=["platform"], dependencies=[Depends(require_super_admin)])

CLINIC_STATUSES = {"Active", "Suspended"}
USER_STATUSES = {"Active", "Inactive"}
CLINIC_FIELDS = ["name", "city", "phone", "email", "address", "plan"]


class ClinicCreate(BaseModel):
    name: str
    city: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    plan: str = "Standard"
    admin_name: str
    admin_email: str
    admin_password: str
    # The clinic's first login. An owner has full access plus the Clinic Owner app.
    admin_role: str = "Clinic Owner"


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "Administrator"
    consultant_id: Optional[str] = None  # required when role is Consultant


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    consultant_id: Optional[str] = None


class PasswordReset(BaseModel):
    new_password: str


async def _get_clinic(clinic_id: str) -> dict:
    clinic = await db.clinics.find_one({"_id": to_object_id(clinic_id)})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


async def _get_clinic_user(user_id: str) -> dict:
    user = await db.users.find_one({"_id": to_object_id(user_id)})
    if not user or is_super_admin(user):
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _check_password(password: str, clinic_id: str):
    """Respect the target clinic's 'Strong password policy' setting (defaults to strong)."""
    settings = await clinic_settings(TenantDB(db, clinic_id))
    check_password_strength(password, bool(settings.get("strongPassword", True)))


def _check_role(role: str) -> str:
    role = role.strip()
    if not role or role == SUPER_ADMIN_ROLE:
        raise HTTPException(status_code=400, detail="Choose a clinic role for this user.")
    return role


async def _new_user_doc(clinic_id: str, name: str, email: str, password: str, role: str, created_by: str) -> dict:
    name, email = name.strip(), email.lower().strip()
    if not name or "@" not in email:
        raise HTTPException(status_code=400, detail="Enter the user's name and a valid email.")
    await _check_password(password, clinic_id)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail=f"{email} already has a Dentor login.")
    now = now_iso()
    return {
        "name": name, "email": email, "role": _check_role(role), "clinic_id": clinic_id,
        "password_hash": hash_password(password), "status": "Active",
        "created_at": now, "updated_at": now, "created_by": created_by,
    }


async def _counts(collection: str, pipeline_sum: Optional[str] = None) -> dict:
    group = {"_id": "$clinic_id", "n": {"$sum": {"$ifNull": [f"${pipeline_sum}", 0]} if pipeline_sum else 1}}
    rows = await db[collection].aggregate([{"$group": group}]).to_list(None)
    return {r["_id"]: r["n"] for r in rows}


@router.get("/overview")
async def platform_overview():
    """Figures across every clinic, for the super admin console."""
    clinics = await db.clinics.find({}).to_list(None)
    roles: dict[str, int] = {}
    async for row in db.users.aggregate([{"$match": {"status": {"$ne": DELETED}}}, {"$group": {"_id": "$role", "n": {"$sum": 1}}}]):
        roles[row["_id"] or "Unassigned"] = row["n"]
    money = await db.invoices.aggregate([{"$group": {
        "_id": None, "billed": {"$sum": {"$ifNull": ["$total", 0]}}, "collected": {"$sum": {"$ifNull": ["$paid", 0]}},
    }}]).to_list(1)
    recent = sorted(clinics, key=lambda c: c.get("created_at", ""), reverse=True)[:5]
    return {
        "clinics": len(clinics),
        "clinics_active": sum(1 for c in clinics if c.get("status") != "Suspended"),
        "clinics_suspended": sum(1 for c in clinics if c.get("status") == "Suspended"),
        "users_by_role": roles,
        "staff_logins": sum(n for r, n in roles.items() if r != SUPER_ADMIN_ROLE),
        "patients": await db.patients.count_documents({}),
        "patient_app_accounts": await db.patient_accounts.count_documents({}),
        "appointments": await db.appointments.count_documents({}),
        "app_bookings": await db.appointments.count_documents({"source": "Patient App"}),
        "billed": (money[0]["billed"] if money else 0),
        "collected": (money[0]["collected"] if money else 0),
        "recent_clinics": [{"id": str(c["_id"]), "name": c.get("name", ""), "code": c.get("code", ""),
                            "city": c.get("city", ""), "status": c.get("status", ""), "created_at": c.get("created_at", "")}
                           for c in recent],
        "role_options": STAFF_ROLE_OPTIONS,
        # What the platform owner has to set up outside Dentor for the mobile apps.
        "integrations": {
            "sms": sms_configured(),          # off: patients cannot sign up or use one-time codes
            "sms_test_mode": SMS_PROVIDER == "console",  # codes are shown, not sent (development)
            # testing aids (docs/INTEGRATIONS.md), shown masked while they are on: the fixed code's numbers, and
            # how many test patient logins PATIENT_TEST_ACCOUNTS made active
            "otp_test_mobiles": [masked_mobile(m) for m in _config.OTP_TEST_MOBILES] if is_test_mobile(next(iter(_config.OTP_TEST_MOBILES), "")) else None,
            "patient_test_logins": await db.patient_accounts.count_documents({"test_source": TEST_SOURCE, "status": {"$ne": "Disabled"}}),
            "email": email_configured(),      # off: no password reset by email, no staff sign-up, no application emails
            "email_test_mode": EMAIL_PROVIDER == "console",  # codes are logged and shown, not sent (development)
            "push": push_configured(),        # off: notifications stay inside the apps
            "notification_retention_days": NOTIFICATION_RETENTION_DAYS,
        },
    }


@router.get("/clinics/{clinic_id}/consultants")
async def clinic_consultants(clinic_id: str):
    """Consultant profiles of a clinic, for linking a Consultant login."""
    await _get_clinic(clinic_id)
    rows = await db.consultants.find({"clinic_id": clinic_id}).sort("name", 1).to_list(None)
    linked = {u.get("consultant_id") async for u in db.users.find({"clinic_id": clinic_id, "consultant_id": {"$exists": True},
                                                                   "status": {"$ne": DELETED}})}
    return {"items": [{"id": str(c["_id"]), "name": c.get("name", ""), "code": c.get("code", ""),
                       "specialty": c.get("specialty", ""), "has_login": str(c["_id"]) in linked} for c in rows]}


@router.get("/clinics")
async def list_clinics(q: Optional[str] = None):
    clinics = await db.clinics.find(text_filter(q, ["name", "code", "city", "email", "phone"])).sort("created_at", 1).to_list(None)
    users = await _counts("users")
    patients = await _counts("patients")
    appointments = await _counts("appointments")
    collected = await _counts("invoices", "paid")
    items = []
    for c in clinics:
        cid = str(c["_id"])
        items.append({
            **serialize(c),
            "stats": {
                "users": users.get(cid, 0),
                "patients": patients.get(cid, 0),
                "appointments": appointments.get(cid, 0),
                "collected": collected.get(cid, 0),
            },
        })
    return {"items": items, "total": len(items)}


@router.post("/clinics", status_code=201)
async def create_clinic(body: ClinicCreate, admin: dict = Depends(require_super_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Enter the clinic name.")
    if await db.clinics.find_one({"name": name}):
        raise HTTPException(status_code=409, detail=f"A clinic named {name} already exists.")
    # Validate the administrator before anything is written, so a bad email leaves no half-made clinic.
    first_role = _check_role(body.admin_role)
    if first_role == CONSULTANT:
        raise HTTPException(status_code=400, detail="A clinic's first login must be an owner or administrator.")
    user_doc = await _new_user_doc("", body.admin_name, body.admin_email, body.admin_password, first_role, admin["email"])
    clinic_id = await open_clinic(name, body.city, body.phone, body.email, body.address, body.plan, user_doc, admin["email"])
    return serialize(await db.clinics.find_one({"_id": to_object_id(clinic_id)}))


async def open_clinic(name: str, city: str, phone: str, email: str, address: str, plan: str, user_doc: dict, created_by: str) -> str:
    """Creates the clinic, its first login and its reference data; returns the clinic id. Used by the
    console and by approving a clinic's sign-up application."""
    now = now_iso()
    clinic = {
        "code": await next_sequence(TenantDB(db, "platform"), "clinics", "CL-", 1, width=3),
        "name": name, "city": city.strip(), "phone": phone.strip(),
        "email": email.lower().strip(), "address": address.strip(), "plan": plan.strip() or "Standard",
        "status": "Active", "created_at": now, "updated_at": now, "created_by": created_by,
    }
    result = await db.clinics.insert_one(clinic)
    clinic_id = str(result.inserted_id)

    user_doc["clinic_id"] = clinic_id
    await db.users.insert_one(user_doc)
    await seed_reference(TenantDB(db, clinic_id), {
        "clinicName": name, "legalName": name, "phone": clinic["phone"], "email": clinic["email"],
        "address": clinic["address"], "gstin": "", "registration": "",
    })
    return clinic_id


@router.patch("/clinics/{clinic_id}")
async def update_clinic(clinic_id: str, body: ClinicUpdate):
    clinic = await _get_clinic(clinic_id)
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if "name" in changes and not changes["name"]:
        raise HTTPException(status_code=400, detail="Enter the clinic name.")
    if "status" in changes and changes["status"] not in CLINIC_STATUSES:
        raise HTTPException(status_code=400, detail="Status must be Active or Suspended.")
    if "email" in changes:
        changes["email"] = changes["email"].lower()
    changes["updated_at"] = now_iso()
    await db.clinics.update_one({"_id": clinic["_id"]}, {"$set": changes})
    return serialize(await db.clinics.find_one({"_id": clinic["_id"]}))


@router.get("/clinics/{clinic_id}/users")
async def list_clinic_users(clinic_id: str):
    await _get_clinic(clinic_id)
    users = await db.users.find({"clinic_id": clinic_id, "status": {"$ne": DELETED}}, {"password_hash": 0, "sessions_valid_from": 0}).sort("created_at", 1).to_list(None)
    return {"items": serialize(users), "total": len(users)}


@router.post("/clinics/{clinic_id}/users", status_code=201)
async def create_clinic_user(clinic_id: str, body: UserCreate, admin: dict = Depends(require_super_admin)):
    await _get_clinic(clinic_id)
    doc = await _new_user_doc(clinic_id, body.name, body.email, body.password, body.role, admin["email"])
    consultant_id = await validate_consultant_link(clinic_id, doc["role"], body.consultant_id)
    if consultant_id:
        doc["consultant_id"] = consultant_id
    result = await db.users.insert_one(doc)
    return serialize(await db.users.find_one({"_id": result.inserted_id}, {"password_hash": 0, "sessions_valid_from": 0}))


@router.patch("/users/{user_id}")
async def update_clinic_user(user_id: str, body: UserUpdate):
    user = await _get_clinic_user(user_id)
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    requested_link = changes.pop("consultant_id", None)
    if "name" in changes and not changes["name"]:
        raise HTTPException(status_code=400, detail="Enter the user's name.")
    if "role" in changes:
        changes["role"] = _check_role(changes["role"])
    if "status" in changes and changes["status"] not in USER_STATUSES:
        raise HTTPException(status_code=400, detail="Status must be Active or Inactive.")
    role = changes.get("role", user.get("role"))
    update: dict = {}
    if role == CONSULTANT and (requested_link or "role" in changes):
        changes["consultant_id"] = await validate_consultant_link(
            user.get("clinic_id", ""), role, requested_link or user.get("consultant_id"), exclude_user_id=user["_id"])
    elif role != CONSULTANT and user.get("consultant_id"):
        update["$unset"] = {"consultant_id": ""}
    changes["updated_at"] = now_iso()
    update["$set"] = changes
    await db.users.update_one({"_id": user["_id"]}, update)
    if changes.get("status") == "Inactive":
        await revoke_all_sessions(db, "user", user["email"])
    return serialize(await db.users.find_one({"_id": user["_id"]}, {"password_hash": 0, "sessions_valid_from": 0}))


@router.post("/users/{user_id}/reset-password")
async def reset_clinic_user_password(user_id: str, body: PasswordReset):
    user = await _get_clinic_user(user_id)
    await _check_password(body.new_password, user.get("clinic_id", ""))
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}},
    )
    await revoke_all_sessions(db, "user", user["email"])
    return {"ok": True}


# ------------------------------------------------------------ sign-up applications (onboarding.py)

class ApplicationDecision(BaseModel):
    # For a consultant: the clinic whose consultants they join. Not used for a clinic.
    clinic_id: Optional[str] = None
    reason: str = ""


async def _application(application_id: str) -> dict:
    doc = await db.signup_applications.find_one({"_id": to_object_id(application_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return doc


@router.get("/applications")
async def list_applications(status: Optional[str] = "Pending"):
    from .onboarding import application_view
    query = {"status": status} if status else {}
    docs = await db.signup_applications.find(query).sort("created_at", -1).to_list(500)
    return {"items": [application_view(d) for d in docs]}


@router.get("/applications/{application_id}/files/{name}")
async def application_file(application_id: str, name: str):
    doc = await _application(application_id)
    value = (doc.get("profile") or {}).get(name)
    if name not in ("dci_certificate", "clinic_image") or not value:
        raise HTTPException(status_code=404, detail="File not found")
    return {"name": name, "data_url": value}


@router.post("/applications/{application_id}/approve")
async def approve_application(application_id: str, body: ApplicationDecision, admin: dict = Depends(require_super_admin)):
    doc = await _application(application_id)
    if doc["status"] != "Pending":
        raise HTTPException(status_code=409, detail=f"This application is already {doc['status'].lower()}.")
    if await db.users.find_one({"email": doc["email"]}):
        raise HTTPException(status_code=409, detail=f"{doc['email']} already has a Dentor login.")
    p = doc.get("profile") or {}
    name = p.get("name", "").strip()
    now = now_iso()
    user_doc = {
        "name": name, "email": doc["email"], "password_hash": doc["password_hash"], "status": "Active",
        "mobile": p.get("mobile", ""), "created_at": now, "updated_at": now, "created_by": admin["email"],
    }
    if doc["kind"] == "clinic":
        clinic_name = p.get("clinic_name", "").strip()
        if await db.clinics.find_one({"name": clinic_name}):
            raise HTTPException(status_code=409, detail=f"A clinic named {clinic_name} already exists.")
        user_doc["role"] = "Clinic Owner"
        address = ", ".join(x for x in (p.get("door"), p.get("street"), p.get("area"), p.get("landmark"), p.get("pincode")) if x)
        clinic_id = await open_clinic(clinic_name, p.get("city", ""), p.get("mobile", ""), doc["email"], address, "Standard", user_doc, admin["email"])
    else:
        if not body.clinic_id:
            raise HTTPException(status_code=400, detail="Choose the clinic this consultant joins.")
        clinic = await _get_clinic(body.clinic_id)
        clinic_id = str(clinic["_id"])
        tdb = TenantDB(db, clinic_id)
        # appointments and bookings name their doctor, so two consultants of one clinic cannot share a name
        if await tdb.consultants.find_one({"name": name}):
            raise HTTPException(status_code=409, detail=f"{clinic.get('name', 'This clinic')} already has a consultant named {name}. Ask the applicant to add an initial, or reject with that reason.")
        consultant = {
            "code": await next_sequence(tdb, "consultants", "CON-", 107), "name": name, "type": "Visiting",
            "specialty": p.get("specialisation", ""), "credentials": p.get("dci_number", ""), "experience": p.get("experience", ""),
            "phone": p.get("mobile", ""), "email": doc["email"], "location": p.get("city", ""), "status": "Active",
            "availability": "", "fee": 0, "rating": 0, "about": "", "created_at": now, "updated_at": now, "created_by": admin["email"],
        }
        result = await tdb.consultants.insert_one(consultant)
        user_doc.update({"role": CONSULTANT, "clinic_id": clinic_id, "consultant_id": str(result.inserted_id)})
        await db.users.insert_one(user_doc)
    await db.signup_applications.update_one({"_id": doc["_id"]}, {"$set": {
        "status": "Approved", "clinic_id": clinic_id, "decided_by": admin["email"], "decided_at": now, "updated_at": now}})
    from .engagement import credit_referral
    await credit_referral(p.get("referral_code", ""), doc["email"], doc["kind"])
    app_name = "Dentor Clinic" if doc["kind"] == "clinic" else "Dentor Consultant"
    emailed = await send_email_message(doc["email"], "Your Dentor application is approved",
                                       f"Welcome to Dentor. Sign in to the {app_name} app with {doc['email']} and the password you chose.", "application")
    return {"ok": True, "clinic_id": clinic_id, "emailed": emailed}


@router.post("/applications/{application_id}/reject")
async def reject_application(application_id: str, body: ApplicationDecision, admin: dict = Depends(require_super_admin)):
    doc = await _application(application_id)
    if doc["status"] != "Pending":
        raise HTTPException(status_code=409, detail=f"This application is already {doc['status'].lower()}.")
    reason = body.reason.strip()[:300]
    if not reason:
        raise HTTPException(status_code=400, detail="Say why, so the applicant knows what to change.")
    now = now_iso()
    await db.signup_applications.update_one({"_id": doc["_id"]}, {"$set": {
        "status": "Rejected", "reason": reason, "decided_by": admin["email"], "decided_at": now, "updated_at": now}})
    emailed = await send_email_message(doc["email"], "Your Dentor application",
                                       f"Your application was not approved: {reason}. You can apply again with the same email.", "application")
    return {"ok": True, "emailed": emailed}



# ------------------------------------------------------------- support tickets

@router.get("/tickets")
async def all_tickets(status: str = "open", admin: dict = Depends(require_super_admin)):
    """Tickets raised in the Clinic and Consultant apps (and plan requests and store enquiries)."""
    statuses = {"open": ["Open", "In progress"], "resolved": ["Resolved"]}.get(status, ["Open", "In progress"])
    items = await db.support_tickets.find({"status": {"$in": statuses}}, {"attachment": 0}).sort("created_at", -1).limit(300).to_list(None)
    clinics = {str(c["_id"]): c.get("name", "") async for c in db.clinics.find({}, {"name": 1})}
    out = []
    for t in items:
        row = serialize(t)
        row["clinic"] = clinics.get(t.get("clinic_id") or "", "")
        out.append(row)
    return {"items": out}


class TicketAnswer(BaseModel):
    text: str = ""
    status: str = ""


@router.post("/tickets/{ticket_id}/answer")
async def answer_ticket(ticket_id: str, body: TicketAnswer, admin: dict = Depends(require_super_admin)):
    from ..notify import notify_users
    t = await db.support_tickets.find_one({"_id": to_object_id(ticket_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if body.status and body.status not in ("In progress", "Resolved"):
        raise HTTPException(status_code=400, detail="Status is In progress or Resolved.")
    if not body.text.strip() and not body.status:
        raise HTTPException(status_code=400, detail="Write an answer or change the status.")
    now = now_iso()
    step = {"status": body.status or "Message", "at": now, "by": "Dentor support", "text": body.text.strip()}
    changes = {"updated_at": now, **({"status": body.status} if body.status else {})}
    await db.support_tickets.update_one({"_id": t["_id"]}, {"$push": {"timeline": step}, "$set": changes})
    await notify_users(db, t.get("clinic_id", ""), [t.get("raised_by", "")], f"Ticket {t.get('code')}: {body.status or 'new reply'}",
                       body.text.strip() or f"Your ticket is {body.status.lower()}.", "ticket", {"ticket_id": str(t["_id"]), "screen": "ticket"})
    return serialize(await db.support_tickets.find_one({"_id": t["_id"]}, {"attachment": 0}))


# ------------------------------------------------------------- deleted accounts (app/account_deletion.py)

@router.get("/deleted-accounts")
async def deleted_accounts():
    """Logins deleted with "Delete my account" in the apps; each can be restored."""
    return await list_deleted(db)


@router.post("/deleted-accounts/{kind}/{account_id}/restore")
async def restore_deleted_account(kind: str, account_id: str):
    await restore(db, kind, account_id)
    return {"ok": True}

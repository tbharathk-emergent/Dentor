"""Super admin endpoints: manage clinics (tenants) and their login users."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import SUPER_ADMIN_ROLE, hash_password, is_super_admin, require_super_admin
from ..db import db
from ..rules import check_password_strength, clinic_settings
from ..seed import seed_reference
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


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


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
    user_doc = await _new_user_doc("", body.admin_name, body.admin_email, body.admin_password, "Administrator", admin["email"])

    now = now_iso()
    clinic = {
        "code": await next_sequence(TenantDB(db, "platform"), "clinics", "CL-", 1, width=3),
        "name": name, "city": body.city.strip(), "phone": body.phone.strip(),
        "email": body.email.lower().strip(), "address": body.address.strip(), "plan": body.plan.strip() or "Standard",
        "status": "Active", "created_at": now, "updated_at": now, "created_by": admin["email"],
    }
    result = await db.clinics.insert_one(clinic)
    clinic_id = str(result.inserted_id)

    user_doc["clinic_id"] = clinic_id
    await db.users.insert_one(user_doc)
    await seed_reference(TenantDB(db, clinic_id), {
        "clinicName": name, "legalName": name, "phone": clinic["phone"], "email": clinic["email"],
        "address": clinic["address"], "gstin": "", "registration": "",
    })
    return serialize(await db.clinics.find_one({"_id": result.inserted_id}))


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
    users = await db.users.find({"clinic_id": clinic_id}, {"password_hash": 0}).sort("created_at", 1).to_list(None)
    return {"items": serialize(users), "total": len(users)}


@router.post("/clinics/{clinic_id}/users", status_code=201)
async def create_clinic_user(clinic_id: str, body: UserCreate, admin: dict = Depends(require_super_admin)):
    await _get_clinic(clinic_id)
    doc = await _new_user_doc(clinic_id, body.name, body.email, body.password, body.role, admin["email"])
    result = await db.users.insert_one(doc)
    return serialize(await db.users.find_one({"_id": result.inserted_id}, {"password_hash": 0}))


@router.patch("/users/{user_id}")
async def update_clinic_user(user_id: str, body: UserUpdate):
    user = await _get_clinic_user(user_id)
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if "name" in changes and not changes["name"]:
        raise HTTPException(status_code=400, detail="Enter the user's name.")
    if "role" in changes:
        changes["role"] = _check_role(changes["role"])
    if "status" in changes and changes["status"] not in USER_STATUSES:
        raise HTTPException(status_code=400, detail="Status must be Active or Inactive.")
    changes["updated_at"] = now_iso()
    await db.users.update_one({"_id": user["_id"]}, {"$set": changes})
    return serialize(await db.users.find_one({"_id": user["_id"]}, {"password_hash": 0}))


@router.post("/users/{user_id}/reset-password")
async def reset_clinic_user_password(user_id: str, body: PasswordReset):
    user = await _get_clinic_user(user_id)
    await _check_password(body.new_password, user.get("clinic_id", ""))
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}},
    )
    return {"ok": True}

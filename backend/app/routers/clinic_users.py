"""Login accounts of one clinic, managed by its owner or an administrator.

Used by the Clinic Owner app and the reception web app. Rules enforced here:
- nobody can create or assign the Super Admin role;
- only an owner (or super admin) can create, change or reset a Clinic Owner account;
- a Consultant login must be linked to exactly one consultant profile of this clinic;
- you cannot deactivate or demote your own account;
- deactivating an account or resetting its password ends its sessions.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import SUPER_ADMIN_ROLE, hash_password
from ..db import db
from ..roles import CLINIC_OWNER, CONSULTANT, STAFF_ROLE_OPTIONS, is_owner, require_clinic_admin
from ..rules import check_password_strength, clinic_settings
from ..sessions import revoke_all_sessions
from ..tenancy import TenantDB, get_tenant
from ..util import now_iso, to_object_id

router = APIRouter(prefix="/api/clinic/users", tags=["clinic accounts"])


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str
    role: str = "Receptionist"
    consultant_id: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    role: Optional[str] = None
    status: Optional[str] = None
    consultant_id: Optional[str] = None


class PasswordReset(BaseModel):
    new_password: str


async def _public(tdb: TenantDB, user: dict) -> dict:
    consultant_name = ""
    if user.get("consultant_id"):
        try:
            c = await tdb.consultants.find_one({"_id": to_object_id(user["consultant_id"])})
            consultant_name = (c or {}).get("name", "")
        except HTTPException:
            pass
    return {
        "id": str(user["_id"]), "name": user.get("name", ""), "email": user.get("email", ""),
        "role": user.get("role", ""), "status": user.get("status", "Active"),
        "consultant_id": user.get("consultant_id") or "", "consultant_name": consultant_name,
        "created_at": user.get("created_at", ""),
    }


def _check_role(role: str, actor: dict) -> str:
    role = (role or "").strip()
    if not role or role == SUPER_ADMIN_ROLE:
        raise HTTPException(status_code=400, detail="Choose a clinic role for this login.")
    if role == CLINIC_OWNER and not is_owner(actor):
        raise HTTPException(status_code=403, detail="Only the clinic owner can create or assign owner accounts.")
    return role


async def validate_consultant_link(clinic_id: str, role: str, consultant_id: Optional[str],
                                   exclude_user_id=None) -> Optional[str]:
    """A Consultant login needs one consultant profile of the same clinic, not already linked."""
    if role != CONSULTANT:
        return None
    if not consultant_id:
        raise HTTPException(status_code=400, detail="Choose the consultant profile this login belongs to.")
    consultant = await db.consultants.find_one({"_id": to_object_id(consultant_id), "clinic_id": clinic_id})
    if not consultant:
        raise HTTPException(status_code=404, detail="Consultant profile not found in this clinic.")
    query: dict = {"clinic_id": clinic_id, "consultant_id": str(consultant["_id"])}
    if exclude_user_id is not None:
        query["_id"] = {"$ne": exclude_user_id}
    if await db.users.find_one(query):
        raise HTTPException(status_code=409, detail=f"{consultant.get('name', 'This consultant')} already has a login.")
    return str(consultant["_id"])


async def _target(tdb: TenantDB, user_id: str, actor: dict) -> dict:
    user = await tdb.users.find_one({"_id": to_object_id(user_id)})
    if not user or user.get("role") == SUPER_ADMIN_ROLE:
        raise HTTPException(status_code=404, detail="Login not found.")
    if user.get("role") == CLINIC_OWNER and not is_owner(actor):
        raise HTTPException(status_code=403, detail="Only the clinic owner can change an owner account.")
    return user


@router.get("")
async def list_users(actor: dict = Depends(require_clinic_admin), tdb: TenantDB = Depends(get_tenant)):
    users = await tdb.users.find({}).sort("created_at", 1).to_list(None)
    return {"items": [await _public(tdb, u) for u in users], "roles": STAFF_ROLE_OPTIONS}


@router.post("", status_code=201)
async def create_user(body: UserCreate, actor: dict = Depends(require_clinic_admin), tdb: TenantDB = Depends(get_tenant)):
    role = _check_role(body.role, actor)
    email = body.email.lower().strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    settings = await clinic_settings(tdb)
    check_password_strength(body.password, bool(settings.get("strongPassword", True)))
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail=f"{email} already has a Dentor login.")
    consultant_id = await validate_consultant_link(tdb.clinic_id, role, body.consultant_id)
    stamp = now_iso()
    doc = {"name": body.name.strip(), "email": email, "role": role, "status": "Active",
           "password_hash": hash_password(body.password),
           "created_at": stamp, "updated_at": stamp, "created_by": actor.get("email")}
    if consultant_id:
        doc["consultant_id"] = consultant_id
    result = await tdb.users.insert_one(doc)
    return await _public(tdb, await tdb.users.find_one({"_id": result.inserted_id}))


@router.patch("/{user_id}")
async def update_user(user_id: str, body: UserUpdate, actor: dict = Depends(require_clinic_admin),
                      tdb: TenantDB = Depends(get_tenant)):
    user = await _target(tdb, user_id, actor)
    is_self = user.get("email") == actor.get("email")
    changes: dict = {}
    if body.name is not None:
        changes["name"] = body.name.strip()
    new_role = user.get("role", "")
    if body.role is not None and body.role.strip() != user.get("role"):
        if is_self:
            raise HTTPException(status_code=400, detail="You cannot change your own role.")
        new_role = _check_role(body.role, actor)
        changes["role"] = new_role
    if body.status is not None:
        if body.status not in ("Active", "Inactive"):
            raise HTTPException(status_code=400, detail="Status must be Active or Inactive.")
        if is_self and body.status == "Inactive":
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
        changes["status"] = body.status
    if new_role == CONSULTANT and (body.consultant_id is not None or "role" in changes):
        changes["consultant_id"] = await validate_consultant_link(
            tdb.clinic_id, new_role, body.consultant_id or user.get("consultant_id"), exclude_user_id=user["_id"])
    update: dict = {}
    if changes:
        changes["updated_at"] = now_iso()
        update["$set"] = changes
    if new_role != CONSULTANT and user.get("consultant_id"):
        update["$unset"] = {"consultant_id": ""}
    if update:
        await tdb.users.update_one({"_id": user["_id"]}, update)
    if changes.get("status") == "Inactive":
        await revoke_all_sessions(db, "user", user["email"])
    return await _public(tdb, await tdb.users.find_one({"_id": user["_id"]}))


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, body: PasswordReset, actor: dict = Depends(require_clinic_admin),
                         tdb: TenantDB = Depends(get_tenant)):
    user = await _target(tdb, user_id, actor)
    settings = await clinic_settings(tdb)
    check_password_strength(body.new_password, bool(settings.get("strongPassword", True)))
    await tdb.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": now_iso()}},
    )
    await revoke_all_sessions(db, "user", user["email"])
    return {"ok": True}

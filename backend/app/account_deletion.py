"""Soft deletion of app logins ("Delete my account" in the three mobile apps) and restore by a Super Admin.

A deleted login stops working at once: its sessions, fingerprint sign-ins and push tokens are ended, and its
mobile number and email are moved aside (kept in `deleted_mobile` / `deleted_email`) so it is found by no login,
list or lookup and the number or email can be used for a new account. Nothing else is removed: the clinic keeps
its patient records, appointments and bills, and the login itself is kept, so a Super Admin can restore it
(console: Deleted accounts). There is no automatic wipe. See docs/ACCOUNT_DELETION.md.
"""
from bson import ObjectId
from fastapi import HTTPException

from .auth import SUPER_ADMIN_ROLE
from .roles import CLINIC_ADMIN_ROLES
from .sessions import revoke_all_sessions
from .util import now_iso

DELETED = "Deleted"
# Staff whose status is one of these get no login, no list entry and no email.
NOT_ACTIVE = ["Inactive", DELETED]


def _placeholder_mobile(account_id) -> str:
    return f"deleted:{account_id}"


def _placeholder_email(user_id) -> str:
    return f"deleted+{user_id}@deleted.invalid"


async def soft_delete_patient(db, account: dict) -> None:
    account_id = str(account["_id"])
    await revoke_all_sessions(db, "patient", account_id)
    await db.device_credentials.update_many({"kind": "patient", "subject": account_id}, {"$set": {"revoked": True}})
    await db.device_tokens.delete_many({"owner_kind": "patient", "owner_id": account_id})
    changes = {"status": DELETED, "deleted_at": now_iso(), "deleted_mobile": account.get("mobile", ""),
               "mobile": _placeholder_mobile(account_id), "updated_at": now_iso()}
    update = {"$set": changes}
    if account.get("email"):
        changes["deleted_email"] = account["email"]
        update["$unset"] = {"email": ""}
    await db.patient_accounts.update_one({"_id": account["_id"]}, update)


async def soft_delete_staff(db, user: dict) -> None:
    """Refused for a Super Admin and for the last active administrator of a clinic (the clinic would be left
    without anyone who can manage it)."""
    if user.get("role") == SUPER_ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="A Super Admin login cannot be deleted from the apps.")
    if user.get("role") in CLINIC_ADMIN_ROLES and user.get("clinic_id"):
        others = await db.users.count_documents({
            "clinic_id": user["clinic_id"], "role": {"$in": list(CLINIC_ADMIN_ROLES)},
            "status": {"$nin": NOT_ACTIVE}, "_id": {"$ne": user["_id"]},
        })
        if not others:
            raise HTTPException(
                status_code=409,
                detail="You are the only administrator of this clinic. Add another administrator first, "
                       "or ask Dentor support to close the clinic.",
            )
    email = user["email"]
    await revoke_all_sessions(db, "user", email)
    await db.device_credentials.update_many({"kind": "user", "subject": email}, {"$set": {"revoked": True}})
    await db.device_tokens.delete_many({"owner_kind": "user", "owner_id": email})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "status": DELETED, "deleted_at": now_iso(), "deleted_email": email,
        "email": _placeholder_email(user["_id"]), "updated_at": now_iso(),
    }})


async def list_deleted(db) -> dict:
    patients = [{
        "kind": "patient", "id": str(a["_id"]), "name": a.get("name", ""), "mobile": a.get("deleted_mobile", ""),
        "email": a.get("deleted_email", ""), "deleted_at": a.get("deleted_at", ""), "test_account": bool(a.get("test_account")),
    } async for a in db.patient_accounts.find({"status": DELETED}).sort("deleted_at", -1)]
    clinic_names = {str(c["_id"]): c.get("name", "") async for c in db.clinics.find({}, {"name": 1})}
    staff = [{
        "kind": "staff", "id": str(u["_id"]), "name": u.get("name", ""), "email": u.get("deleted_email", ""),
        "role": u.get("role", ""), "clinic": clinic_names.get(str(u.get("clinic_id", "")), ""), "deleted_at": u.get("deleted_at", ""),
    } async for u in db.users.find({"status": DELETED}).sort("deleted_at", -1)]
    return {"patients": patients, "staff": staff}


async def restore(db, kind: str, account_id: str) -> None:
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=404, detail="Deleted account not found.")
    oid = ObjectId(account_id)
    if kind == "patient":
        account = await db.patient_accounts.find_one({"_id": oid, "status": DELETED})
        if not account:
            raise HTTPException(status_code=404, detail="Deleted account not found.")
        mobile, email = account.get("deleted_mobile", ""), account.get("deleted_email")
        if await db.patient_accounts.find_one({"mobile": mobile}):
            raise HTTPException(status_code=409, detail="A new account now uses this mobile number, so this one cannot be restored.")
        if email and await db.patient_accounts.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="A new account now uses this email, so this one cannot be restored.")
        changes = {"status": "Active", "mobile": mobile, "restored_at": now_iso(), "updated_at": now_iso()}
        if email:
            changes["email"] = email
        await db.patient_accounts.update_one({"_id": oid}, {"$set": changes, "$unset": {"deleted_mobile": "", "deleted_email": "", "deleted_at": ""}})
    elif kind == "staff":
        user = await db.users.find_one({"_id": oid, "status": DELETED})
        if not user:
            raise HTTPException(status_code=404, detail="Deleted account not found.")
        email = user.get("deleted_email", "")
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="A new login now uses this email, so this one cannot be restored.")
        if user.get("consultant_id") and await db.users.find_one({
            "clinic_id": user.get("clinic_id"), "consultant_id": user["consultant_id"], "status": {"$ne": DELETED}, "_id": {"$ne": oid},
        }):
            raise HTTPException(status_code=409, detail="A new login now belongs to this consultant, so this one cannot be restored.")
        await db.users.update_one({"_id": oid}, {"$set": {"status": "Active", "email": email, "restored_at": now_iso(), "updated_at": now_iso()},
                                                  "$unset": {"deleted_email": "", "deleted_at": ""}})
    else:
        raise HTTPException(status_code=404, detail="Deleted account not found.")

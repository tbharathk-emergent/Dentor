"""Idempotent startup setup for multi-tenancy.

Makes sure the demo clinic and the super admin exist, and moves data created before
tenancy (no `clinic_id`) into the demo clinic. Safe to run on every start.
"""
from .auth import SUPER_ADMIN_ROLE, hash_password
from .config import SUPER_ADMIN_DEFAULT_PASSWORD, SUPER_ADMIN_EMAIL
from .util import now_iso


async def ensure_tenancy(db, tenant_collections: list[str]) -> str:
    """Returns the demo clinic's id."""
    clinic_id = await _ensure_demo_clinic(db)
    unscoped = {"clinic_id": {"$exists": False}}

    for name in [*tenant_collections, "activities"]:
        await db[name].update_many(unscoped, {"$set": {"clinic_id": clinic_id}})
    await db.users.update_many({**unscoped, "role": {"$ne": SUPER_ADMIN_ROLE}}, {"$set": {"clinic_id": clinic_id}})

    # Counters and settings used to be keyed by a fixed string _id; they are now per clinic.
    async for doc in db.counters.find(unscoped):
        await db.counters.insert_one({"clinic_id": clinic_id, "name": doc["_id"], "seq": doc["seq"], "start": doc.get("start")})
        await db.counters.delete_one({"_id": doc["_id"]})
    async for doc in db.app_settings.find(unscoped):
        key = doc.pop("_id")
        await db.app_settings.insert_one({**doc, "clinic_id": clinic_id, "key": key})
        await db.app_settings.delete_one({"_id": key})

    await db.counters.create_index([("clinic_id", 1), ("name", 1)], unique=True)
    await db.app_settings.create_index([("clinic_id", 1), ("key", 1)], unique=True)
    await db.users.create_index("email", unique=True)
    for name in [*tenant_collections, "activities", "users"]:
        await db[name].create_index("clinic_id")

    if not await db.users.find_one({"role": SUPER_ADMIN_ROLE}):
        now = now_iso()
        await db.users.insert_one({
            "name": "Platform Admin", "email": SUPER_ADMIN_EMAIL, "role": SUPER_ADMIN_ROLE,
            "password_hash": hash_password(SUPER_ADMIN_DEFAULT_PASSWORD), "status": "Active",
            "created_at": now, "updated_at": now, "created_by": "seed",
        })
    return clinic_id


async def _ensure_demo_clinic(db) -> str:
    clinic = await db.clinics.find_one({"is_demo": True})
    if clinic:
        return str(clinic["_id"])
    legacy = await db.app_settings.find_one({"_id": "settings"})
    values = (legacy or {}).get("values", {})
    now = now_iso()
    result = await db.clinics.insert_one({
        "code": "CL-001",
        "name": values.get("clinicName", "DENTOR Dental Clinic"),
        "city": "Manaparai",
        "phone": values.get("phone", "+91 73392 99339"),
        "email": values.get("email", "admin@dentor.in"),
        "address": values.get("address", "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306"),
        "plan": "Standard", "status": "Active", "is_demo": True,
        "created_at": now, "updated_at": now, "created_by": "seed",
    })
    await db.counters.insert_one({"clinic_id": "platform", "name": "clinics", "seq": 1, "start": 1})
    return str(result.inserted_id)

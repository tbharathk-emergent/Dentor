"""Idempotent startup setup for multi-tenancy.

Creates indexes and the platform super admin on every start. The demo clinic is only
created when demo seeding is enabled — or when pre-tenancy data (no `clinic_id`) exists
and needs a clinic to live in, so a restored old database is never silently hidden.
Safe to run on every start.
"""
import logging

from pymongo.errors import DuplicateKeyError

from .auth import SUPER_ADMIN_ROLE, hash_password, verify_password
from .config import IS_PROD, NOTIFICATION_RETENTION_DAYS, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, _DEV_SUPER_ADMIN_PASSWORD, super_admin_bootstrap_password
from .tenancy import TenantDB
from .util import next_sequence, now_iso

log = logging.getLogger("dentor")


async def ensure_tenancy(db, tenant_collections: list[str], create_demo: bool = True) -> str | None:
    """Returns the demo clinic's id, or None when no demo clinic exists."""
    unscoped = {"clinic_id": {"$exists": False}}

    demo = await db.clinics.find_one({"is_demo": True})
    has_unscoped = bool(
        await db.patients.find_one(unscoped)
        or await db.users.find_one({**unscoped, "role": {"$ne": SUPER_ADMIN_ROLE}})
    )
    clinic_id: str | None = str(demo["_id"]) if demo else None
    if clinic_id is None and (create_demo or has_unscoped):
        clinic_id = await _create_demo_clinic(db)

    if clinic_id is not None:
        for name in [*tenant_collections, "activities"]:
            await db[name].update_many(unscoped, {"$set": {"clinic_id": clinic_id}})
        await db.users.update_many(
            {**unscoped, "role": {"$ne": SUPER_ADMIN_ROLE}}, {"$set": {"clinic_id": clinic_id}}
        )
        # Counters and settings used to be keyed by a fixed string _id; they are now per clinic.
        async for doc in db.counters.find(unscoped):
            await db.counters.insert_one(
                {"clinic_id": clinic_id, "name": doc["_id"], "seq": doc["seq"], "start": doc.get("start")}
            )
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

    await _ensure_app_indexes(db)
    await _ensure_super_admin(db)
    return clinic_id


async def _ensure_app_indexes(db) -> None:
    """Collections behind the mobile apps: patient accounts, sessions, OTPs, notifications."""
    await db.patient_accounts.create_index("mobile", unique=True)
    await db.patient_accounts.create_index(
        "email", unique=True, partialFilterExpression={"email": {"$type": "string"}}
    )
    await db.refresh_tokens.create_index("token_hash", unique=True)
    await db.refresh_tokens.create_index([("kind", 1), ("subject", 1)])
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.refresh_tokens.create_index("family")
    # Signed-out sessions, kept only until their last access token would have expired.
    await db.ended_sessions.create_index("expires_at", expireAfterSeconds=0)
    # Kept for two hours so the hourly send limit can count them; codes themselves expire in minutes.
    await db.otp_codes.create_index("created_at", expireAfterSeconds=7200)
    await db.otp_codes.create_index([("mobile", 1), ("purpose", 1), ("created_at", -1)])
    await db.email_codes.create_index("created_at", expireAfterSeconds=7200)
    await db.email_codes.create_index([("email", 1), ("purpose", 1), ("created_at", -1)])
    await db.signup_applications.create_index([("email", 1), ("created_at", -1)])
    await db.signup_applications.create_index("status")
    await db.device_credentials.create_index([("kind", 1), ("device_id", 1)])
    await db.device_credentials.create_index([("kind", 1), ("subject", 1)])
    await db.device_tokens.create_index("token", unique=True)
    await db.device_tokens.create_index([("owner_kind", 1), ("owner_id", 1)])
    await db.notifications.create_index([("clinic_id", 1), ("to_kind", 1), ("to_id", 1), ("created_at", -1)])
    # Retention: MongoDB deletes a notification once its `expires_at` has passed.
    await db.notifications.create_index("expires_at", expireAfterSeconds=0)
    if NOTIFICATION_RETENTION_DAYS > 0:
        # Notifications written before the retention rule existed get their date from `created_at`.
        await db.notifications.update_many(
            {"expires_at": {"$exists": False}},
            [{"$set": {"expires_at": {"$dateAdd": {
                "startDate": {"$dateFromString": {"dateString": "$created_at", "onError": "$$NOW", "onNull": "$$NOW"}},
                "unit": "day", "amount": NOTIFICATION_RETENTION_DAYS,
            }}}}],
        )


async def _ensure_super_admin(db) -> None:
    existing = await db.users.find_one({"role": SUPER_ADMIN_ROLE})
    if not existing:
        now = now_iso()
        try:
            await db.users.insert_one({
                "name": "Platform Admin", "email": SUPER_ADMIN_EMAIL, "role": SUPER_ADMIN_ROLE,
                "password_hash": hash_password(super_admin_bootstrap_password()), "status": "Active",
                "created_at": now, "updated_at": now, "created_by": "seed",
            })
        except DuplicateKeyError:
            pass  # another uvicorn worker created it in the same instant — fine
        return

    # A default password must never survive into production, even on an upgraded database.
    if IS_PROD and verify_password(_DEV_SUPER_ADMIN_PASSWORD, existing.get("password_hash", "")):
        if SUPER_ADMIN_PASSWORD and SUPER_ADMIN_PASSWORD != _DEV_SUPER_ADMIN_PASSWORD:
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"password_hash": hash_password(SUPER_ADMIN_PASSWORD), "updated_at": now_iso()}},
            )
            log.warning("Super admin was on the default password; rotated to SUPER_ADMIN_PASSWORD from the environment.")
        else:
            raise RuntimeError(
                "The platform super admin still uses the default development password. "
                "Set SUPER_ADMIN_PASSWORD in the environment to a strong value DIFFERENT from "
                "the development default — it will then be rotated automatically at startup."
            )


async def _create_demo_clinic(db) -> str:
    legacy = await db.app_settings.find_one({"_id": "settings"})
    values = (legacy or {}).get("values", {})
    now = now_iso()
    # Take the next code from the same per-platform sequence the console uses,
    # so the demo clinic can never collide with an existing production clinic.
    code = await next_sequence(TenantDB(db, "platform"), "clinics", "CL-", 1, width=3)
    result = await db.clinics.insert_one({
        "code": code,
        "name": values.get("clinicName", "DENTOR Dental Clinic"),
        "city": "Manaparai",
        "phone": values.get("phone", "+91 73392 99339"),
        "email": values.get("email", "admin@dentor.in"),
        "address": values.get("address", "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306"),
        "plan": "Standard", "status": "Active", "is_demo": True,
        "created_at": now, "updated_at": now, "created_by": "seed",
    })
    return str(result.inserted_id)

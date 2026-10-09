"""Explicit, one-time demo-clinic seeding — the ONLY way demo data reaches production.

Usage (from backend/, venv active):

    python -m app.seed_demo                      # dry run: shows the plan, writes nothing
    python -m app.seed_demo --yes --admin-password '<strong unique password>'

Safeguards:
- Writes only inside the demo clinic's tenant scope (TenantDB stamps clinic_id on every insert).
- Insert-only and idempotent: collections already containing demo-clinic records are skipped,
  so re-running adds nothing and never overwrites or deletes.
- Normal service startup never calls this in production (SEED_DEMO=0).
- In production the clinic-admin password is REQUIRED, strength-checked, and must not be the
  publicly documented demo default.
- Prints a per-collection report and verifies that records of every other clinic are untouched.
"""
import argparse
import asyncio
import sys

from .auth import hash_password, verify_password
from .config import ADMIN_DEFAULT_PASSWORD, ADMIN_EMAIL, IS_PROD
from .db import db
from .main import RESOURCES
from .migrate import ensure_tenancy
from .rules import check_password_strength
from .seed import ensure_seed
from .tenancy import TenantDB

COLLECTIONS = [name for name, _, _ in RESOURCES] + ["users"]


async def _counts(clinic_id: str | None) -> dict[str, int]:
    out = {}
    for name in COLLECTIONS:
        query = {"clinic_id": clinic_id} if clinic_id else {"clinic_id": {"$ne": None}}
        out[name] = await db[name].count_documents(query)
    return out


async def _other_clinics_total(demo_id: str | None) -> int:
    total = 0
    for name in COLLECTIONS:
        total += await db[name].count_documents({"clinic_id": {"$nin": [demo_id, None, "platform"]}})
    return total


async def run(assume_yes: bool, admin_password: str | None) -> int:
    if IS_PROD:
        if not admin_password:
            print("ERROR: production seeding requires --admin-password (a unique value —")
            print(f"       the documented demo password {ADMIN_DEFAULT_PASSWORD!r} is public).")
            return 2
        if admin_password == ADMIN_DEFAULT_PASSWORD:
            print(f"ERROR: {ADMIN_DEFAULT_PASSWORD!r} is publicly documented — choose a different password.")
            return 2
    if admin_password:
        try:
            check_password_strength(admin_password, strong=True)
        except Exception as e:  # HTTPException from rules
            print(f"ERROR: weak admin password — {getattr(e, 'detail', e)}")
            return 2

    existing_demo = await db.clinics.find_one({"is_demo": True})
    demo_id = str(existing_demo["_id"]) if existing_demo else None
    before = await _counts(demo_id) if demo_id else {name: 0 for name in COLLECTIONS}
    others_before = await _other_clinics_total(demo_id)

    print(f"Mode: {'PRODUCTION' if IS_PROD else 'development'}")
    print(f"Demo clinic: {'exists (' + existing_demo['code'] + ')' if existing_demo else 'will be created with the next free CL- code'}")
    print(f"Collections already populated for the demo clinic: {sum(1 for v in before.values() if v)} / {len(COLLECTIONS)}")
    if not assume_yes:
        print("\nDry run only — nothing written. Re-run with --yes to execute.")
        return 0

    demo_id = await ensure_tenancy(db, [n for n, _, _ in RESOURCES], create_demo=True)
    tdb = TenantDB(db, demo_id)
    await ensure_seed(tdb)

    if admin_password:
        result = await tdb.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        if result.matched_count != 1:
            print("ERROR: demo clinic admin not found after seeding — aborting verification.")
            return 1

    # ---- report ----
    after = await _counts(demo_id)
    clinic = await db.clinics.find_one({"is_demo": True})
    print(f"\nDemo clinic: {clinic['name']}  code={clinic['code']}  id={demo_id}")
    print(f"{'collection':<22}{'before':>8}{'after':>8}{'added':>8}")
    for name in COLLECTIONS:
        if after[name] or before[name]:
            print(f"{name:<22}{before[name]:>8}{after[name]:>8}{after[name] - before[name]:>8}")

    # ---- verification ----
    ok = True
    others_after = await _other_clinics_total(demo_id)
    if others_after != others_before:
        ok = False
        print(f"FAIL: other clinics' record count changed ({others_before} -> {others_after})")
    else:
        print(f"OK: other clinics untouched ({others_before} records before and after)")
    admin = await tdb.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        ok = False
        print("FAIL: clinic admin account missing")
    else:
        expected = admin_password or ADMIN_DEFAULT_PASSWORD
        if verify_password(expected, admin.get("password_hash", "")):
            print(f"OK: clinic admin {ADMIN_EMAIL} (user id 'admin') logs in with the "
                  f"{'provided password' if admin_password else 'documented demo password'}")
        else:
            ok = False
            print("FAIL: clinic admin password did not verify")
    print("\nRESULT:", "SUCCESS" if ok else "FAILED")
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the demo clinic explicitly.")
    parser.add_argument("--yes", action="store_true", help="actually write (otherwise dry run)")
    parser.add_argument("--admin-password", default=None,
                        help="unique password for admin@dentor.in (required in production)")
    args = parser.parse_args()
    sys.exit(asyncio.run(run(args.yes, args.admin_password)))


if __name__ == "__main__":
    main()

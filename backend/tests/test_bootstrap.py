"""Regression tests: super-admin bootstrap safety, demo-clinic code uniqueness,
seed idempotency, and the explicit production seeding command."""
import pytest
import pytest_asyncio

import app.config as config
import app.migrate as migrate
import app.seed_demo as seed_demo
from app.auth import hash_password, verify_password
from app.db import client
from app.main import RESOURCES
from app.migrate import ensure_tenancy
from app.seed import ensure_seed
from app.tenancy import TenantDB
from app.util import next_sequence

COLS = [n for n, _, _ in RESOURCES]
DEFAULT = "SuperAdmin@2026"


@pytest_asyncio.fixture()
async def scratch():
    name = "dentor_test_scratch"
    await client.drop_database(name)
    yield client[name]
    await client.drop_database(name)


def _prod(monkeypatch, env_password: str):
    """Simulate production config for both modules that read it at import time."""
    for mod in (config, migrate):
        monkeypatch.setattr(mod, "IS_PROD", True)
        monkeypatch.setattr(mod, "SUPER_ADMIN_PASSWORD", env_password)


# ------------------------------------------------ bootstrap / restart guards

async def test_prod_fresh_bootstrap_refuses_default_password(scratch, monkeypatch):
    _prod(monkeypatch, DEFAULT)
    with pytest.raises(RuntimeError, match="development default"):
        await ensure_tenancy(scratch, COLS, create_demo=False)
    assert await scratch.users.count_documents({}) == 0  # nothing half-created


async def test_prod_fresh_bootstrap_refuses_missing_password(scratch, monkeypatch):
    _prod(monkeypatch, "")
    with pytest.raises(RuntimeError, match="not set"):
        await ensure_tenancy(scratch, COLS, create_demo=False)


async def test_prod_restart_with_default_hash_and_default_env_raises(scratch, monkeypatch):
    await scratch.users.insert_one(
        {"role": "Super Admin", "email": "superadmin@dentor.in",
         "password_hash": hash_password(DEFAULT), "status": "Active"}
    )
    _prod(monkeypatch, DEFAULT)
    with pytest.raises(RuntimeError, match="DIFFERENT from"):
        await ensure_tenancy(scratch, COLS, create_demo=False)


async def test_prod_rotates_default_hash_to_strong_env_value(scratch, monkeypatch):
    await scratch.users.insert_one(
        {"role": "Super Admin", "email": "superadmin@dentor.in",
         "password_hash": hash_password(DEFAULT), "status": "Active"}
    )
    _prod(monkeypatch, "Rotated#2026x")
    assert await ensure_tenancy(scratch, COLS, create_demo=False) is None
    doc = await scratch.users.find_one({"role": "Super Admin"})
    assert verify_password("Rotated#2026x", doc["password_hash"])


async def test_prod_never_overwrites_nondefault_password(scratch, monkeypatch):
    await scratch.users.insert_one(
        {"role": "Super Admin", "email": "superadmin@dentor.in",
         "password_hash": hash_password("MyReal#Secret9"), "status": "Active"}
    )
    _prod(monkeypatch, "SomethingElse#1")
    await ensure_tenancy(scratch, COLS, create_demo=False)
    doc = await scratch.users.find_one({"role": "Super Admin"})
    assert verify_password("MyReal#Secret9", doc["password_hash"])  # untouched


async def test_dev_bootstrap_unaffected(scratch):
    # conftest environment is development with no SUPER_ADMIN_PASSWORD override.
    await ensure_tenancy(scratch, COLS, create_demo=False)
    doc = await scratch.users.find_one({"role": "Super Admin"})
    assert doc and verify_password(DEFAULT, doc["password_hash"])


# ------------------------------------------------ demo clinic code uniqueness

async def test_demo_clinic_gets_next_free_code(scratch):
    # A console-created clinic consumed CL-001 first.
    code = await next_sequence(TenantDB(scratch, "platform"), "clinics", "CL-", 1, width=3)
    assert code == "CL-001"
    await scratch.clinics.insert_one({"code": code, "name": "Real Clinic", "status": "Active"})

    demo_id = await ensure_tenancy(scratch, COLS, create_demo=True)
    demo = await scratch.clinics.find_one({"is_demo": True})
    assert demo_id and demo["code"] == "CL-002"
    codes = [c["code"] async for c in scratch.clinics.find({})]
    assert len(codes) == len(set(codes))  # all unique
    # and a clinic created through the console AFTERWARDS continues the sequence
    assert await next_sequence(TenantDB(scratch, "platform"), "clinics", "CL-", 1, width=3) == "CL-003"


async def test_demo_clinic_on_fresh_db_is_cl001(scratch):
    await ensure_tenancy(scratch, COLS, create_demo=True)
    demo = await scratch.clinics.find_one({"is_demo": True})
    assert demo["code"] == "CL-001"


# ------------------------------------------------ seed idempotency & isolation

async def test_seed_is_idempotent_and_tenant_scoped(scratch):
    demo_id = await ensure_tenancy(scratch, COLS, create_demo=True)
    tdb = TenantDB(scratch, demo_id)
    await ensure_seed(tdb)
    first = {n: await scratch[n].count_documents({}) for n in COLS}
    assert first["patients"] > 0 and first["invoices"] > 0
    await ensure_seed(tdb)  # second run must add nothing
    second = {n: await scratch[n].count_documents({}) for n in COLS}
    assert first == second
    # every seeded record is stamped with the demo clinic
    for name in COLS:
        assert await scratch[name].count_documents({"clinic_id": {"$ne": demo_id}}) == 0


# ------------------------------------------------ explicit seeding command

async def test_seed_demo_production_guards_and_success(scratch, monkeypatch):
    monkeypatch.setattr(seed_demo, "db", scratch)
    monkeypatch.setattr(seed_demo, "IS_PROD", True)

    assert await seed_demo.run(assume_yes=True, admin_password=None) == 2       # password required
    assert await seed_demo.run(assume_yes=True, admin_password="Dentor@2026") == 2  # public default refused
    assert await seed_demo.run(assume_yes=True, admin_password="weakweakweak") == 2  # strength enforced
    assert await scratch.clinics.count_documents({}) == 0  # guards wrote nothing

    assert await seed_demo.run(assume_yes=True, admin_password="Unique#Demo77") == 0
    admin = await scratch.users.find_one({"email": "admin@dentor.in"})
    assert admin and verify_password("Unique#Demo77", admin["password_hash"])
    # repeatable: second run is a no-op success
    patients = await scratch.patients.count_documents({})
    assert await seed_demo.run(assume_yes=True, admin_password="Unique#Demo77") == 0
    assert await scratch.patients.count_documents({}) == patients


async def test_seed_demo_dry_run_writes_nothing(scratch, monkeypatch):
    monkeypatch.setattr(seed_demo, "db", scratch)
    assert await seed_demo.run(assume_yes=False, admin_password=None) == 0
    assert await scratch.clinics.count_documents({}) == 0

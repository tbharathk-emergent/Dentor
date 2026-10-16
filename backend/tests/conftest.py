"""Test harness: isolated database, app booted the same way the lifespan does."""
import os
import re

# Must be set before any app module is imported.
os.environ["DB_NAME"] = "dentor_test"
os.environ["DENTOR_ENV"] = "development"
os.environ.setdefault("SEED_DEMO", "1")

import pytest
import pytest_asyncio

from app import config as _config  # reads backend/.env exactly as the running app does

_THIS_MACHINE = {"127.0.0.1", "localhost", "::1"}


def is_local_mongo(url: str) -> bool:
    """True only when every host in the connection string is this machine."""
    if not url.startswith("mongodb://"):  # mongodb+srv:// is always a remote cluster
        return False
    hosts = re.sub(r"^mongodb://([^@/]*@)?", "", url).split("/")[0].split("?")[0]
    return bool(hosts) and all(h.rsplit(":", 1)[0].strip("[]") in _THIS_MACHINE for h in hosts.split(","))


# The suite creates, fills and DROPS a database. It must never do that on a server that holds
# real data, whatever MONGO_URL the shell or a deployed backend/.env happens to carry.
if not is_local_mongo(_config.MONGO_URL) or _config.DB_NAME != "dentor_test" or _config.IS_PROD:
    pytest.exit(
        "Refusing to run the tests: they create and drop the 'dentor_test' database, and MONGO_URL does "
        "not point at a MongoDB on this machine (or the environment is production). "
        "Run them with MONGO_URL=mongodb://127.0.0.1:27017.",
        returncode=2,
    )
from httpx import ASGITransport, AsyncClient

from app import security
from app.db import client as mongo_client, db
from app.main import RESOURCES, app
from app.migrate import ensure_tenancy
from app.seed import ensure_seed
from app.tenancy import TenantDB


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepared_db():
    await mongo_client.drop_database("dentor_test")
    demo_id = await ensure_tenancy(db, [name for name, _, _ in RESOURCES], create_demo=True)
    await ensure_seed(TenantDB(db, demo_id))
    yield demo_id
    await mongo_client.drop_database("dentor_test")


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Each test starts with clean limiter windows so tests don't throttle each other."""
    security._WINDOWS.clear()
    yield
    security._WINDOWS.clear()


@pytest_asyncio.fixture()
async def http():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(http, email="admin@dentor.in", password="Dentor@2026") -> dict:
    res = await http.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    data = res.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest_asyncio.fixture()
async def admin_headers(http):
    return await login(http)


@pytest_asyncio.fixture()
async def super_headers(http):
    return await login(http, "superadmin@dentor.in", "SuperAdmin@2026")

"""Backend regression suite: auth hardening, settings enforcement, tenancy isolation."""
from datetime import date, timedelta

import pytest

from app.db import db
from app.migrate import ensure_tenancy
from tests.conftest import login


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


async def put_settings(http, headers, patch: dict):
    current = (await http.get("/api/settings", headers=headers)).json()
    res = await http.put("/api/settings", headers=headers, json={"values": {**current, **patch}})
    assert res.status_code == 200, res.text


# ------------------------------------------------------------------ auth

async def test_login_ok_and_wrong_password(http):
    assert (await http.post("/api/auth/login", json={"email": "admin@dentor.in", "password": "nope"})).status_code == 401
    await login(http)


async def test_login_lockout_after_failures(http):
    for _ in range(5):
        res = await http.post("/api/auth/login", json={"email": "ghost@x.in", "password": "bad"})
        assert res.status_code == 401
    res = await http.post("/api/auth/login", json={"email": "ghost@x.in", "password": "bad"})
    assert res.status_code == 429
    assert "Retry-After" in res.headers
    # a different account from the same IP is NOT locked out
    await login(http)


async def test_auth_burst_rate_limit(http):
    last = None
    for _ in range(31):
        last = await http.post("/api/auth/login", json={"email": "admin@dentor.in", "password": "Dentor@2026"})
    assert last.status_code == 429


async def test_verify_password_endpoint(http, admin_headers):
    ok = await http.post("/api/auth/verify-password", headers=admin_headers, json={"password": "Dentor@2026"})
    assert ok.status_code == 200 and ok.json()["ok"] is True
    bad = await http.post("/api/auth/verify-password", headers=admin_headers, json={"password": "wrong"})
    assert bad.status_code == 401


async def test_change_password_strength_enforced(http, admin_headers):
    res = await http.post(
        "/api/auth/change-password",
        headers=admin_headers,
        json={"current_password": "Dentor@2026", "new_password": "weakweak"},
    )
    assert res.status_code == 400
    assert "Strong passwords" in res.json()["detail"]


# ------------------------------------------------------- settings enforcement

async def test_double_booking_blocked_then_allowed(http, admin_headers):
    await put_settings(http, admin_headers, {"doubleBooking": False})
    slot = {"date": day(30), "time": "11:00", "doctor": "Dr. Kumar", "chair": "Chair 01",
            "patient": "Iso One", "treatment": "Checkup", "status": "Scheduled"}
    first = await http.post("/api/appointments", headers=admin_headers, json=slot)
    assert first.status_code == 201, first.text
    clash = await http.post("/api/appointments", headers=admin_headers,
                            json={**slot, "patient": "Iso Two", "chair": "Chair 02"})
    assert clash.status_code == 409
    assert "Double booking blocked" in clash.json()["detail"]
    # also blocked via PATCH (moving another appointment onto the taken slot)
    other = await http.post("/api/appointments", headers=admin_headers,
                            json={**slot, "time": "12:00", "patient": "Iso Three"})
    moved = await http.patch(f"/api/appointments/{other.json()['id']}", headers=admin_headers,
                             json={"time": "11:00"})
    assert moved.status_code == 409
    # flipping the setting opens the slot
    await put_settings(http, admin_headers, {"doubleBooking": True})
    allowed = await http.post("/api/appointments", headers=admin_headers,
                              json={**slot, "patient": "Iso Four", "chair": "Chair 03"})
    assert allowed.status_code == 201
    await put_settings(http, admin_headers, {"doubleBooking": False})


async def test_partial_payments_toggle(http, admin_headers):
    inv = await http.post("/api/invoices", headers=admin_headers, json={
        "date": day(0), "patient": "Pay Tester", "patientCode": "DEN-PAY",
        "treatment": "Crown", "total": 1000, "paid": 0, "balance": 1000, "status": "Pending",
    })
    assert inv.status_code == 201, inv.text
    inv_id = inv.json()["id"]
    await put_settings(http, admin_headers, {"partialPayments": False})
    partial = await http.post("/api/payments/record", headers=admin_headers, json={
        "invoice_id": inv_id, "patient": "Pay Tester", "amount": 400, "mode": "Cash", "date": day(0),
    })
    assert partial.status_code == 400
    assert "Partial payments are disabled" in partial.json()["detail"]
    full = await http.post("/api/payments/record", headers=admin_headers, json={
        "invoice_id": inv_id, "patient": "Pay Tester", "amount": 1000, "mode": "Cash", "date": day(0),
    })
    assert full.status_code == 201
    await put_settings(http, admin_headers, {"partialPayments": True})


async def test_consent_required_for_treatments(http, admin_headers):
    await put_settings(http, admin_headers, {"consentRequired": True})
    blocked = await http.post("/api/patient_treatments", headers=admin_headers, json={
        "patientId": "DEN-1004", "name": "Implant Placement", "doctor": "Dr. Gowtham", "status": "Planned",
    })
    assert blocked.status_code == 400
    assert "signed consent" in blocked.json()["detail"]
    consent = await http.post("/api/patient_consents", headers=admin_headers, json={
        "patientId": "DEN-1004", "title": "Implant Surgery Consent", "status": "Signed", "date": day(0),
    })
    assert consent.status_code == 201
    ok = await http.post("/api/patient_treatments", headers=admin_headers, json={
        "patientId": "DEN-1004", "name": "Implant Placement", "doctor": "Dr. Gowtham", "status": "Planned",
    })
    assert ok.status_code == 201


async def test_financial_lock_flag_in_dashboard(http, admin_headers):
    await put_settings(http, admin_headers, {"financialLock": True})
    data = (await http.get(f"/api/dashboard?date={day(0)}", headers=admin_headers)).json()
    assert data["financialLock"] is True
    await put_settings(http, admin_headers, {"financialLock": False})


async def test_session_timeout_setting_shortens_token(http, admin_headers):
    from jose import jwt as jose_jwt
    import time
    from app.config import JWT_SECRET

    await put_settings(http, admin_headers, {"sessionTimeout": True})
    res = await http.post("/api/auth/login", json={"email": "admin@dentor.in", "password": "Dentor@2026"})
    claims = jose_jwt.decode(res.json()["access_token"], JWT_SECRET, algorithms=["HS256"])
    minutes_left = (claims["exp"] - time.time()) / 60
    assert 25 < minutes_left <= 31  # 30-minute session, not the 12-hour default
    await put_settings(http, admin_headers, {"sessionTimeout": False})


# ---------------------------------------------------------------- tenancy

async def test_super_admin_needs_clinic_header(http, super_headers):
    res = await http.get("/api/patients", headers=super_headers)
    assert res.status_code == 400
    assert "Select a clinic" in res.json()["detail"]


async def test_cross_clinic_isolation(http, admin_headers, super_headers):
    created = await http.post("/api/platform/clinics", headers=super_headers, json={
        "name": "Isolation Clinic", "city": "Testville",
        "admin_name": "Iso Admin", "admin_email": "iso@test.in", "admin_password": "IsoAdmin@2026",
    })
    assert created.status_code in (200, 201), created.text
    clinic_id = created.json().get("id") or created.json().get("clinic", {}).get("id")
    assert clinic_id

    scoped = {**super_headers, "X-Clinic-Id": clinic_id}
    p = await http.post("/api/patients", headers=scoped, json={
        "name": "Secret Patient", "age": 30, "gender": "Male", "mobile": "9999999999",
    })
    assert p.status_code == 201
    secret_id = p.json()["id"]

    # demo-clinic admin cannot see it — not in lists, not by id, not via search
    listing = await http.get("/api/patients?q=Secret", headers=admin_headers)
    assert listing.json()["total"] == 0
    direct = await http.get(f"/api/patients/{secret_id}", headers=admin_headers)
    assert direct.status_code == 404
    search = await http.get("/api/search?q=Secret", headers=admin_headers)
    assert search.json()["results"] == []

    # the new clinic's own admin CAN see it, and sees none of the demo patients
    iso_headers = await login(http, "iso@test.in", "IsoAdmin@2026")
    mine = await http.get("/api/patients", headers=iso_headers)
    names = [x["name"] for x in mine.json()["items"]]
    assert "Secret Patient" in names and "Ravi Kumar" not in names


async def test_suspended_clinic_login_blocked(http, super_headers):
    created = await http.post("/api/platform/clinics", headers=super_headers, json={
        "name": "Suspend Clinic", "admin_name": "Sus Admin",
        "admin_email": "sus@test.in", "admin_password": "SusAdmin@2026",
    })
    clinic_id = created.json().get("id") or created.json().get("clinic", {}).get("id")
    await login(http, "sus@test.in", "SusAdmin@2026")  # works while active
    upd = await http.patch(f"/api/platform/clinics/{clinic_id}", headers=super_headers,
                           json={"status": "Suspended"})
    assert upd.status_code == 200, upd.text
    res = await http.post("/api/auth/login", json={"email": "sus@test.in", "password": "SusAdmin@2026"})
    assert res.status_code == 403
    assert "suspended" in res.json()["detail"].lower()


async def test_platform_requires_super_admin(http, admin_headers):
    res = await http.get("/api/platform/clinics", headers=admin_headers)
    assert res.status_code == 403


# ------------------------------------------------------------- seed gating

async def test_no_demo_clinic_without_seed_flag():
    from app.db import client
    test_db = client["dentor_test_noseed"]
    await client.drop_database("dentor_test_noseed")
    from app.main import RESOURCES
    demo_id = await ensure_tenancy(test_db, [n for n, _, _ in RESOURCES], create_demo=False)
    assert demo_id is None
    assert await test_db.clinics.count_documents({}) == 0
    assert await test_db.patients.count_documents({}) == 0
    # the super admin platform account still exists
    assert await test_db.users.count_documents({"role": "Super Admin"}) == 1
    await client.drop_database("dentor_test_noseed")


async def test_oversized_body_rejected(http, admin_headers):
    # The guard reads Content-Length, so an explicit oversized header is enough to test it.
    r = await http.post("/api/patients",
                        headers={**admin_headers, "Content-Length": str(99 * 1024 * 1024)})
    assert r.status_code == 413

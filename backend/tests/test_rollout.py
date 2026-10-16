"""Upgrading a live clinic database to this backend: what keeps working, what the
pre-deployment check reports, and what is cleaned up over time."""
from datetime import datetime, timedelta, timezone

from jose import jwt

from app import config, notify
from app.auth import create_access_token, hash_password
from app.db import db
from app.migrate import _ensure_app_indexes
from app.preflight import build_report, render
from tests.test_apps import ADMIN, OWNER, bearer, patient_login, staff_headers, staff_login


# ------------------------------------------------- sessions from before the upgrade

def _token_from_the_old_backend(email: str, role: str) -> str:
    """What the previous release issued: no issue time, no session id."""
    return jwt.encode(
        {"sub": email, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
        config.JWT_SECRET, algorithm=config.JWT_ALGORITHM,
    )


async def test_people_signed_in_before_the_upgrade_stay_signed_in(http):
    old = bearer(_token_from_the_old_backend(ADMIN[0], "Administrator"))
    assert (await http.get("/api/patients", headers=old)).status_code == 200
    assert (await http.get("/api/auth/me", headers=old)).status_code == 200
    # Their old web app signs out in the browser only; asking the new API to sign such a
    # token out is harmless and, having no session id, leaves it to expire as before.
    assert (await http.post("/api/auth/logout", headers=old, json={})).status_code == 200
    assert (await http.get("/api/patients", headers=old)).status_code == 200


async def test_a_password_reset_still_ends_a_session_from_before_the_upgrade(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Old Session", "email": "old.session@test.in", "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    old = bearer(_token_from_the_old_backend("old.session@test.in", "Receptionist"))
    assert (await http.get("/api/patients", headers=old)).status_code == 200
    reset = await http.post(f"/api/clinic/users/{made.json()['id']}/reset-password", headers=owner,
                            json={"new_password": "SecondPass#2026"})
    assert reset.status_code == 200
    assert (await http.get("/api/patients", headers=old)).status_code == 401


async def test_the_old_web_app_can_still_save_settings_the_old_way(http):
    """The committed web app sends the whole settings map with PUT; that must keep working."""
    admin = await staff_headers(http, ADMIN)
    before = (await http.get("/api/settings", headers=admin)).json()
    saved = await http.put("/api/settings", headers=admin, json={"values": {**before, "doubleBooking": not before.get("doubleBooking", False)}})
    assert saved.status_code == 200
    assert (await http.get("/api/settings", headers=admin)).json()["doubleBooking"] == (not before.get("doubleBooking", False))
    assert (await http.put("/api/settings", headers=admin, json={"values": before})).status_code == 200
    assert (await http.get("/api/settings", headers=admin)).json() == before


async def test_the_old_login_response_fields_are_all_still_there(http):
    """The committed web app reads access_token and user (id, name, email, role, clinic)."""
    data = await staff_login(http, ADMIN)
    assert data["token_type"] == "bearer" and data["access_token"]
    for field in ("id", "name", "email", "role", "clinic"):
        assert field in data["user"], field
    assert set(data["user"]["clinic"]) >= {"id", "name", "code"}
    assert "password_hash" not in data["user"]


# ------------------------------------------------------------ pre-deployment check

async def _clinic_with(http, super_headers, code: str, **first_login) -> str:
    made = await http.post("/api/platform/clinics", headers=super_headers, json={
        "name": f"Rollout {code}", "admin_name": "First Login", "admin_email": f"first@{code.lower()}.test",
        "admin_password": "FirstLogin#2026", **first_login})
    assert made.status_code == 201, made.text
    return made.json()["id"]


async def test_the_check_reads_only_and_describes_every_clinic(http, super_headers):
    counts_before = {name: await db[name].count_documents({}) for name in ("users", "clinics", "app_settings", "notifications")}
    report = await build_report(db)
    assert {name: await db[name].count_documents({}) for name in counts_before} == counts_before
    demo = next(c for c in report["clinics"] if c["name"] == "DENTOR Dental Clinic")
    assert demo["owners_or_administrators"] >= 2 and demo["owners"] >= 1
    assert demo["patient_app_booking"] is True
    assert demo["must_fix"] == []
    assert any("Consultant" in note for note in demo["to_know"])
    # development: the README passwords are a note, not a blocker
    assert not any("Demo logins" in item for item in report["platform"]["must_fix"])
    assert any("Demo logins" in item for item in report["platform"]["to_know"])
    text = render(report)
    assert "read-only" in text and "DENTOR Dental Clinic" in text
    assert "Dentor@2026" not in text and "password_hash" not in text


async def test_the_check_flags_a_clinic_nobody_could_administer(http, super_headers):
    clinic_id = await _clinic_with(http, super_headers, "NOADM")
    users = (await http.get(f"/api/platform/clinics/{clinic_id}/users", headers=super_headers)).json()
    rows = users["items"] if isinstance(users, dict) else users
    # The clinic's only login is an ordinary staff role, as could exist before the upgrade.
    await db.users.update_one({"email": rows[0]["email"]}, {"$set": {"role": "Receptionist"}})
    report = await build_report(db)
    clinic = next(c for c in report["clinics"] if c["name"] == "Rollout NOADM")
    assert clinic["owners_or_administrators"] == 0
    assert any("No active Clinic Owner or Administrator" in item for item in clinic["must_fix"])
    assert report["ready"] is False
    assert "FIX FIRST" in render(report)
    # Once someone is made Administrator the clinic is fine; it is told it has no owner yet.
    await db.users.update_one({"email": rows[0]["email"]}, {"$set": {"role": "Administrator"}})
    clinic = next(c for c in (await build_report(db))["clinics"] if c["name"] == "Rollout NOADM")
    assert clinic["must_fix"] == []
    assert any("No Clinic Owner login" in note for note in clinic["to_know"])
    # A clinic created today has patient-app booking on. One from before the upgrade has no
    # such setting, which counts as off: its patients are not exposed to the app by the upgrade.
    assert clinic["patient_app_booking"] is True
    await db.app_settings.update_one({"clinic_id": clinic_id, "key": "settings"}, {"$unset": {"values.onlineBooking": ""}})
    clinic = next(c for c in (await build_report(db))["clinics"] if c["name"] == "Rollout NOADM")
    assert clinic["patient_app_booking"] is False
    assert any('"Patient app booking" is off' in note for note in clinic["to_know"])


async def test_the_check_flags_a_consultant_login_that_could_sign_in_nowhere(http, super_headers):
    clinic_id = await _clinic_with(http, super_headers, "CONS")
    # A login someone gave the role "Consultant" before that role had a meaning.
    await db.users.insert_one({
        "name": "Dr. Legacy", "email": "legacy.consultant@cons.test", "role": "Consultant", "clinic_id": clinic_id,
        "password_hash": hash_password("LegacyDoc#2026"), "status": "Active"})
    clinic = next(c for c in (await build_report(db))["clinics"] if c["name"] == "Rollout CONS")
    assert clinic["consultant_logins_unlinked"] == ["legacy.consultant@cons.test"]
    assert any("not linked to a consultant profile" in item for item in clinic["must_fix"])
    # and that is true: the login is refused by both the web app and the Consultant app
    web = await http.post("/api/auth/login", json={"email": "legacy.consultant@cons.test", "password": "LegacyDoc#2026"})
    assert web.status_code == 403
    app = await http.post("/api/auth/login", json={"email": "legacy.consultant@cons.test", "password": "LegacyDoc#2026", "app": "consultant"})
    token = app.json().get("access_token") if app.status_code == 200 else None
    if token:
        assert (await http.get("/api/consultant/dashboard", headers=bearer(token))).status_code in (403, 409)
    await db.users.delete_one({"email": "legacy.consultant@cons.test"})


async def test_in_production_readme_passwords_block_the_upgrade(http, monkeypatch):
    from app import preflight

    monkeypatch.setattr(preflight, "IS_PROD", True)
    report = await build_report(db)
    assert any("Demo logins" in item for item in report["platform"]["must_fix"])
    assert report["ready"] is False


# ------------------------------------------------------------------ console status

async def test_the_console_is_told_which_outside_services_are_connected(http, super_headers, monkeypatch):
    from app import otp
    from app.routers import platform

    from app import email_codes

    status = (await http.get("/api/platform/overview", headers=super_headers)).json()["integrations"]
    assert status == {"sms": True, "sms_test_mode": True, "otp_test_mobiles": None, "patient_test_logins": 0, "email": True, "email_test_mode": True,
                      "push": False, "notification_retention_days": 180}
    monkeypatch.setattr(otp, "SMS_PROVIDER", "")
    monkeypatch.setattr(platform, "SMS_PROVIDER", "")
    status = (await http.get("/api/platform/overview", headers=super_headers)).json()["integrations"]
    assert status["sms"] is False and status["sms_test_mode"] is False
    # email: not configured, then a real service (no address is ever called here)
    monkeypatch.setattr(email_codes, "EMAIL_PROVIDER", "")
    monkeypatch.setattr(platform, "EMAIL_PROVIDER", "")
    status = (await http.get("/api/platform/overview", headers=super_headers)).json()["integrations"]
    assert status["email"] is False and status["email_test_mode"] is False
    monkeypatch.setattr(email_codes, "EMAIL_PROVIDER", "webhook")
    monkeypatch.setattr(email_codes, "EMAIL_WEBHOOK_URL", "https://mail.example.test/send")
    monkeypatch.setattr(platform, "EMAIL_PROVIDER", "webhook")
    status = (await http.get("/api/platform/overview", headers=super_headers)).json()["integrations"]
    assert status["email"] is True and status["email_test_mode"] is False


# ----------------------------------------------------------- notification clean-up

async def test_notifications_carry_the_date_they_will_be_deleted(http):
    ravi = bearer((await patient_login(http))["access_token"])
    admin = await staff_headers(http, ADMIN)
    made = await http.post("/api/appointments", headers=admin, json={
        "patient": "Ravi Kumar", "patientCode": "DEN-1001", "date": "2027-03-01", "time": "11:30",
        "treatment": "Retention check", "doctor": "Dr. Gowtham", "chair": "Chair 02", "status": "Scheduled"})
    assert made.status_code == 201, made.text
    newest = await db.notifications.find({"title": "Appointment booked"}).sort("created_at", -1).to_list(1)
    expires = newest[0]["expires_at"].replace(tzinfo=timezone.utc)
    remaining = expires - datetime.now(timezone.utc)
    assert timedelta(days=179, hours=23) < remaining <= timedelta(days=180)
    # the API never shows the internal date
    listed = (await http.get("/api/patient/notifications", headers=ravi)).json()["items"]
    assert listed and all("expires_at" not in item for item in listed)
    await http.delete(f"/api/appointments/{made.json()['id']}", headers=admin)


async def test_retention_can_be_switched_off_and_old_notifications_get_a_date(http, monkeypatch):
    monkeypatch.setattr(notify, "NOTIFICATION_RETENTION_DAYS", 0)
    assert notify._expiry() == {}
    monkeypatch.setattr(notify, "NOTIFICATION_RETENTION_DAYS", 180)
    # A notification written before the rule existed is given its date by the start-up step.
    written = datetime.now(timezone.utc) - timedelta(days=10)
    result = await db.notifications.insert_one({
        "clinic_id": "x", "to_kind": "user", "to_id": "nobody@test.in", "title": "Old", "body": "",
        "kind": "general", "data": {}, "read_at": None, "created_at": written.isoformat()})
    await _ensure_app_indexes(db)
    doc = await db.notifications.find_one({"_id": result.inserted_id})
    expires = doc["expires_at"].replace(tzinfo=timezone.utc)
    assert abs((expires - written) - timedelta(days=180)) < timedelta(seconds=2)
    indexes = await db.notifications.index_information()
    assert any(spec.get("expireAfterSeconds") == 0 and spec["key"] == [("expires_at", 1)] for spec in indexes.values())
    await db.notifications.delete_one({"_id": result.inserted_id})

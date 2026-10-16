"""Tests for the mobile-app backend: roles, sessions, OTP, and the patient / consultant /
owner APIs — with the emphasis on what each role must NOT be able to reach."""
import asyncio
from datetime import date, timedelta

import pytest

from app.db import db

ADMIN = ("admin@dentor.in", "Dentor@2026")
OWNER = ("owner@dentor.in", "Owner@2026")
CONSULTANT = ("kumar@dentor.in", "Consultant@2026")
DEMO_PATIENT = ("9876543210", "Patient@2026")


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def staff_login(http, creds, app="web") -> dict:
    res = await http.post("/api/auth/login", json={"email": creds[0], "password": creds[1], "app": app})
    assert res.status_code == 200, res.text
    return res.json()


async def staff_headers(http, creds, app="web") -> dict:
    return bearer((await staff_login(http, creds, app))["access_token"])


async def patient_login(http, creds=DEMO_PATIENT) -> dict:
    res = await http.post("/api/patient/auth/login", json={"identifier": creds[0], "password": creds[1]})
    assert res.status_code == 200, res.text
    return res.json()


async def otp_ticket(http, mobile: str, purpose: str) -> str:
    sent = await http.post("/api/patient/auth/otp/request", json={"mobile": mobile, "purpose": purpose})
    assert sent.status_code == 200, sent.text
    code = sent.json()["dev_otp"]  # the console provider returns the code in development only
    verified = await http.post("/api/patient/auth/otp/verify", json={"mobile": mobile, "purpose": purpose, "code": code})
    assert verified.status_code == 200, verified.text
    return verified.json()["ticket"]


async def patient_signup(http, mobile: str, name: str, password="Secret123") -> dict:
    ticket = await otp_ticket(http, mobile, "signup")
    res = await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": name, "password": password})
    assert res.status_code == 201, res.text
    return res.json()


async def ensure_patient(http, mobile: str, name: str, password="Secret123") -> dict:
    """Log in, signing the account up first if this test runs before the one that creates it."""
    res = await http.post("/api/patient/auth/login", json={"identifier": mobile, "password": password})
    if res.status_code == 200:
        return res.json()
    return await patient_signup(http, mobile, name, password)


async def set_setting(http, patch: dict):
    headers = await staff_headers(http, ADMIN)
    current = (await http.get("/api/settings", headers=headers)).json()
    res = await http.put("/api/settings", headers=headers, json={"values": {**current, **patch}})
    assert res.status_code == 200, res.text


# ===================================================================== roles

async def test_login_is_restricted_per_app(http):
    # each app only accepts its own role
    assert (await http.post("/api/auth/login", json={"email": CONSULTANT[0], "password": CONSULTANT[1]})).status_code == 403
    # the Clinic app (built as "owner") admits the roles that run the practice, not e.g. a pharmacist
    await staff_login(http, ADMIN, "owner")
    assert (await http.post("/api/auth/login", json={"email": OWNER[0], "password": OWNER[1], "app": "consultant"})).status_code == 403
    assert (await http.post("/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1], "app": "nope"})).status_code == 400
    await staff_login(http, OWNER, "owner")
    await staff_login(http, CONSULTANT, "consultant")
    await staff_login(http, OWNER, "web")  # an owner may also use the reception web app


async def test_consultant_is_confined_to_the_consultant_api(http):
    h = await staff_headers(http, CONSULTANT, "consultant")
    assert (await http.get("/api/consultant/dashboard", headers=h)).status_code == 200
    for path in ("/api/patients", "/api/invoices", "/api/settings", "/api/dashboard?date=" + day(0),
                 "/api/search?q=ravi", "/api/owner/overview", "/api/clinic/users", "/api/platform/clinics",
                 "/api/accounts/summary"):
        res = await http.get(path, headers=h)
        assert res.status_code == 403, f"{path} -> {res.status_code}"
    created = await http.post("/api/patients", headers=h, json={"name": "Nope"})
    assert created.status_code == 403


async def test_patient_token_cannot_open_any_staff_api(http):
    token = (await patient_login(http))["access_token"]
    h = bearer(token)
    assert (await http.get("/api/patient/me", headers=h)).status_code == 200
    for path in ("/api/patients", "/api/appointments", "/api/invoices", "/api/settings", "/api/auth/me",
                 "/api/notifications", "/api/owner/overview", "/api/consultant/dashboard", "/api/clinic/users",
                 "/api/platform/clinics"):
        res = await http.get(path, headers=h)
        assert res.status_code == 403, f"{path} -> {res.status_code}"


async def test_staff_token_cannot_open_patient_api(http):
    h = await staff_headers(http, ADMIN)
    assert (await http.get("/api/patient/me", headers=h)).status_code == 403
    assert (await http.get("/api/patient/invoices", headers=h)).status_code == 403


async def test_clinic_app_api_follows_roles(http):
    """The Dentor Clinic app (built as "owner") admits the roles that run the practice; the API
    decides per role: money for owner, administrator and accountant; the team and the clinic record
    for owner and administrator; activity for everyone it admits."""
    owner = await staff_headers(http, OWNER, "owner")
    made = {}
    for role in ("Receptionist", "Dentist", "Accountant", "Pharmacist"):
        email = f"clinicapp.{role.lower()}@test.in"
        res = await http.post("/api/clinic/users", headers=owner, json={"name": f"App {role}", "email": email, "password": "ClinicApp#2026", "role": role})
        assert res.status_code == 201, res.text
        made[role] = (email, "ClinicApp#2026")
    # a pharmacist works in the web app only
    refused = await http.post("/api/auth/login", json={"email": made["Pharmacist"][0], "password": made["Pharmacist"][1], "app": "owner"})
    assert refused.status_code == 403 and "Dentor Clinic" in refused.json()["detail"]
    logins = {"owner": owner, "admin": await staff_headers(http, ADMIN, "owner")}
    for role in ("Receptionist", "Dentist", "Accountant"):
        logins[role] = await staff_headers(http, made[role], "owner")
    expected = {  # owner, admin, receptionist, dentist, accountant
        "/api/owner/overview":   (200, 200, 200, 200, 200),
        "/api/owner/operations": (200, 200, 200, 200, 200),
        "/api/owner/clinic":     (200, 200, 200, 200, 200),
        "/api/owner/finance":    (200, 200, 403, 403, 200),
        "/api/owner/team":       (200, 200, 403, 403, 403),
    }
    for path, codes in expected.items():
        got = tuple([(await http.get(path, headers=h)).status_code for h in logins.values()])
        assert got == codes, f"{path}: {got}"
    # only owners and administrators change the clinic record
    assert (await http.patch("/api/owner/clinic", headers=logins["Receptionist"], json={"city": "X"})).status_code == 403
    # money is not shown to roles without access to it
    desk = (await http.get("/api/owner/overview", headers=logins["Receptionist"])).json()
    assert desk["money"] is False and desk["billed"] is None and desk["today_summary"]["collected"] is None
    assert all(day["collected"] is None for day in desk["series"])
    books = (await http.get("/api/owner/overview", headers=logins["Accountant"])).json()
    assert books["money"] is True and isinstance(books["billed"], (int, float))


async def test_settings_can_only_be_changed_by_clinic_admins(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Front Desk", "email": "desk@test.in", "password": "FrontDesk#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    desk = await staff_headers(http, ("desk@test.in", "FrontDesk#2026"))
    current = (await http.get("/api/settings", headers=desk)).json()  # staff may read
    assert (await http.put("/api/settings", headers=desk, json={"values": current})).status_code == 403
    assert (await http.get("/api/clinic/users", headers=desk)).status_code == 403
    assert (await http.get("/api/patients", headers=desk)).status_code == 200  # reception access is intact


# ================================================================== sessions

async def test_refresh_rotates_and_detects_reuse(http):
    first = await staff_login(http, ADMIN)
    assert first["refresh_token"]
    second = await http.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200, second.text
    pair = second.json()
    assert pair["refresh_token"] != first["refresh_token"]
    assert (await http.get("/api/auth/me", headers=bearer(pair["access_token"]))).status_code == 200
    # the old token was single-use; replaying it kills the whole session family
    assert (await http.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": pair["refresh_token"]})).status_code == 401


async def test_logout_revokes_the_refresh_token(http):
    session = await staff_login(http, OWNER, "owner")
    assert (await http.post("/api/auth/logout", json={"refresh_token": session["refresh_token"]})).status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": "garbage"})).status_code == 401


async def test_deactivated_login_loses_access_and_sessions(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Temp Staff", "email": "temp@test.in", "password": "TempStaff#2026", "role": "Receptionist"})
    session = await staff_login(http, ("temp@test.in", "TempStaff#2026"))
    off = await http.patch(f"/api/clinic/users/{made.json()['id']}", headers=owner, json={"status": "Inactive"})
    assert off.status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/login", json={"email": "temp@test.in", "password": "TempStaff#2026"})).status_code == 403


# ============================================================= clinic logins

async def test_clinic_user_management_rules(http):
    owner = await staff_headers(http, OWNER, "owner")
    admin = await staff_headers(http, ADMIN)
    # an administrator can manage staff logins but never owner accounts
    denied = await http.post("/api/clinic/users", headers=admin, json={
        "name": "Fake Owner", "email": "fake.owner@test.in", "password": "FakeOwner#2026", "role": "Clinic Owner"})
    assert denied.status_code == 403
    assert (await http.post("/api/clinic/users", headers=admin, json={
        "name": "Root", "email": "root@test.in", "password": "RootRoot#2026", "role": "Super Admin"})).status_code == 400

    users = (await http.get("/api/clinic/users", headers=owner)).json()["items"]
    owner_row = next(u for u in users if u["email"] == OWNER[0])
    admin_row = next(u for u in users if u["email"] == ADMIN[0])
    assert (await http.patch(f"/api/clinic/users/{owner_row['id']}", headers=admin, json={"status": "Inactive"})).status_code == 403
    assert (await http.patch(f"/api/clinic/users/{owner_row['id']}", headers=owner, json={"status": "Inactive"})).status_code == 400
    assert (await http.patch(f"/api/clinic/users/{admin_row['id']}", headers=admin, json={"role": "Receptionist"})).status_code == 400
    # weak passwords are refused (the demo clinic enforces the strong policy)
    weak = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Weak", "email": "weak@test.in", "password": "weakweak", "role": "Receptionist"})
    assert weak.status_code == 400


async def test_consultant_login_needs_a_unique_consultant_profile(http):
    owner = await staff_headers(http, OWNER, "owner")
    consultants = (await http.get("/api/consultants", headers=owner)).json()["items"]
    anitha = next(c for c in consultants if c["name"] == "Dr. Anitha")
    kumar = next(c for c in consultants if c["name"] == "Dr. Kumar")
    base = {"name": "Dr. Anitha", "password": "Consult#2026x", "role": "Consultant"}
    assert (await http.post("/api/clinic/users", headers=owner, json={**base, "email": "a1@test.in"})).status_code == 400
    taken = await http.post("/api/clinic/users", headers=owner, json={**base, "email": "a2@test.in", "consultant_id": kumar["id"]})
    assert taken.status_code == 409  # Dr. Kumar already has the demo login
    ok = await http.post("/api/clinic/users", headers=owner, json={**base, "email": "anitha@test.in", "consultant_id": anitha["id"]})
    assert ok.status_code == 201, ok.text
    assert ok.json()["consultant_name"] == "Dr. Anitha"
    h = await staff_headers(http, ("anitha@test.in", "Consult#2026x"), "consultant")
    assert (await http.get("/api/consultant/me", headers=h)).json()["profile"]["name"] == "Dr. Anitha"


# ====================================================================== OTP

async def test_otp_signup_join_and_login_flow(http):
    mobile = "9000000101"
    sent = await http.post("/api/patient/auth/otp/request", json={"mobile": mobile, "purpose": "signup"})
    assert sent.status_code == 200 and len(sent.json()["dev_otp"]) == 6
    # a second code cannot be requested straight away
    assert (await http.post("/api/patient/auth/otp/request", json={"mobile": mobile, "purpose": "signup"})).status_code == 429
    wrong = await http.post("/api/patient/auth/otp/verify", json={"mobile": mobile, "purpose": "signup", "code": "000000"})
    assert wrong.status_code == 400
    ticket = (await http.post("/api/patient/auth/otp/verify",
                              json={"mobile": mobile, "purpose": "signup", "code": sent.json()["dev_otp"]})).json()["ticket"]
    # a signup ticket cannot be used to reset a password or to call any API
    assert (await http.post("/api/patient/auth/reset-password", json={"ticket": ticket, "new_password": "Whatever123"})).status_code == 400
    assert (await http.get("/api/patient/me", headers=bearer(ticket))).status_code == 403
    assert (await http.get("/api/patients", headers=bearer(ticket))).status_code == 403

    weak = await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "New Person", "password": "short"})
    assert weak.status_code == 400
    made = await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "New Person", "password": "Secret123"})
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["profile"] is None and body["profiles"] == []  # no clinic record yet
    h = bearer(body["access_token"])
    assert (await http.get("/api/patient/me", headers=h)).status_code == 409  # must choose a clinic first

    clinics = (await http.get("/api/patient/clinics", headers=h)).json()["items"]
    demo = next(c for c in clinics if c["name"] == "DENTOR Dental Clinic")
    joined = await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": demo["id"], "age": 31, "gender": "Female"})
    assert joined.status_code == 201, joined.text
    h = bearer(joined.json()["access_token"])
    me = (await http.get("/api/patient/me", headers=h)).json()
    assert me["profile"]["name"] == "New Person" and me["profile"]["code"].startswith("DEN-")
    # the front desk sees the new patient, marked as coming from the app
    admin = await staff_headers(http, ADMIN)
    found = (await http.get("/api/patients?q=New Person", headers=admin)).json()["items"]
    assert found and found[0]["source"] == "Patient App"

    # signing up twice is refused; logging in works; a wrong password does not
    assert (await http.post("/api/patient/auth/otp/request", json={"mobile": "9000000101", "purpose": "signup"})).status_code == 409
    assert (await http.post("/api/patient/auth/login", json={"identifier": mobile, "password": "nope12345"})).status_code == 401
    again = await patient_login(http, (mobile, "Secret123"))
    assert again["profile"]["name"] == "New Person"


async def test_signup_links_existing_clinic_record_by_mobile(http):
    # Siva Prakash (DEN-1002) is already a patient of the demo clinic with this number
    body = await ensure_patient(http, "9876543211", "Siva Prakash")
    assert body["profile"]["code"] == "DEN-1002"


async def test_unknown_number_gets_no_code_and_no_hint(http):
    res = await http.post("/api/patient/auth/otp/request", json={"mobile": "9000000999", "purpose": "reset"})
    assert res.status_code == 200 and "dev_otp" not in res.json()
    assert (await http.post("/api/patient/auth/otp/request", json={"mobile": "12345", "purpose": "signup"})).status_code == 400


async def test_password_reset_by_otp_ends_old_sessions(http):
    mobile = "9000000102"
    session = await patient_signup(http, mobile, "Reset Person")
    ticket = await otp_ticket(http, mobile, "reset")
    done = await http.post("/api/patient/auth/reset-password", json={"ticket": ticket, "new_password": "Brandnew123"})
    assert done.status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401
    assert (await http.post("/api/patient/auth/login", json={"identifier": mobile, "password": "Secret123"})).status_code == 401
    await patient_login(http, (mobile, "Brandnew123"))


async def test_otp_login_and_patient_refresh(http):
    mobile = "9000000103"
    await patient_signup(http, mobile, "Otp Person")
    ticket = await otp_ticket(http, mobile, "login")
    session = await http.post("/api/patient/auth/login-otp", json={"ticket": ticket})
    assert session.status_code == 200
    renewed = await http.post("/api/auth/refresh", json={"refresh_token": session.json()["refresh_token"]})
    assert renewed.status_code == 200 and renewed.json()["account"]["mobile"] == mobile


async def test_no_sms_provider_means_no_codes(http, monkeypatch):
    """Production without an SMS gateway must refuse, never fall back to exposing codes."""
    import app.otp as otp
    monkeypatch.setattr(otp, "SMS_PROVIDER", "")
    res = await http.post("/api/patient/auth/otp/request", json={"mobile": "9000000201", "purpose": "signup"})
    assert res.status_code == 503
    assert await db.otp_codes.count_documents({"mobile": "9000000201"}) == 0


async def test_real_sms_gateway_never_returns_the_code(http, monkeypatch):
    import app.otp as otp
    sent = []
    monkeypatch.setattr(otp, "SMS_PROVIDER", "webhook")
    monkeypatch.setattr(otp, "SMS_WEBHOOK_URL", "https://sms.example.test/send")
    monkeypatch.setattr(otp, "_post_webhook", lambda mobile, message, purpose: sent.append((mobile, message)))
    res = await http.post("/api/patient/auth/otp/request", json={"mobile": "9000000202", "purpose": "signup"})
    assert res.status_code == 200 and "dev_otp" not in res.json()
    assert sent and sent[0][0] == "9000000202" and "verification code" in sent[0][1]
    # five wrong guesses lock the code
    for _ in range(5):
        assert (await http.post("/api/patient/auth/otp/verify",
                                json={"mobile": "9000000202", "purpose": "signup", "code": "111111"})).status_code == 400
    code = sent[0][1].split(" ")[0]
    locked = await http.post("/api/patient/auth/otp/verify", json={"mobile": "9000000202", "purpose": "signup", "code": code})
    assert locked.status_code == 429


# ============================================================ patient portal

async def test_patient_sees_only_their_own_records(http):
    ravi = bearer((await patient_login(http))["access_token"])
    me = (await http.get("/api/patient/me", headers=ravi)).json()
    assert me["profile"]["code"] == "DEN-1001"

    mine = (await http.get("/api/patient/invoices", headers=ravi)).json()
    assert mine["items"] and all(i["patientCode"] == "DEN-1001" for i in mine["items"])
    rx = (await http.get("/api/patient/prescriptions", headers=ravi)).json()["items"]
    assert rx and all(r["patientCode"] == "DEN-1001" for r in rx)
    appts = (await http.get("/api/patient/appointments", headers=ravi)).json()["items"]
    assert appts and all(a["patientCode"] == "DEN-1001" for a in appts)
    records = (await http.get("/api/patient/records", headers=ravi)).json()
    assert records["treatments"] and records["teeth"].get("46")

    # other patients' documents answer "not found" even with a valid id
    admin = await staff_headers(http, ADMIN)
    other_invoice = next(i for i in (await http.get("/api/invoices", headers=admin)).json()["items"] if i["patientCode"] != "DEN-1001")
    other_rx = next(r for r in (await http.get("/api/prescriptions", headers=admin)).json()["items"] if r["patientCode"] != "DEN-1001")
    other_appt = next(a for a in (await http.get("/api/appointments", headers=admin)).json()["items"] if a.get("patientCode") != "DEN-1001")
    assert (await http.get(f"/api/patient/invoices/{other_invoice['id']}", headers=ravi)).status_code == 404
    assert (await http.get(f"/api/patient/prescriptions/{other_rx['id']}", headers=ravi)).status_code == 404
    assert (await http.get(f"/api/patient/appointments/{other_appt['id']}", headers=ravi)).status_code == 404
    assert (await http.post(f"/api/patient/appointments/{other_appt['id']}/cancel", headers=ravi, json={})).status_code == 404

    # and another record cannot be selected unless it carries this account's mobile number
    others = (await http.get("/api/patients?q=DEN-1004", headers=admin)).json()["items"][0]
    clinic_id = me["clinic"]["id"]
    assert (await http.post("/api/patient/profiles/select", headers=ravi,
                            json={"patient_id": others["id"], "clinic_id": clinic_id})).status_code == 404


async def test_patient_booking_cancel_and_reschedule(http):
    ravi = bearer((await patient_login(http))["access_token"])
    slots = (await http.get(f"/api/patient/slots?date={day(21)}&doctor=Dr. Anitha", headers=ravi)).json()["slots"]
    assert len(slots) == 18 and all(s["available"] for s in slots)

    booked = await http.post("/api/patient/appointments", headers=ravi,
                             json={"date": day(21), "time": "10:00", "doctor": "Dr. Anitha", "reason": "Tooth pain"})
    assert booked.status_code == 201, booked.text
    appt = booked.json()
    assert appt["status"] == "Scheduled" and appt["source"] == "Patient App" and appt["can_cancel"]
    # the slot is now closed for that doctor, for this patient and for anyone else
    after = (await http.get(f"/api/patient/slots?date={day(21)}&doctor=Dr. Anitha", headers=ravi)).json()["slots"]
    assert next(s for s in after if s["time"] == "10:00")["available"] is False
    siva = bearer((await ensure_patient(http, "9876543211", "Siva Prakash"))["access_token"])
    clash = await http.post("/api/patient/appointments", headers=siva,
                            json={"date": day(21), "time": "10:00", "doctor": "Dr. Anitha", "reason": "Check"})
    assert clash.status_code == 409
    # the front desk sees the app booking in the normal calendar feed
    admin = await staff_headers(http, ADMIN)
    desk = (await http.get(f"/api/appointments?date={day(21)}", headers=admin)).json()["items"]
    assert any(a["id"] == appt["id"] and a["patient"] == "Ravi Kumar" for a in desk)

    moved = await http.post(f"/api/patient/appointments/{appt['id']}/reschedule", headers=ravi, json={"date": day(22), "time": "11:30"})
    assert moved.status_code == 200 and moved.json()["date"] == day(22)
    bad = await http.post("/api/patient/appointments", headers=ravi,
                          json={"date": day(-1), "time": "10:00", "doctor": "Dr. Anitha"})
    assert bad.status_code == 409  # the past is never bookable
    assert (await http.post("/api/patient/appointments", headers=ravi,
                            json={"date": day(21), "time": "10:07", "doctor": "Dr. Anitha"})).status_code == 400
    assert (await http.post("/api/patient/appointments", headers=ravi,
                            json={"date": day(21), "time": "10:00", "doctor": "Dr. Nobody"})).status_code == 404

    gone = await http.post(f"/api/patient/appointments/{appt['id']}/cancel", headers=ravi, json={"reason": "Travelling"})
    assert gone.status_code == 200 and gone.json()["status"] == "Cancelled"
    assert (await http.post(f"/api/patient/appointments/{appt['id']}/cancel", headers=ravi, json={})).status_code == 400


async def test_online_booking_setting_is_enforced(http):
    ravi = bearer((await patient_login(http))["access_token"])
    await set_setting(http, {"onlineBooking": False})
    try:
        res = await http.post("/api/patient/appointments", headers=ravi,
                              json={"date": day(25), "time": "09:00", "doctor": "Dr. Kumar"})
        assert res.status_code == 403
        listed = (await http.get("/api/patient/clinics", headers=ravi)).json()["items"]
        assert all(c["name"] != "DENTOR Dental Clinic" for c in listed)  # hidden while booking is off
    finally:
        await set_setting(http, {"onlineBooking": True})


async def test_chat_reaches_reception_and_replies_reach_the_patient(http):
    ravi = bearer((await patient_login(http))["access_token"])
    sent = await http.post("/api/patient/chat", headers=ravi, json={"text": "Can I eat before the visit?"})
    assert sent.status_code == 201 and sent.json()["messages"][-1]["mine"] is True

    admin = await staff_headers(http, ADMIN)
    inbox = (await http.get("/api/omni_conversations?channel=Patient App", headers=admin)).json()["items"]
    thread = next(c for c in inbox if c["patientId"] == "DEN-1001")
    assert thread["unread"] >= 1 and thread["messages"][-1][1] == "Can I eat before the visit?"
    # reception replies the same way the Omnichannel screen does
    reply = await http.patch(f"/api/omni_conversations/{thread['id']}", headers=admin,
                             json={"messages": [*thread["messages"], ["out", "Yes, a light meal is fine.", "10:45 AM"]], "unread": 0})
    assert reply.status_code == 200
    home = (await http.get("/api/patient/home", headers=ravi)).json()
    assert home["unread_chat"] == 1
    chat = (await http.get("/api/patient/chat", headers=ravi)).json()
    assert chat["messages"][-1] == {"mine": False, "text": "Yes, a light meal is fine.", "time": "10:45 AM", "at": ""}
    assert (await http.get("/api/patient/home", headers=ravi)).json()["unread_chat"] == 0
    notes = (await http.get("/api/patient/notifications", headers=ravi)).json()
    assert any(n["kind"] == "chat" for n in notes["items"])


async def test_review_consent_and_reports(http):
    ravi = bearer((await patient_login(http))["access_token"])
    review = await http.post("/api/patient/reviews", headers=ravi, json={"subject": "Dr. Kumar", "rating": 5, "text": "Painless and quick."})
    assert review.status_code == 201 and review.json()["status"] == "Pending"
    admin = await staff_headers(http, ADMIN)
    queue = (await http.get("/api/reviews?status=Pending", headers=admin)).json()["items"]
    assert any(r["text"] == "Painless and quick." and r["type"] == "Consultant" for r in queue)
    assert (await http.post("/api/patient/reviews", headers=ravi, json={"rating": 9, "text": "x" * 10})).status_code == 422
    # quick tags and the recommend answer are stored; a tag the form does not offer is dropped
    tagged = await http.post("/api/patient/reviews", headers=ravi, json={
        "rating": 2, "text": "Long wait.", "tags": ["Clean Clinic", "Free lunch"], "recommend": False})
    assert tagged.status_code == 201 and tagged.json()["tags"] == ["Clean Clinic"] and tagged.json()["recommend"] is False
    assert review.json()["tags"] == [] and review.json()["recommend"] is None

    consents = (await http.get("/api/patient/consents", headers=ravi)).json()["items"]
    pending = next(c for c in consents if c["status"] == "Pending")
    signed = await http.post(f"/api/patient/consents/{pending['id']}/sign", headers=ravi)
    assert signed.status_code == 200 and signed.json()["status"] == "Signed" and signed.json()["signedVia"] == "Patient App"
    assert (await http.post(f"/api/patient/consents/{pending['id']}/sign", headers=ravi)).status_code == 400

    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    up = await http.post("/api/patient/reports", headers=ravi, json={"name": "Old X-ray", "dataUrl": png})
    assert up.status_code == 201
    assert (await http.post("/api/patient/reports", headers=ravi, json={"name": "Bad", "dataUrl": "data:text/html;base64,PGI+"})).status_code == 400
    listed = (await http.get("/api/patient/reports", headers=ravi)).json()["items"]
    clinic_file = next(f for f in listed if not f["mine"])
    assert all("dataUrl" not in f for f in listed)
    assert (await http.get(f"/api/patient/reports/{up.json()['id']}", headers=ravi)).json()["dataUrl"] == png
    assert (await http.delete(f"/api/patient/reports/{clinic_file['id']}", headers=ravi)).status_code == 404  # clinic files stay
    assert (await http.delete(f"/api/patient/reports/{up.json()['id']}", headers=ravi)).status_code == 200


async def test_front_desk_actions_notify_the_patient(http):
    ravi = bearer((await patient_login(http))["access_token"])
    before = (await http.get("/api/patient/notifications", headers=ravi)).json()["unread"]
    admin = await staff_headers(http, ADMIN)
    made = await http.post("/api/appointments", headers=admin, json={
        "patient": "Ravi Kumar", "patientCode": "DEN-1001", "date": day(30), "time": "15:00",
        "treatment": "Crown fitting", "doctor": "Dr. Gowtham", "chair": "Chair 03", "status": "Scheduled"})
    assert made.status_code == 201
    await http.patch(f"/api/appointments/{made.json()['id']}", headers=admin, json={"status": "Cancelled"})
    invoice = await http.post("/api/invoices", headers=admin, json={
        "date": day(0), "patient": "Ravi Kumar", "patientCode": "DEN-1001", "treatment": "Crown",
        "total": 2000, "paid": 0, "balance": 2000, "status": "Pending"})
    await http.post("/api/payments/record", headers=admin, json={
        "invoice_id": invoice.json()["id"], "patient": "Ravi Kumar", "patientCode": "DEN-1001",
        "amount": 2000, "mode": "UPI", "reference": "TEST-UTR", "date": day(0)})
    notes = (await http.get("/api/patient/notifications", headers=ravi)).json()
    titles = [n["title"] for n in notes["items"]]
    for expected in ("Appointment booked", "Appointment cancelled", "New bill", "Payment received"):
        assert expected in titles, expected
    assert notes["unread"] >= before + 4
    assert (await http.post("/api/patient/notifications/read", headers=ravi, json={})).json()["updated"] >= 4
    assert (await http.get("/api/patient/notifications", headers=ravi)).json()["unread"] == 0
    # another patient received none of them
    siva = bearer((await ensure_patient(http, "9876543211", "Siva Prakash"))["access_token"])
    theirs = (await http.get("/api/patient/notifications", headers=siva)).json()["items"]
    assert not any(n["title"] in ("New bill", "Payment received") for n in theirs)


async def test_family_member_and_profile_update(http):
    session = await patient_signup(http, "9000000104", "Parent Person")
    h = bearer(session["access_token"])
    clinic = (await http.get("/api/patient/clinics", headers=h)).json()["items"][0]
    h = bearer((await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": clinic["id"]})).json()["access_token"])
    child = await http.post("/api/patient/profiles/family", headers=h, json={"name": "Child Person", "age": 8, "gender": "Male", "relation": "Son"})
    assert child.status_code == 201
    assert (await http.post("/api/patient/profiles/family", headers=h, json={"name": "child person"})).status_code == 409
    profiles = (await http.get("/api/patient/profiles", headers=h)).json()["items"]
    assert {p["name"] for p in profiles} == {"Parent Person", "Child Person"}
    switched = await http.post("/api/patient/profiles/select", headers=h,
                               json={"patient_id": child.json()["profile"]["patient_id"], "clinic_id": clinic["id"]})
    assert switched.status_code == 200 and switched.json()["profile"]["name"] == "Child Person"

    updated = await http.patch("/api/patient/me", headers=h, json={"address": "12 Lake Road", "allergy": "Latex", "emergencyMobile": "+91 98400 12345"})
    assert updated.status_code == 200 and updated.json()["emergencyMobile"] == "9840012345"
    assert (await http.patch("/api/patient/me", headers=h, json={"email": "not-an-email"})).status_code == 400

    # deleting the app account keeps the clinic's record and ends the session
    assert (await http.post("/api/patient/account/delete", headers=h, json={"password": "wrong"})).status_code == 400
    assert (await http.post("/api/patient/account/delete", headers=h, json={"password": "Secret123"})).status_code == 200
    assert (await http.get("/api/patient/me", headers=h)).status_code == 401
    admin = await staff_headers(http, ADMIN)
    assert (await http.get("/api/patients?q=Parent Person", headers=admin)).json()["total"] == 1


# ============================================================ consultant API

async def test_consultant_sees_only_their_own_work(http):
    h = await staff_headers(http, CONSULTANT, "consultant")
    dash = (await http.get("/api/consultant/dashboard", headers=h)).json()
    assert dash["profile"]["name"] == "Dr. Kumar"
    assert dash["today"] and all(a["doctor"] == "Dr. Kumar" for a in dash["today"])
    listing = (await http.get("/api/consultant/appointments", headers=h)).json()["items"]
    assert all(a["doctor"] == "Dr. Kumar" for a in listing)

    patients = (await http.get("/api/consultant/patients", headers=h)).json()["items"]
    codes = {p["code"] for p in patients}
    assert "DEN-1001" in codes and "DEN-1004" not in codes  # Karthik Raj is Dr. Gowtham's patient
    admin = await staff_headers(http, ADMIN)
    karthik = (await http.get("/api/patients?q=DEN-1004", headers=admin)).json()["items"][0]
    assert (await http.get(f"/api/consultant/patients/{karthik['id']}", headers=h)).status_code == 404
    assert (await http.post(f"/api/consultant/patients/{karthik['id']}/prescriptions", headers=h, json={
        "diagnosis": "Anything", "meds": [{"drug": "X"}]})).status_code == 404
    # an appointment of another doctor is invisible too
    foreign = next(a for a in (await http.get("/api/appointments", headers=admin)).json()["items"] if a["doctor"] == "Dr. Gowtham")
    assert (await http.get(f"/api/consultant/appointments/{foreign['id']}", headers=h)).status_code == 404
    assert (await http.post(f"/api/consultant/appointments/{foreign['id']}/status", headers=h, json={"status": "Completed"})).status_code == 404


async def test_consultant_prescribes_and_updates_status(http):
    h = await staff_headers(http, CONSULTANT, "consultant")
    ravi_id = next(p["id"] for p in (await http.get("/api/consultant/patients?q=Ravi", headers=h)).json()["items"])
    detail = (await http.get(f"/api/consultant/patients/{ravi_id}", headers=h)).json()
    assert detail["patient"]["allergy"] == "Penicillin" and detail["treatments"]

    rx = await http.post(f"/api/consultant/patients/{ravi_id}/prescriptions", headers=h, json={
        "diagnosis": "Post-operative pain", "meds": [{"drug": "Zerodol SP", "dose": "1 tablet", "freq": "BD", "days": "3"}],
        "advice": "Soft diet for two days."})
    assert rx.status_code == 201 and rx.json()["doctor"] == "Dr. Kumar" and rx.json()["code"].startswith("RX-")
    assert (await http.post(f"/api/consultant/patients/{ravi_id}/prescriptions", headers=h, json={"diagnosis": "No meds", "meds": []})).status_code == 422
    # the patient gets it in the app, with a notification
    ravi = bearer((await patient_login(http))["access_token"])
    theirs = (await http.get("/api/patient/prescriptions", headers=ravi)).json()["items"]
    assert any(p["diagnosis"] == "Post-operative pain" for p in theirs)
    assert any(n["kind"] == "prescription" for n in (await http.get("/api/patient/notifications", headers=ravi)).json()["items"])

    treatment = await http.post(f"/api/consultant/patients/{ravi_id}/treatments", headers=h, json={"name": "Composite filling", "tooth": "36", "cost": 1800})
    assert treatment.status_code == 201 and treatment.json()["doctor"] == "Dr. Kumar"

    mine = (await http.get(f"/api/consultant/appointments?date={day(0)}", headers=h)).json()["items"]
    open_one = next(a for a in mine if a["status"] == "Scheduled")
    done = await http.post(f"/api/consultant/appointments/{open_one['id']}/status", headers=h, json={"status": "Completed", "notes": "Done"})
    assert done.status_code == 200 and done.json()["status"] == "Completed"
    assert (await http.post(f"/api/consultant/appointments/{open_one['id']}/status", headers=h, json={"status": "Scheduled"})).status_code == 400

    earn = (await http.get(f"/api/consultant/earnings?date_from={day(-30)}&date_to={day(0)}", headers=h)).json()
    assert earn["billed"] > 0 and all(i["number"] for i in earn["items"])
    catalog = (await http.get("/api/consultant/catalog", headers=h)).json()
    assert catalog["medicines"] and catalog["treatments"]


async def test_unlinked_consultant_login_is_refused(http):
    # a Consultant role without a consultant profile cannot be created through the clinic API,
    # so simulate a broken link directly and check the portal refuses it.
    owner = await staff_headers(http, OWNER, "owner")
    gowtham = next(c for c in (await http.get("/api/consultants", headers=owner)).json()["items"] if c["name"] == "Dr. Gowtham")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Dr. Gowtham", "email": "gowtham@test.in", "password": "Consult#2026x", "role": "Consultant", "consultant_id": gowtham["id"]})
    assert made.status_code == 201
    await db.users.update_one({"email": "gowtham@test.in"}, {"$set": {"consultant_id": "000000000000000000000000"}})
    h = await staff_headers(http, ("gowtham@test.in", "Consult#2026x"), "consultant")
    assert (await http.get("/api/consultant/dashboard", headers=h)).status_code == 403


# ================================================================= owner API

async def test_owner_figures_match_the_ledger(http):
    owner = await staff_headers(http, OWNER, "owner")
    window = f"date_from={day(-60)}&date_to={day(0)}"
    overview = (await http.get(f"/api/owner/overview?{window}", headers=owner)).json()
    ledger = (await http.get("/api/invoices?limit=2000", headers=owner)).json()["items"]
    in_range = [i for i in ledger if day(-60) <= i["date"] <= day(0)]
    assert overview["billed"] == pytest.approx(sum(i["total"] for i in in_range))
    assert overview["outstanding"] == pytest.approx(sum(i["balance"] for i in ledger))
    assert overview["patients_total"] >= 8 and len(overview["series"]) == 61

    finance = (await http.get(f"/api/owner/finance?{window}", headers=owner)).json()
    assert sum(b["amount"] for b in finance["by_doctor"]) == pytest.approx(finance["billed"])
    assert sum(b["amount"] for b in finance["by_mode"]) == pytest.approx(finance["collected"])
    ops = (await http.get("/api/owner/operations", headers=owner)).json()
    assert ops["pharmacy_low"] and ops["lab"]["by_status"] and ops["reviews"]["total"] >= 12
    team = (await http.get("/api/owner/team", headers=owner)).json()
    assert {d["name"] for d in team["doctors"]} >= {"Dr. Kumar", "Dr. Anitha", "Dr. Gowtham"} and team["staff"]
    assert (await http.get(f"/api/owner/overview?date_from={day(0)}&date_to={day(-5)}", headers=owner)).status_code == 400


async def test_other_clinics_stay_invisible_to_every_role(http, super_headers):
    created = await http.post("/api/platform/clinics", headers=super_headers, json={
        "name": "Second Clinic", "city": "Elsewhere",
        "admin_name": "Second Owner", "admin_email": "second.owner@test.in", "admin_password": "SecondOwner#26"})
    assert created.status_code == 201, created.text
    second = await staff_login(http, ("second.owner@test.in", "SecondOwner#26"), "owner")  # first login is an owner
    assert second["user"]["role"] == "Clinic Owner"
    h2 = bearer(second["access_token"])
    theirs = (await http.get("/api/owner/overview", headers=h2)).json()
    assert theirs["billed"] == 0 and theirs["patients_total"] == 0
    assert (await http.get("/api/clinic/users", headers=h2)).json()["items"][0]["email"] == "second.owner@test.in"
    assert (await http.get("/api/owner/team", headers=h2)).json()["doctors"] == []

    # the demo patient cannot attach to the other clinic's data or book there with a foreign doctor
    ravi = bearer((await patient_login(http))["access_token"])
    assert (await http.post("/api/patient/profiles/select", headers=ravi, json={
        "patient_id": "000000000000000000000000", "clinic_id": created.json()["id"]})).status_code == 404
    # the demo consultant's token is pinned to the demo clinic even if a header asks for another
    kumar = await staff_headers(http, CONSULTANT, "consultant")
    spoofed = await http.get("/api/consultant/patients", headers={**kumar, "X-Clinic-Id": created.json()["id"]})
    assert spoofed.status_code == 200 and spoofed.json()["items"]  # still Dr. Kumar's own demo patients

    overview = (await http.get("/api/platform/overview", headers=super_headers)).json()
    assert overview["clinics"] >= 2 and overview["patient_app_accounts"] >= 1
    assert (await http.get("/api/platform/overview", headers=h2)).status_code == 403


async def test_app_activity_notifies_front_desk_and_owner(http):
    admin = await staff_headers(http, ADMIN)
    owner = await staff_headers(http, OWNER, "owner")
    kumar = await staff_headers(http, CONSULTANT, "consultant")
    await http.post("/api/notifications/read", headers=admin, json={})
    await http.post("/api/notifications/read", headers=owner, json={})

    ravi = bearer((await patient_login(http))["access_token"])
    cancelled_before = [n["title"] for n in (await http.get("/api/patient/notifications", headers=ravi)).json()["items"]].count("Appointment cancelled")
    booked = await http.post("/api/patient/appointments", headers=ravi,
                             json={"date": day(40), "time": "14:00", "doctor": "Dr. Kumar", "reason": "Follow-up"})
    assert booked.status_code == 201, booked.text
    await http.post(f"/api/patient/appointments/{booked.json()['id']}/cancel", headers=ravi, json={})
    await http.post("/api/patient/reviews", headers=ravi, json={"subject": "clinic", "rating": 4, "text": "Good visit overall."})

    desk = (await http.get("/api/notifications", headers=admin)).json()
    titles = [n["title"] for n in desk["items"] if not n["read"]]
    assert "New booking from the patient app" in titles and "Patient cancelled an appointment" in titles
    assert "New review awaiting approval" in titles  # administrators moderate reviews
    boss = [n["title"] for n in (await http.get("/api/notifications", headers=owner)).json()["items"] if not n["read"]]
    assert "New booking from the patient app" in boss and "New review awaiting approval" in boss
    # the consultant hears about their own appointment, not about reviews or other front-desk matters
    doc = [n["title"] for n in (await http.get("/api/notifications", headers=kumar)).json()["items"]]
    assert "New appointment" in doc and "New review awaiting approval" not in doc
    # the patient is not notified about actions they took themselves
    own = [n["title"] for n in (await http.get("/api/patient/notifications", headers=ravi)).json()["items"]]
    assert own.count("Appointment cancelled") == cancelled_before


# ------------------------------------------------- sessions end with the password

async def test_admin_password_reset_ends_the_persons_open_session_at_once(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Reset Target", "email": "reset.target@test.in", "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    session = await staff_login(http, ("reset.target@test.in", "FirstPass#2026"))
    theirs = bearer(session["access_token"])
    assert (await http.get("/api/patients", headers=theirs)).status_code == 200

    reset = await http.post(f"/api/clinic/users/{made.json()['id']}/reset-password", headers=owner,
                            json={"new_password": "SecondPass#2026"})
    assert reset.status_code == 200, reset.text
    # the session that was open before the reset is over, not merely unable to renew
    assert (await http.get("/api/patients", headers=theirs)).status_code == 401
    assert (await http.get("/api/auth/me", headers=theirs)).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401
    assert (await http.post("/api/auth/login", json={"email": "reset.target@test.in", "password": "FirstPass#2026"})).status_code == 401
    # the new password opens a working session, and the owner who did the reset is unaffected
    again = await staff_login(http, ("reset.target@test.in", "SecondPass#2026"))
    assert (await http.get("/api/patients", headers=bearer(again["access_token"]))).status_code == 200
    assert (await http.get("/api/clinic/users", headers=owner)).status_code == 200
    assert "sessions_valid_from" not in again["user"]
    assert all("sessions_valid_from" not in u for u in (await http.get("/api/clinic/users", headers=owner)).json()["items"])


async def test_changing_your_own_password_keeps_this_device_and_ends_the_others(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Two Devices", "email": "two.devices@test.in", "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    here = await staff_login(http, ("two.devices@test.in", "FirstPass#2026"))
    elsewhere = await staff_login(http, ("two.devices@test.in", "FirstPass#2026"))

    changed = await http.post("/api/auth/change-password", headers=bearer(here["access_token"]),
                              json={"current_password": "FirstPass#2026", "new_password": "SecondPass#2026"})
    assert changed.status_code == 200, changed.text
    # this device carries on with the pair it was just given
    assert (await http.get("/api/patients", headers=bearer(changed.json()["access_token"]))).status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": changed.json()["refresh_token"]})).status_code == 200
    # every token from before the change is dead, on this device and the other one
    assert (await http.get("/api/patients", headers=bearer(here["access_token"]))).status_code == 401
    assert (await http.get("/api/patients", headers=bearer(elsewhere["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": elsewhere["refresh_token"]})).status_code == 401


async def test_patient_password_reset_ends_the_open_app_session(http):
    mobile = "9000000177"
    session = await ensure_patient(http, mobile, "Session Person")
    old = bearer(session["access_token"])
    assert (await http.get("/api/patient/profiles", headers=old)).status_code == 200
    ticket = await otp_ticket(http, mobile, "reset")
    done = await http.post("/api/patient/auth/reset-password", json={"ticket": ticket, "new_password": "Brandnew456"})
    assert done.status_code == 200, done.text
    assert (await http.get("/api/patient/profiles", headers=old)).status_code == 401
    fresh = await patient_login(http, (mobile, "Brandnew456"))
    assert (await http.get("/api/patient/profiles", headers=bearer(fresh["access_token"]))).status_code == 200
    # changing it in the app keeps this session (new pair) and ends the old token
    changed = await http.post("/api/patient/account/change-password", headers=bearer(fresh["access_token"]),
                              json={"current_password": "Brandnew456", "new_password": "Secret123"})
    assert changed.status_code == 200, changed.text
    assert (await http.get("/api/patient/profiles", headers=bearer(fresh["access_token"]))).status_code == 401
    assert (await http.get("/api/patient/profiles", headers=bearer(changed.json()["access_token"]))).status_code == 200


async def test_super_admin_reset_and_deactivation_end_open_sessions(http, super_headers):
    owner = await staff_headers(http, OWNER, "owner")
    demo_id = (await http.get("/api/auth/me", headers=owner)).json()["clinic_id"]
    made = await http.post(f"/api/platform/clinics/{demo_id}/users", headers=super_headers, json={
        "name": "Platform Made", "email": "platform.made@test.in", "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code in (200, 201), made.text
    user_id = made.json()["id"]
    session = await staff_login(http, ("platform.made@test.in", "FirstPass#2026"))
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 200

    reset = await http.post(f"/api/platform/users/{user_id}/reset-password", headers=super_headers,
                            json={"new_password": "SecondPass#2026"})
    assert reset.status_code == 200, reset.text
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401

    again = await staff_login(http, ("platform.made@test.in", "SecondPass#2026"))
    off = await http.patch(f"/api/platform/users/{user_id}", headers=super_headers, json={"status": "Inactive"})
    assert off.status_code == 200, off.text
    assert (await http.get("/api/patients", headers=bearer(again["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": again["refresh_token"]})).status_code == 401
    # the super admin's own session is untouched by any of it
    assert (await http.get("/api/platform/overview", headers=super_headers)).status_code == 200


# --------------------------------------------------------- signing out a device

async def _fresh_receptionist(http, email: str) -> tuple[str, str]:
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Session Test", "email": email, "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    return email, "FirstPass#2026"


async def test_web_sign_out_ends_that_session_on_the_server(http):
    """The web app holds only the access token, so sign-out is by bearer token alone."""
    creds = await _fresh_receptionist(http, "signout.web@test.in")
    this_tab = await staff_login(http, creds)
    other_device = await staff_login(http, creds)
    assert (await http.get("/api/patients", headers=bearer(this_tab["access_token"]))).status_code == 200

    out = await http.post("/api/auth/logout", headers=bearer(this_tab["access_token"]), json={})
    assert out.status_code == 200 and out.json() == {"ok": True}
    # the token that was just signed out is refused everywhere, straight away
    assert (await http.get("/api/patients", headers=bearer(this_tab["access_token"]))).status_code == 401
    assert (await http.get("/api/auth/me", headers=bearer(this_tab["access_token"]))).status_code == 401
    assert (await http.get("/api/notifications", headers=bearer(this_tab["access_token"]))).status_code == 401
    # and the session cannot be renewed with the refresh token the web app never kept
    assert (await http.post("/api/auth/refresh", json={"refresh_token": this_tab["refresh_token"]})).status_code == 401
    # the same person's other device is untouched, and signing in again works
    assert (await http.get("/api/patients", headers=bearer(other_device["access_token"]))).status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": other_device["refresh_token"]})).status_code == 200
    again = await staff_login(http, creds)
    assert (await http.get("/api/patients", headers=bearer(again["access_token"]))).status_code == 200


async def test_app_sign_out_by_refresh_token_also_ends_the_access_token(http):
    """The mobile apps sign out with the refresh token and no bearer header."""
    session = await staff_login(http, OWNER, "owner")
    assert (await http.get("/api/owner/overview", headers=bearer(session["access_token"]))).status_code == 200
    out = await http.post("/api/auth/logout", json={"refresh_token": session["refresh_token"]})
    assert out.status_code == 200
    assert (await http.get("/api/owner/overview", headers=bearer(session["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401


async def test_sign_out_always_succeeds_and_never_ends_someone_elses_session(http):
    session = await staff_login(http, ADMIN)
    for kwargs in ({}, {"json": {}}, {"json": {"refresh_token": "not-a-token"}},
                   {"json": {}, "headers": bearer("garbage.token.value")}):
        assert (await http.post("/api/auth/logout", **kwargs)).status_code == 200
    # a token signed with another key names no session of ours
    from jose import jwt
    forged = jwt.encode({"sub": ADMIN[0], "sid": "anything", "exp": 4102444800}, "some-other-secret", algorithm="HS256")
    assert (await http.post("/api/auth/logout", headers=bearer(forged), json={})).status_code == 200
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 200
    # signing out twice is harmless
    assert (await http.post("/api/auth/logout", headers=bearer(session["access_token"]), json={})).status_code == 200
    assert (await http.post("/api/auth/logout", headers=bearer(session["access_token"]), json={})).status_code == 200
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 401


async def test_an_expired_access_token_can_still_close_its_session(http):
    from jose import jwt
    from app.auth import create_access_token

    session = await staff_login(http, ADMIN)
    sid = jwt.get_unverified_claims(session["access_token"])["sid"]
    expired = create_access_token(ADMIN[0], {"role": "Administrator", "sid": sid}, expires_minutes=-5)
    assert (await http.get("/api/patients", headers=bearer(expired))).status_code == 401
    assert (await http.post("/api/auth/logout", headers=bearer(expired), json={})).status_code == 200
    assert (await http.post("/api/auth/refresh", json={"refresh_token": session["refresh_token"]})).status_code == 401
    assert (await http.get("/api/patients", headers=bearer(session["access_token"]))).status_code == 401


async def test_a_session_keeps_its_identity_across_refresh(http):
    from jose import jwt

    first = await staff_login(http, CONSULTANT, "consultant")
    second = (await http.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})).json()
    third = (await http.post("/api/auth/refresh", json={"refresh_token": second["refresh_token"]})).json()
    sids = {jwt.get_unverified_claims(t["access_token"])["sid"] for t in (first, second, third)}
    assert len(sids) == 1
    assert len({first["refresh_token"], second["refresh_token"], third["refresh_token"]}) == 3
    # each refresh token works once
    assert (await http.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})).status_code == 401
    # ...and presenting a used one ends the whole session: the newest pair is dead too
    assert (await http.get("/api/consultant/me", headers=bearer(third["access_token"]))).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": third["refresh_token"]})).status_code == 401
    # a new sign-in is a new session
    fresh = await staff_login(http, CONSULTANT, "consultant")
    assert jwt.get_unverified_claims(fresh["access_token"])["sid"] not in sids
    assert (await http.get("/api/consultant/me", headers=bearer(fresh["access_token"]))).status_code == 200


async def test_patient_sign_out_and_profile_switch_stay_one_session(http):
    from jose import jwt

    session = await patient_login(http)
    sid = jwt.get_unverified_claims(session["access_token"])["sid"]
    profile = session["profile"]
    switched = await http.post("/api/patient/profiles/select", headers=bearer(session["access_token"]),
                               json={"clinic_id": profile["clinic_id"], "patient_id": profile["patient_id"]})
    assert switched.status_code == 200, switched.text
    # same session, new pair: the pair from before the switch can no longer be renewed
    assert jwt.get_unverified_claims(switched.json()["access_token"])["sid"] == sid
    active = (await http.get("/api/patient/profiles", headers=bearer(switched.json()["access_token"]))).json()["active"]
    assert set(active) == {"pid", "cid"}
    other_phone = await patient_login(http)

    out = await http.post("/api/auth/logout", json={"refresh_token": switched.json()["refresh_token"]})
    assert out.status_code == 200
    for token in (session["access_token"], switched.json()["access_token"]):
        assert (await http.get("/api/patient/home", headers=bearer(token))).status_code == 401
    for token in (session["refresh_token"], switched.json()["refresh_token"]):
        assert (await http.post("/api/auth/refresh", json={"refresh_token": token})).status_code == 401
    assert (await http.get("/api/patient/home", headers=bearer(other_phone["access_token"]))).status_code == 200


# ------------------------------------------------------ who may call which API

async def test_role_matrix_every_role_against_every_area(http, super_headers):
    """Representative reads in every API area, tried with every kind of login."""
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={
        "name": "Matrix Desk", "email": "matrix.desk@test.in", "password": "MatrixDesk#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    tokens = {
        "super admin": super_headers,
        "clinic owner": owner,
        "administrator": await staff_headers(http, ADMIN),
        "receptionist": await staff_headers(http, ("matrix.desk@test.in", "MatrixDesk#2026")),
        "consultant": await staff_headers(http, CONSULTANT, "consultant"),
        "patient": bearer((await patient_login(http))["access_token"]),
        "nobody": {},
    }
    demo_id = (await http.get("/api/auth/me", headers=owner)).json()["clinic_id"]
    # Each row: path, then the answer for each login in the order of `tokens`.
    # 400 for the super admin means "name a clinic first": it reaches clinic data only through
    # the X-Clinic-Id header, never by default.
    roles = list(tokens)
    assert roles == ["super admin", "clinic owner", "administrator", "receptionist", "consultant", "patient", "nobody"]
    table = {
        "/api/platform/overview":    (200, 403, 403, 403, 403, 403, 401),
        "/api/platform/clinics":     (200, 403, 403, 403, 403, 403, 401),
        "/api/clinic/users":         (400, 200, 200, 403, 403, 403, 401),
        "/api/owner/overview":       (400, 200, 200, 200, 403, 403, 401),
        "/api/owner/finance":        (400, 200, 200, 403, 403, 403, 401),
        "/api/owner/team":           (400, 200, 200, 403, 403, 403, 401),
        "/api/patients":             (400, 200, 200, 200, 403, 403, 401),
        "/api/invoices":             (400, 200, 200, 200, 403, 403, 401),
        "/api/appointments":         (400, 200, 200, 200, 403, 403, 401),
        "/api/settings":             (400, 200, 200, 200, 403, 403, 401),
        "/api/search?q=ravi":        (400, 200, 200, 200, 403, 403, 401),
        "/api/consultant/dashboard": (403, 403, 403, 403, 200, 403, 401),
        "/api/consultant/patients":  (403, 403, 403, 403, 200, 403, 401),
        "/api/patient/home":         (403, 403, 403, 403, 403, 200, 401),
        "/api/patient/invoices":     (403, 403, 403, 403, 403, 200, 401),
    }
    for path, expected in table.items():
        got = tuple([(await http.get(path, headers=tokens[role])).status_code for role in roles])
        assert got == expected, f"{path}: {dict(zip(roles, got))}"
    # the super admin, once it names the clinic, has the owner's reach in that clinic and no more
    as_clinic = {**super_headers, "X-Clinic-Id": demo_id}
    for path in ("/api/patients", "/api/clinic/users", "/api/owner/overview"):
        assert (await http.get(path, headers=as_clinic)).status_code == 200, path
    for path in ("/api/consultant/dashboard", "/api/patient/home"):
        assert (await http.get(path, headers=as_clinic)).status_code == 403, path
    # a clinic login cannot pick another clinic with the header
    other = await http.post("/api/platform/clinics", headers=super_headers, json={
        "name": "Matrix Other Clinic", "code": "MTX1", "admin_name": "Other Owner",
        "admin_email": "other.owner@matrix.in", "admin_password": "OtherOwner#2026"})
    assert other.status_code == 201, other.text
    other_id = other.json()["id"]
    mine = (await http.get("/api/patients", headers=owner)).json()["total"]
    crossed = await http.get("/api/patients", headers={**owner, "X-Clinic-Id": other_id})
    assert crossed.status_code == 200 and crossed.json()["total"] == mine and mine > 0
    theirs = await http.get("/api/patients", headers={**super_headers, "X-Clinic-Id": other_id})
    assert theirs.status_code == 200 and theirs.json()["total"] == 0
    # writes follow the same lines
    assert (await http.put("/api/settings", headers=tokens["receptionist"], json={"doubleBooking": True})).status_code == 403
    assert (await http.post("/api/clinic/users", headers=tokens["receptionist"], json={
        "name": "X", "email": "x@test.in", "password": "Xxxxxxx#2026", "role": "Receptionist"})).status_code == 403
    assert (await http.post("/api/patients", headers=tokens["consultant"], json={"name": "Nope", "mobile": "9000000999"})).status_code == 403
    assert (await http.post("/api/patients", headers=tokens["patient"], json={"name": "Nope", "mobile": "9000000999"})).status_code == 403


# ------------------------------------------------------------ clinic settings

async def test_changing_one_setting_leaves_the_others_alone(http):
    owner = await staff_headers(http, OWNER, "owner")
    admin = await staff_headers(http, ADMIN)
    before = (await http.get("/api/settings", headers=owner)).json()
    try:
        # two people change two different settings "at the same time"
        first, second = await asyncio.gather(
            http.patch("/api/settings", headers=owner, json={"values": {"doubleBooking": not before.get("doubleBooking", False)}}),
            http.patch("/api/settings", headers=admin, json={"values": {"partialPayments": not before.get("partialPayments", True)}}),
        )
        assert first.status_code == 200 and second.status_code == 200, first.text + second.text
        after = (await http.get("/api/settings", headers=owner)).json()
        assert after["doubleBooking"] == (not before.get("doubleBooking", False))
        assert after["partialPayments"] == (not before.get("partialPayments", True))
        # nothing else moved
        untouched = {k: v for k, v in before.items() if k not in ("doubleBooking", "partialPayments")}
        assert {k: after.get(k) for k in untouched} == untouched
        assert second.json()["values"]["partialPayments"] == after["partialPayments"]
        # names that are not plain setting names are refused, and nothing is written
        for bad in ({"values": {}}, {"values": {"a.b": 1}}, {"values": {"$set": 1}}, {"values": {"": True}}):
            assert (await http.patch("/api/settings", headers=owner, json=bad)).status_code == 400, bad
        assert (await http.get("/api/settings", headers=owner)).json() == after
    finally:
        restore = await http.put("/api/settings", headers=owner, json={"values": before})
        assert restore.status_code == 200
    assert (await http.get("/api/settings", headers=owner)).json() == before


async def test_only_clinic_admins_may_patch_settings(http):
    owner = await staff_headers(http, OWNER, "owner")
    await http.post("/api/clinic/users", headers=owner, json={
        "name": "Patch Desk", "email": "patch.desk@test.in", "password": "PatchDesk#2026", "role": "Receptionist"})
    desk = await staff_headers(http, ("patch.desk@test.in", "PatchDesk#2026"))
    consultant = await staff_headers(http, CONSULTANT, "consultant")
    patient = bearer((await patient_login(http))["access_token"])
    for who in (desk, consultant, patient):
        assert (await http.patch("/api/settings", headers=who, json={"values": {"doubleBooking": True}})).status_code == 403
    assert (await http.patch("/api/settings", json={"values": {"doubleBooking": True}})).status_code == 401


# ---------------------------------------------------------------- push delivery

async def _book_for_ravi(http, slot: str) -> None:
    admin = await staff_headers(http, ADMIN)
    made = await http.post("/api/appointments", headers=admin, json={
        "patient": "Ravi Kumar", "patientCode": "DEN-1001", "date": day(40), "time": slot,
        "treatment": "Review", "doctor": "Dr. Gowtham", "chair": "Chair 02", "status": "Scheduled"})
    assert made.status_code == 201, made.text


async def test_push_reaches_only_the_recipients_own_devices(http, monkeypatch):
    from app import notify

    sent: list[dict] = []
    monkeypatch.setattr(notify, "PUSH_PROVIDER", "webhook")
    monkeypatch.setattr(notify, "PUSH_WEBHOOK_URL", "https://push.example.test/send")
    monkeypatch.setattr(notify, "_send_webhook", sent.append)

    ravi = bearer((await patient_login(http))["access_token"])
    siva = bearer((await ensure_patient(http, "9876543211", "Siva Prakash"))["access_token"])
    owner = await staff_headers(http, OWNER, "owner")
    assert (await http.post("/api/patient/devices", headers=ravi, json={"token": "push-ravi", "platform": "android"})).status_code == 200
    assert (await http.post("/api/patient/devices", headers=siva, json={"token": "push-siva", "platform": "ios"})).status_code == 200
    assert (await http.post("/api/devices", headers=owner, json={"token": "push-owner", "platform": "ios"})).status_code == 200

    await _book_for_ravi(http, "16:00")
    for _ in range(100):  # delivery runs off the request path
        if any(p["title"] == "Appointment booked" for p in sent):
            break
        await asyncio.sleep(0.02)

    booked = [p for p in sent if p["title"] == "Appointment booked"]
    assert booked, sent
    assert booked[0]["devices"] == [{"token": "push-ravi", "platform": "android"}]
    assert booked[0]["data"]["screen"] == "appointment"
    everyone = [d["token"] for p in sent for d in p["devices"]]
    assert "push-siva" not in everyone and "push-owner" not in everyone

    # a signed-out device stops receiving
    assert (await http.post("/api/patient/devices/remove", headers=ravi, json={"token": "push-ravi"})).status_code == 200
    sent.clear()
    await _book_for_ravi(http, "16:30")
    await asyncio.sleep(0.2)
    assert not any(d["token"] == "push-ravi" for p in sent for d in p["devices"])
    for token in ("push-siva", "push-owner"):
        await db.device_tokens.delete_one({"token": token})


async def test_without_a_push_provider_nothing_leaves_the_server(http, monkeypatch):
    from app import notify

    sent: list[dict] = []
    monkeypatch.setattr(notify, "PUSH_PROVIDER", "")
    monkeypatch.setattr(notify, "_send_webhook", sent.append)
    ravi = bearer((await patient_login(http))["access_token"])
    before = (await http.get("/api/patient/notifications", headers=ravi)).json()["unread"]
    await http.post("/api/patient/devices", headers=ravi, json={"token": "push-ravi-2", "platform": "android"})
    await _book_for_ravi(http, "17:00")
    await asyncio.sleep(0.2)
    assert sent == []
    # the notification is still delivered in-app
    assert (await http.get("/api/patient/notifications", headers=ravi)).json()["unread"] == before + 1
    await db.device_tokens.delete_one({"token": "push-ravi-2"})

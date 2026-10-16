"""Sign-up with approval and password reset by email code (app/routers/onboarding.py)."""
from tests.test_apps import ADMIN, OWNER, bearer, staff_headers, staff_login

async def verified_ticket(http, email: str, purpose_path: str) -> str:
    sent = await http.post(f"/api/auth/{purpose_path}", json={"email": email})
    assert sent.status_code == 200, sent.text
    code = sent.json()["dev_code"]
    assert len(code) == 4  # the designs' four boxes
    verify = "/api/auth/signup/verify" if purpose_path == "signup/email" else "/api/auth/forgot/verify"
    wrong = await http.post(verify, json={"email": email, "code": "0000" if code != "0000" else "1111"})
    assert wrong.status_code == 400
    ok = await http.post(verify, json={"email": email, "code": code})
    assert ok.status_code == 200, ok.text
    return ok.json()["ticket"]


CLINIC_PROFILE = {
    "name": "Asha Rao", "dob": "1990-02-01", "mobile": "9845012345", "institution": "Govt Dental College",
    "graduation_year": "2013", "dci_number": "DCI-12345", "specialisation": "Prosthodontics",
    "door": "12", "street": "MG Road", "area": "Indiranagar", "pincode": "560038", "city": "Bengaluru",
    "state": "Karnataka", "country": "India", "clinic_name": "Asha Dental Studio",
}


async def test_clinic_applies_is_approved_and_signs_in(http, super_headers):
    email = "asha.applicant@test.in"
    ticket = await verified_ticket(http, email, "signup/email")
    # the form is checked before anything is stored
    bad = await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "clinic", "password": "Weak", "profile": CLINIC_PROFILE, "agreed": True})
    assert bad.status_code == 422
    no_terms = await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "clinic", "password": "AshaRao#2026", "profile": CLINIC_PROFILE})
    assert no_terms.status_code == 400
    applied = await http.post("/api/auth/signup", json={
        "ticket": ticket, "kind": "clinic", "password": "AshaRao#2026", "aadhaar": "5678 4321 9012", "profile": CLINIC_PROFILE, "agreed": True})
    assert applied.status_code == 201, applied.text
    # signing in before approval says so, but only with the right password
    pending = await http.post("/api/auth/login", json={"email": email, "password": "AshaRao#2026", "app": "owner"})
    assert pending.status_code == 403 and "being reviewed" in pending.json()["detail"]
    wrong = await http.post("/api/auth/login", json={"email": email, "password": "Wrong#2026x", "app": "owner"})
    assert wrong.status_code == 401, wrong.text
    # a ticket cannot be used as a sign-in
    assert (await http.get("/api/auth/me", headers=bearer(ticket))).status_code in (401, 403)
    # the super admin sees it, without the password and with only the last four Aadhaar digits
    sa = super_headers
    items = (await http.get("/api/platform/applications", headers=sa)).json()["items"]
    mine = next(a for a in items if a["email"] == email)
    assert "password_hash" not in mine and mine["aadhaar_last4"] == "9012" and "56784321" not in str(mine).replace(" ", "")
    # clinic staff cannot see or decide applications
    owner = await staff_headers(http, OWNER, "owner")
    assert (await http.get("/api/platform/applications", headers=owner)).status_code == 403
    assert (await http.post(f"/api/platform/applications/{mine['id']}/approve", headers=owner, json={})).status_code == 403
    approved = await http.post(f"/api/platform/applications/{mine['id']}/approve", headers=sa, json={})
    assert approved.status_code == 200, approved.text
    session = await staff_login(http, (email, "AshaRao#2026"), "owner")
    assert session["user"]["role"] == "Clinic Owner" and session["user"]["clinic"]["name"] == "Asha Dental Studio"
    assert (await http.post(f"/api/platform/applications/{mine['id']}/approve", headers=sa, json={})).status_code == 409
    status = (await http.post("/api/auth/signup/status", json={"email": email})).json()
    assert status["status"] == "Approved"


async def test_consultant_application_rejected_then_reason_shown(http, super_headers):
    email = "ravi.consultant.applicant@test.in"
    ticket = await verified_ticket(http, email, "signup/email")
    profile = {**CLINIC_PROFILE, "name": "Ravi Teja", "clinic_name": ""}
    assert (await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "consultant", "password": "RaviTeja#2026", "profile": profile, "agreed": True})).status_code == 201
    sa = super_headers
    app_id = next(a["id"] for a in (await http.get("/api/platform/applications", headers=sa)).json()["items"] if a["email"] == email)
    assert (await http.post(f"/api/platform/applications/{app_id}/approve", headers=sa, json={})).status_code == 400  # which clinic?
    assert (await http.post(f"/api/platform/applications/{app_id}/reject", headers=sa, json={"reason": ""})).status_code == 400
    assert (await http.post(f"/api/platform/applications/{app_id}/reject", headers=sa, json={"reason": "DCI certificate is missing"})).status_code == 200
    told = await http.post("/api/auth/login", json={"email": email, "password": "RaviTeja#2026", "app": "consultant"})
    assert told.status_code == 403 and "DCI certificate is missing" in told.json()["detail"]
    # they may apply again (the resend pause of the earlier code has passed by then)
    from datetime import datetime, timedelta, timezone
    from app.db import db
    await db.email_codes.update_many({"email": email}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=2)}})
    ticket = await verified_ticket(http, email, "signup/email")
    assert (await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "consultant", "password": "RaviTeja#2026", "profile": profile, "agreed": True})).status_code == 201
    app_id = next(a["id"] for a in (await http.get("/api/platform/applications", headers=sa)).json()["items"] if a["email"] == email)
    clinic_id = (await http.get("/api/auth/me", headers=await staff_headers(http, OWNER, "owner"))).json()["clinic_id"]
    assert (await http.post(f"/api/platform/applications/{app_id}/approve", headers=sa, json={"clinic_id": clinic_id})).status_code == 200
    session = await staff_login(http, (email, "RaviTeja#2026"), "consultant")
    me = (await http.get("/api/consultant/me", headers=bearer(session["access_token"]))).json()
    assert me["profile"]["name"] == "Ravi Teja" and me["profile"]["specialty"] == "Prosthodontics"


async def test_staff_password_reset_by_email_code(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={"name": "Forgetful", "email": "forgetful@test.in", "password": "FirstPass#2026", "role": "Receptionist"})
    assert made.status_code == 201
    old = await staff_login(http, ("forgetful@test.in", "FirstPass#2026"))
    # an unknown email gets the same answer and no code
    unknown = (await http.post("/api/auth/forgot", json={"email": "nobody.here@test.in"})).json()
    assert unknown["sent"] is True and "dev_code" not in unknown
    ticket = await verified_ticket(http, "forgetful@test.in", "forgot")
    assert (await http.post("/api/auth/forgot/reset", json={"ticket": ticket, "new_password": "weakweak"})).status_code == 400
    assert (await http.post("/api/auth/forgot/reset", json={"ticket": "nonsense", "new_password": "NewPass#2026"})).status_code == 400
    assert (await http.post("/api/auth/forgot/reset", json={"ticket": ticket, "new_password": "NewPass#2026"})).status_code == 200
    # the old session ends, the new password works and the old one does not
    assert (await http.get("/api/auth/me", headers=bearer(old["access_token"]))).status_code == 401
    await staff_login(http, ("forgetful@test.in", "NewPass#2026"))
    assert (await http.post("/api/auth/login", json={"email": "forgetful@test.in", "password": "FirstPass#2026"})).status_code == 401


async def test_patient_password_reset_by_email_code(http):
    from app.db import db
    from tests.test_apps import DEMO_PATIENT, patient_login
    await db.patient_accounts.update_one({"mobile": DEMO_PATIENT[0]}, {"$set": {"email": "ravi.patient@test.in"}})
    before = await patient_login(http)
    assert (await http.post("/api/patient/auth/email/forgot", json={"email": "no.such.patient@test.in"})).json() == {"sent": True, "length": 4}
    sent = (await http.post("/api/patient/auth/email/forgot", json={"email": "Ravi.Patient@test.in"})).json()
    ticket = (await http.post("/api/patient/auth/email/verify", json={"email": "ravi.patient@test.in", "code": sent["dev_code"]})).json()["ticket"]
    # a staff reset ticket is not a patient one, and the other way round
    assert (await http.post("/api/auth/forgot/reset", json={"ticket": ticket, "new_password": "NewPass#2026"})).status_code == 400
    assert (await http.post("/api/patient/auth/email/reset", json={"ticket": ticket, "new_password": "Patient@2027"})).status_code == 200
    assert (await http.get("/api/patient/home", headers=bearer(before["access_token"]))).status_code == 401
    await patient_login(http, (DEMO_PATIENT[0], "Patient@2027"))
    # put the demo account back for the tests that follow
    from app.auth import hash_password
    await db.patient_accounts.update_one({"mobile": DEMO_PATIENT[0]}, {"$set": {"password_hash": hash_password(DEMO_PATIENT[1])}, "$unset": {"email": ""}})


async def test_consultant_with_a_name_the_clinic_already_has_is_not_approved(http, super_headers):
    email = "kumar.twin@test.in"
    ticket = await verified_ticket(http, email, "signup/email")
    profile = {**CLINIC_PROFILE, "name": "Dr. Kumar", "mobile": "9845077788"}
    applied = await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "consultant", "password": "KumarTwin#2026", "profile": profile, "agreed": True})
    assert applied.status_code == 201, applied.text
    # Dr. Kumar is a consultant of the demo owner's clinic
    target = (await http.get("/api/auth/me", headers=await staff_headers(http, OWNER, "owner"))).json()["clinic_id"]
    refused = await http.post(f"/api/platform/applications/{applied.json()['id']}/approve", headers=super_headers, json={"clinic_id": target})
    assert refused.status_code == 409 and "already has a consultant named Dr. Kumar" in refused.json()["detail"]

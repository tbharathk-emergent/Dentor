"""Who may call what, per role, and that clinics never see each other's data.

Every role signs in once; each row says which roles the API lets through. "Let through" means the
answer is neither 401 nor 403 — a write sent with an empty body is refused by validation (400/422)
only after the role check, so no data is created by the matrix itself.
"""
import pytest

from tests.test_apps import ADMIN, CONSULTANT, OWNER, bearer, patient_login, staff_headers

PASSWORDS = {"Dentist": "Dentist#2026x", "Receptionist": "Reception#2026x", "Accountant": "Accounts#2026x", "Pharmacist": "Pharmacy#2026x"}
# the super admin, acting for a clinic it chose (X-Clinic-Id), passes every clinic role check
ALL_STAFF = {"owner", "admin", "dentist", "reception", "accountant", "pharmacist", "super"}
CLINIC_APP = {"owner", "admin", "dentist", "reception", "accountant", "super"}
FRONT_DESK = {"owner", "admin", "dentist", "reception", "super"}
CLINICAL = {"owner", "admin", "dentist", "super"}
FINANCE = {"owner", "admin", "accountant", "super"}
ADMINS = {"owner", "admin", "super"}
CONS = {"consultant"}
PAT = {"patient"}
SUPER = {"super"}

# (method, path, roles let through; the super admin is listed where it applies)
MATRIX = [
    ("GET", "/api/owner/overview", CLINIC_APP),
    ("GET", "/api/owner/finance", FINANCE),
    ("GET", "/api/owner/team", ADMINS),
    ("GET", "/api/clinic/users", ADMINS),
    ("PATCH", "/api/settings", ADMINS),
    ("GET", "/api/patients", ALL_STAFF),
    ("GET", "/api/appointments", ALL_STAFF),
    ("GET", "/api/clinic-app/appointments", CLINIC_APP),
    ("POST", "/api/clinic-app/appointments", FRONT_DESK),
    ("POST", "/api/clinic-app/patients", FRONT_DESK),
    ("GET", "/api/clinic-app/patients", CLINIC_APP),
    ("POST", "/api/clinic-app/consult/requests", FRONT_DESK),
    ("POST", "/api/clinic-app/prescriptions", CLINICAL),
    ("POST", "/api/clinic-app/certificates", CLINICAL),
    ("POST", "/api/clinic-app/rx/drugs", CLINICAL),
    ("POST", "/api/clinic-app/lab-orders", FRONT_DESK),
    ("POST", "/api/clinic-app/recall", FRONT_DESK),
    ("GET", "/api/clinic-app/lab-invoices", CLINIC_APP),
    ("GET", "/api/clinic-app/accounts/summary", FINANCE),
    ("GET", "/api/clinic-app/accounts/statement?date_from=2026-10-01&date_to=2026-10-02", FINANCE),
    ("GET", "/api/expenses", FINANCE),
    ("POST", "/api/expenses", FINANCE),
    ("POST", "/api/treatment_masters", ADMINS),
    ("GET", "/api/treatment_masters", ALL_STAFF),
    ("POST", "/api/labs", ADMINS),
    ("GET", "/api/engage/offers", ADMINS),
    ("POST", "/api/engage/offers", ADMINS),
    ("GET", "/api/engage/tickets", CLINIC_APP | CONS),
    ("GET", "/api/engage/chats", CLINIC_APP | CONS),
    ("GET", "/api/engage/inventory", CONS),  # the router admits clinic roles; the handler keeps it to consultants
    ("GET", "/api/consultant/me", CONS),
    ("GET", "/api/consultant/requests", CONS),
    ("PUT", "/api/consultant/availability", CONS),
    ("GET", "/api/platform/applications", SUPER),
    ("GET", "/api/platform/tickets", SUPER),
    ("GET", "/api/platform/clinics", SUPER),
    ("GET", "/api/patient/me", PAT),
    ("GET", "/api/patient/offers", PAT),
    ("POST", "/api/patient/callback", PAT),
]


@pytest.fixture()
async def tokens(http, super_headers):
    owner = await staff_headers(http, OWNER, "owner")
    out = {"owner": owner, "admin": await staff_headers(http, ADMIN), "super": super_headers}
    for role, password in PASSWORDS.items():
        email = f"matrix.{role.lower()}@test.in"
        made = await http.post("/api/clinic/users", headers=owner, json={"name": f"Matrix {role}", "email": email, "password": password, "role": role})
        assert made.status_code in (201, 409), made.text
        key = {"Dentist": "dentist", "Receptionist": "reception", "Accountant": "accountant", "Pharmacist": "pharmacist"}[role]
        out[key] = await staff_headers(http, (email, password))
    out["consultant"] = await staff_headers(http, CONSULTANT, "consultant")
    out["patient"] = bearer((await patient_login(http))["access_token"])
    return out


async def test_role_matrix(http, tokens):
    clinic_id = (await http.get("/api/auth/me", headers=tokens["owner"])).json()["clinic_id"]
    failures = []
    for method, path, allowed in MATRIX:
        for who, headers in tokens.items():
            h = dict(headers)
            if who == "super":
                h["X-Clinic-Id"] = clinic_id  # the super admin acts for a clinic it chose
            res = await http.request(method, path, headers=h, json={} if method != "GET" else None)
            let_through = res.status_code not in (401, 403)
            expected = who in allowed
            if let_through != expected:
                failures.append(f"{method} {path} as {who}: {res.status_code} (expected {'through' if expected else 'refused'})")
    assert not failures, "\n".join(failures)


async def test_handler_level_refusals(http, tokens):
    # roles the router admits, refused by the handler because the feature is someone else's
    assert (await http.get("/api/engage/inventory", headers=tokens["reception"])).status_code == 403
    assert (await http.post("/api/engage/jobs", headers=tokens["reception"], json={"kind": "hiring", "title": "Hiring", "description": "Two days a week."})).status_code == 403
    # money is hidden, not refused, on the overview for roles without it
    overview = (await http.get("/api/owner/overview", headers=tokens["dentist"])).json()
    assert overview["money"] is False and overview["billed"] is None
    dash = (await http.get(f"/api/clinic-app/patients/{(await http.get('/api/clinic-app/patients?q=DEN-1001', headers=tokens['dentist'])).json()['items'][0]['id']}", headers=tokens["dentist"])).json()
    assert dash["accounts"] is None
    # a patient token is never a staff token and the other way round
    assert (await http.get("/api/patients", headers=tokens["patient"])).status_code in (401, 403)
    assert (await http.get("/api/patient/me", headers=tokens["owner"])).status_code in (401, 403)


async def test_clinic_isolation(http, tokens, super_headers):
    sa = super_headers
    # a second clinic with its own owner and patient
    made = await http.post("/api/platform/clinics", headers=sa, json={
        "name": "Isolation Dental Test", "city": "Madurai", "phone": "9845000001", "email": "iso@test.in", "plan": "Standard",
        "admin_name": "Iso Owner", "admin_email": "iso.owner@test.in", "admin_password": "IsoOwner#2026", "admin_role": "Clinic Owner"})
    if made.status_code == 409:
        pass
    else:
        assert made.status_code in (200, 201), made.text
    other = await staff_headers(http, ("iso.owner@test.in", "IsoOwner#2026"), "owner")
    theirs = await http.post("/api/clinic-app/patients", headers=other, json={"name": "Isolated Person", "mobile": "9845000002", "allow_duplicate": True})
    assert theirs.status_code == 201, theirs.text
    their_id = theirs.json()["id"]
    ours = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=tokens["owner"])).json()["items"][0]
    # neither clinic can open, list or change the other's records
    assert (await http.get(f"/api/clinic-app/patients/{ours['id']}", headers=other)).status_code == 404
    assert (await http.get(f"/api/clinic-app/patients/{their_id}", headers=tokens["owner"])).status_code == 404
    assert (await http.get(f"/api/patients/{their_id}", headers=tokens["admin"])).status_code == 404
    assert (await http.patch(f"/api/patients/{their_id}", headers=tokens["admin"], json={"name": "Hijacked"})).status_code == 404
    assert not any(p["name"] == "Isolated Person" for p in (await http.get("/api/patients?q=Isolated", headers=tokens["admin"])).json()["items"])
    assert not any(p["code"] == "DEN-1001" and p["name"] == ours["name"] for p in (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=other)).json()["items"])
    # the clinic header is ignored for clinic users: a clinic user cannot switch clinics
    other_clinic = (await http.get("/api/auth/me", headers=other)).json()["clinic_id"]
    sneaky = await http.get(f"/api/clinic-app/patients/{their_id}", headers={**tokens["owner"], "X-Clinic-Id": other_clinic})
    assert sneaky.status_code == 404
    # tickets, chats and offers stay with their clinic
    assert not any(t["raised_by"] == "iso.owner@test.in" for t in (await http.get("/api/engage/tickets", headers=tokens["owner"])).json()["items"])
    assert (await http.get("/api/engage/offers", headers=other)).json()["items"] == [] or all(
        o.get("title") for o in (await http.get("/api/engage/offers", headers=other)).json()["items"])
    our_offers = {o["id"] for o in (await http.get("/api/engage/offers", headers=tokens["owner"])).json()["items"]}
    their_offers = {o["id"] for o in (await http.get("/api/engage/offers", headers=other)).json()["items"]}
    assert not our_offers & their_offers


async def test_deactivation_and_password_change_end_sessions(http, tokens):
    owner = tokens["owner"]
    email, password = "matrix.revoke@test.in", "Revoke#2026x"
    made = await http.post("/api/clinic/users", headers=owner, json={"name": "Revoke Me", "email": email, "password": password, "role": "Receptionist"})
    assert made.status_code in (201, 409)
    users = (await http.get("/api/clinic/users", headers=owner)).json()["items"]
    me = next(u for u in users if u["email"] == email)
    if me["status"] != "Active":
        await http.patch(f"/api/clinic/users/{me['id']}", headers=owner, json={"status": "Active"})
    session = await http.post("/api/auth/login", json={"email": email, "password": password, "app": "web"})
    assert session.status_code == 200, session.text
    token = bearer(session.json()["access_token"])
    refresh = session.json()["refresh_token"]
    assert (await http.get("/api/auth/me", headers=token)).status_code == 200
    # deactivating ends the session at once: the access token and the refresh token stop working
    assert (await http.patch(f"/api/clinic/users/{me['id']}", headers=owner, json={"status": "Inactive"})).status_code == 200
    assert (await http.get("/api/auth/me", headers=token)).status_code == 401
    assert (await http.post("/api/auth/refresh", json={"refresh_token": refresh})).status_code == 401
    assert (await http.post("/api/auth/login", json={"email": email, "password": password, "app": "web"})).status_code == 403

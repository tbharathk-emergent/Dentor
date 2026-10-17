"""Soft deletion of app logins ("Delete my account") and restore by a Super Admin (app/account_deletion.py).

Made-up numbers, emails and passwords only; everything created here is removed again.
"""
import pytest

from tests.test_apps import ADMIN, OWNER, bearer, patient_login, patient_signup, staff_headers

MOBILE = "9000000661"
STAFF_EMAIL = "deletion.tester@example.test"
STAFF_PASSWORD = "Deletion@2026x"
TEST_EMAIL, TEST_MOBILE, TEST_PASSWORD = "deletion.testlogin@example.test", "9000000662", "Testlogin1pass"
CODE_MOBILE = "9000000663"
CONSULTANT_EMAILS = ("deletion.consultant.one@example.test", "deletion.consultant.two@example.test")


@pytest.fixture(autouse=True)
async def clean(http):
    from app.db import db

    async def drop():
        await db.patient_accounts.delete_many({"$or": [{"mobile": MOBILE}, {"deleted_mobile": MOBILE}]})
        await db.patients.delete_many({"mobile": {"$regex": f"{MOBILE}$"}})
        await db.otp_codes.delete_many({"mobile": MOBILE})
        await db.users.delete_many({"$or": [{"email": STAFF_EMAIL}, {"deleted_email": STAFF_EMAIL}]})
        for m in (TEST_MOBILE, CODE_MOBILE):
            await db.patient_accounts.delete_many({"$or": [{"mobile": m}, {"deleted_mobile": m}]})
            await db.patients.delete_many({"mobile": {"$regex": f"{m}$"}})
            await db.otp_codes.delete_many({"mobile": m})
        await db.patient_accounts.delete_many({"deleted_email": TEST_EMAIL})
        for e in CONSULTANT_EMAILS:
            await db.users.delete_many({"$or": [{"email": e}, {"deleted_email": e}]})
    await drop()
    yield
    await drop()


async def join_demo(http, token):
    h = bearer(token)
    clinics = (await http.get("/api/patient/clinics", headers=h)).json()["items"]
    demo = next(c for c in clinics if c["name"] == "DENTOR Dental Clinic")
    joined = await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": demo["id"], "age": 33, "gender": "Female"})
    assert joined.status_code == 201, joined.text
    return joined.json()["profile"]["patient_id"]


async def test_patient_delete_hides_the_login_keeps_the_record_and_can_be_restored(http, super_headers):
    from app.db import db
    made = await patient_signup(http, MOBILE, "Deletion Tester")
    record_id = await join_demo(http, made["access_token"])
    h = bearer(made["access_token"])

    assert (await http.post("/api/patient/account/delete", headers=h, json={"password": "Wrong9pass"})).status_code == 400
    assert (await http.post("/api/patient/account/delete", headers=h, json={"password": "Secret123"})).status_code == 200
    # the login stops working at once: the open session, and a new sign-in
    assert (await http.get("/api/patient/profiles", headers=h)).status_code == 401
    assert (await http.post("/api/patient/auth/login", json={"identifier": MOBILE, "password": "Secret123"})).status_code == 401
    # nothing is wiped: the account is kept aside, and the clinic keeps its record
    account = await db.patient_accounts.find_one({"deleted_mobile": MOBILE})
    assert account["status"] == "Deleted" and account["mobile"] != MOBILE and account.get("deleted_at")
    from bson import ObjectId
    assert await db.patients.find_one({"_id": ObjectId(record_id)})

    listed = (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["patients"]
    entry = next(p for p in listed if p["mobile"] == MOBILE)
    restored = await http.post(f"/api/platform/deleted-accounts/patient/{entry['id']}/restore", headers=super_headers)
    assert restored.status_code == 200, restored.text
    back = await patient_login(http, (MOBILE, "Secret123"))
    assert record_id in {p["patient_id"] for p in back["profiles"]}
    assert MOBILE not in {p["mobile"] for p in (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["patients"]}


async def test_the_number_can_sign_up_again_and_then_the_old_login_is_not_restored(http, super_headers, monkeypatch):
    from app import otp
    monkeypatch.setattr(otp, "RESEND_COOLDOWN_SECONDS", 0)            # two sign-ups on one number in a row
    made = await patient_signup(http, MOBILE, "First Owner")
    await http.post("/api/patient/account/delete", headers=bearer(made["access_token"]), json={"password": "Secret123"})
    again = await patient_signup(http, MOBILE, "Second Owner")          # a fresh account on the same number
    assert again["account"]["name"] == "Second Owner"
    entry = next(p for p in (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["patients"] if p["mobile"] == MOBILE)
    refused = await http.post(f"/api/platform/deleted-accounts/patient/{entry['id']}/restore", headers=super_headers)
    assert refused.status_code == 409


async def test_staff_delete_hides_the_login_everywhere_and_can_be_restored(http, super_headers):
    admin = await staff_headers(http, ADMIN)
    made = await http.post("/api/clinic/users", headers=admin, json={"name": "Deletion Tester", "email": STAFF_EMAIL,
                                                                      "password": STAFF_PASSWORD, "role": "Receptionist"})
    assert made.status_code in (200, 201), made.text
    mine = await staff_headers(http, (STAFF_EMAIL, STAFF_PASSWORD))

    assert (await http.post("/api/auth/account/delete", headers=mine, json={"password": "Wrong9pass"})).status_code == 400
    assert (await http.post("/api/auth/account/delete", headers=mine, json={"password": STAFF_PASSWORD})).status_code == 200
    assert (await http.get("/api/auth/me", headers=mine)).status_code == 401
    assert (await http.post("/api/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD})).status_code in (400, 401)
    staff_list = (await http.get("/api/clinic/users", headers=admin)).json()["items"]
    assert STAFF_EMAIL not in {u["email"] for u in staff_list} and not any("deleted.invalid" in u["email"] for u in staff_list)

    entry = next(s for s in (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["staff"] if s["email"] == STAFF_EMAIL)
    assert entry["clinic"] == "DENTOR Dental Clinic" and entry["role"] == "Receptionist"
    assert (await http.post(f"/api/platform/deleted-accounts/staff/{entry['id']}/restore", headers=super_headers)).status_code == 200
    again = await staff_headers(http, (STAFF_EMAIL, STAFF_PASSWORD))
    assert (await http.get("/api/auth/me", headers=again)).status_code == 200


async def test_the_last_clinic_administrator_cannot_delete_their_login(http):
    from app.db import db
    from app.roles import CLINIC_ADMIN_ROLES
    owner = await staff_headers(http, OWNER, app="owner")
    me = await db.users.find_one({"email": OWNER[0]})
    # make the owner the only administrator for this test, then put the others back
    others = [u async for u in db.users.find({"clinic_id": me["clinic_id"], "role": {"$in": list(CLINIC_ADMIN_ROLES)}, "_id": {"$ne": me["_id"]}})]
    await db.users.update_many({"_id": {"$in": [u["_id"] for u in others]}}, {"$set": {"status": "Inactive"}})
    try:
        refused = await http.post("/api/auth/account/delete", headers=owner, json={"password": OWNER[1]})
        assert refused.status_code == 409 and "only administrator" in refused.json()["detail"]
        assert (await db.users.find_one({"email": OWNER[0]}))["status"] != "Deleted"
    finally:
        for u in others:
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"status": u.get("status", "Active")}})


async def test_a_super_admin_login_cannot_be_deleted_from_the_apps(http, super_headers):
    assert (await http.post("/api/auth/account/delete", headers=super_headers, json={"password": "x"})).status_code in (400, 403)


async def restart_api():
    """What a restart of the API runs at start-up (app/main.py lifespan), including the test-login sync."""
    from app.main import app, lifespan
    async with lifespan(app):
        pass


async def deleted_patients(http, super_headers) -> dict:
    return {p["id"]: p for p in (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["patients"]}


async def test_a_deleted_test_login_stays_deleted_and_listed_across_api_restarts(http, super_headers, monkeypatch):
    """Regression (bug A): the start-up sync turned deleted PATIENT_TEST_ACCOUNTS logins into "Disabled"."""
    from app import config
    from app.db import db
    accounts, _ = config.parse_test_accounts(f"{TEST_EMAIL}|{TEST_MOBILE}|{TEST_PASSWORD}")
    monkeypatch.setattr(config, "PATIENT_TEST_ACCOUNTS", accounts)
    await restart_api()
    token = (await http.post("/api/patient/auth/login", json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD})).json()["access_token"]
    assert (await http.post("/api/patient/account/delete", headers=bearer(token), json={"password": TEST_PASSWORD})).status_code == 200
    deleted_id = str((await db.patient_accounts.find_one({"deleted_mobile": TEST_MOBILE}))["_id"])

    for _ in range(2):
        await restart_api()
        assert (await db.patient_accounts.find_one({"deleted_mobile": TEST_MOBILE}))["status"] == "Deleted"
        assert deleted_id in await deleted_patients(http, super_headers)
    # the setting still lists the entry, so a fresh test login was made for it, and the old one cannot come back
    assert (await http.post("/api/patient/auth/login", json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD})).status_code == 200
    assert (await http.post(f"/api/platform/deleted-accounts/patient/{deleted_id}/restore", headers=super_headers)).status_code == 409

    # the entry removed: the fresh login is disabled; the deleted one is still "Deleted" and listed
    monkeypatch.setattr(config, "PATIENT_TEST_ACCOUNTS", [])
    await restart_api()
    assert (await db.patient_accounts.find_one({"mobile": TEST_MOBILE}))["status"] == "Disabled"
    assert (await db.patient_accounts.find_one({"deleted_mobile": TEST_MOBILE}))["status"] == "Deleted"
    assert deleted_id in await deleted_patients(http, super_headers)
    # and with nothing in its way it can be restored
    await db.patient_accounts.delete_many({"mobile": TEST_MOBILE})
    assert (await http.post(f"/api/platform/deleted-accounts/patient/{deleted_id}/restore", headers=super_headers)).status_code == 200


async def test_a_deleted_code_made_test_login_stays_deleted_across_api_restarts(http, super_headers, monkeypatch):
    """Regression (bug A), the other kind of test login: one made at the first code login on OTP_TEST_MOBILES."""
    from app import config
    from app.db import db
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [CODE_MOBILE])
    monkeypatch.setattr(config, "OTP_TEST_CODE", "123456")
    assert (await http.post("/api/patient/auth/otp/request", json={"mobile": CODE_MOBILE, "purpose": "login"})).status_code == 200
    ticket = (await http.post("/api/patient/auth/otp/verify", json={"mobile": CODE_MOBILE, "purpose": "login", "code": "123456"})).json()["ticket"]
    session = (await http.post("/api/patient/auth/login-otp", json={"ticket": ticket})).json()
    account = await db.patient_accounts.find_one({"mobile": CODE_MOBILE})
    # its password is random and unknown: set one the way a tester would (reset by code is also possible)
    from app.auth import hash_password
    await db.patient_accounts.update_one({"_id": account["_id"]}, {"$set": {"password_hash": hash_password("Codelogin1pass")}})
    assert (await http.post("/api/patient/account/delete", headers=bearer(session["access_token"]), json={"password": "Codelogin1pass"})).status_code == 200

    await restart_api()                                                          # number still listed
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [])
    monkeypatch.setattr(config, "OTP_TEST_CODE", "")
    await restart_api()                                                          # number no longer listed
    assert (await db.patient_accounts.find_one({"_id": account["_id"]}))["status"] == "Deleted"
    assert str(account["_id"]) in await deleted_patients(http, super_headers)


async def test_a_deleted_consultant_login_can_be_replaced_and_restore_refuses_while_the_replacement_exists(http, super_headers):
    """Regression (bug B): a deleted Consultant login kept its consultant profile for ever."""
    from app.db import db
    clinic = await db.clinics.find_one({"is_demo": True})
    cid = str(clinic["_id"])
    profiles = lambda: http.get(f"/api/platform/clinics/{cid}/consultants", headers=super_headers)
    doctor = next(c for c in (await profiles()).json()["items"] if not c["has_login"])
    first, second = CONSULTANT_EMAILS
    made = await http.post(f"/api/platform/clinics/{cid}/users", headers=super_headers, json={
        "name": "Deletion Consultant", "email": first, "password": "Consult#One2026", "role": "Consultant", "consultant_id": doctor["id"]})
    assert made.status_code in (200, 201), made.text
    h1 = bearer((await http.post("/api/auth/login", json={"email": first, "password": "Consult#One2026", "app": "consultant"})).json()["access_token"])
    assert (await http.post("/api/auth/account/delete", headers=h1, json={"password": "Consult#One2026"})).status_code == 200

    # the profile is free again: listed without a login, and the clinic can make a replacement login for it
    assert next(c for c in (await profiles()).json()["items"] if c["id"] == doctor["id"])["has_login"] is False
    admin = await staff_headers(http, ADMIN)
    replacement = await http.post("/api/clinic/users", headers=admin, json={
        "name": "Replacement Consultant", "email": second, "password": "Consult#Two2026", "role": "Consultant", "consultant_id": doctor["id"]})
    assert replacement.status_code in (200, 201), replacement.text
    assert next(c for c in (await profiles()).json()["items"] if c["id"] == doctor["id"])["has_login"] is True

    # restoring the deleted login now would give the doctor two logins: refused, nothing changed
    entry = next(s for s in (await http.get("/api/platform/deleted-accounts", headers=super_headers)).json()["staff"] if s["email"] == first)
    refused = await http.post(f"/api/platform/deleted-accounts/staff/{entry['id']}/restore", headers=super_headers)
    assert refused.status_code == 409 and "consultant" in refused.json()["detail"]
    assert (await db.users.find_one({"deleted_email": first}))["status"] == "Deleted"
    assert (await http.post("/api/auth/login", json={"email": second, "password": "Consult#Two2026", "app": "consultant"})).status_code == 200

    # once the replacement is deleted too, the first login can be restored and signs in again
    h2 = bearer((await http.post("/api/auth/login", json={"email": second, "password": "Consult#Two2026", "app": "consultant"})).json()["access_token"])
    assert (await http.post("/api/auth/account/delete", headers=h2, json={"password": "Consult#Two2026"})).status_code == 200
    assert (await http.post(f"/api/platform/deleted-accounts/staff/{entry['id']}/restore", headers=super_headers)).status_code == 200
    assert (await http.post("/api/auth/login", json={"email": first, "password": "Consult#One2026", "app": "consultant"})).status_code == 200

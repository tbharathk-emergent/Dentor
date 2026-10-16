"""Test patient logins from PATIENT_TEST_ACCOUNTS (app/test_accounts.py).

Made-up emails, numbers and passwords only. Every test sets the setting itself through monkeypatch, so it is off
for every other test, as it is by default.
"""
import logging

import pytest

from app import config
from app.test_accounts import SOURCE, sync_patient_test_accounts
from tests.test_apps import ADMIN, bearer, staff_headers

EMAIL, MOBILE, PASSWORD = "tester.one@example.test", "9000000881", "Tester1pass"
EMAIL2, MOBILE2, PASSWORD2 = "tester.two@example.test", "9000000882", "Tester2pass"


def configure(monkeypatch, raw: str):
    accounts, problem = config.parse_test_accounts(raw)
    assert problem is None, problem
    monkeypatch.setattr(config, "PATIENT_TEST_ACCOUNTS", accounts)


async def login(http, identifier, password):
    return await http.post("/api/patient/auth/login", json={"identifier": identifier, "password": password})


@pytest.fixture(autouse=True)
async def clean(http):
    from app.db import db

    async def drop():
        for m in (MOBILE, MOBILE2):
            await db.patients.delete_many({"mobile": {"$regex": f"{m}$"}})
            await db.otp_codes.delete_many({"mobile": m})
        await db.patient_accounts.delete_many({"$or": [{"mobile": {"$in": [MOBILE, MOBILE2]}}, {"email": {"$in": [EMAIL, EMAIL2]}}]})
    await drop()
    yield
    await drop()


async def test_off_by_default(http):
    from app.db import db
    assert config.PATIENT_TEST_ACCOUNTS == []
    assert await sync_patient_test_accounts(db) == {"ready": 0, "skipped": 0, "disabled": 0}


async def test_each_account_signs_in_with_its_email_or_mobile_and_password(http, monkeypatch, caplog):
    from app.db import db
    caplog.set_level(logging.DEBUG, logger="dentor")
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}; {EMAIL2.upper()}|{MOBILE2}|{PASSWORD2}")
    assert await sync_patient_test_accounts(db) == {"ready": 2, "skipped": 0, "disabled": 0}

    stored = await db.patient_accounts.find_one({"mobile": MOBILE})
    assert stored["email"] == EMAIL and stored["test_account"] is True and stored["test_source"] == SOURCE
    assert PASSWORD not in str(stored)                                   # only a hash is stored
    for identifier in (EMAIL, EMAIL.upper(), MOBILE, "+91 " + MOBILE):
        res = await login(http, identifier, PASSWORD)
        assert res.status_code == 200, (identifier, res.text)
    assert (await login(http, EMAIL2, PASSWORD2)).status_code == 200      # the email was stored in lower case
    # wrong or swapped passwords are refused; the fixed OTP is never a password
    assert (await login(http, EMAIL, PASSWORD2)).status_code == 401
    assert (await login(http, EMAIL, "123456")).status_code == 401
    # running again (every restart) changes nothing
    assert await sync_patient_test_accounts(db) == {"ready": 2, "skipped": 0, "disabled": 0}
    dentor_log = "\n".join(r.getMessage() for r in caplog.records if r.name == "dentor")
    for secret in (PASSWORD, PASSWORD2, EMAIL, MOBILE):
        assert secret not in dentor_log
    assert "******0881" in dentor_log


async def test_a_test_login_never_sees_a_real_patients_records(http, monkeypatch):
    from app.db import db
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}")
    await sync_patient_test_accounts(db)
    h = bearer((await login(http, EMAIL, PASSWORD)).json()["access_token"])
    clinics = (await http.get("/api/patient/clinics", headers=h)).json()["items"]
    demo = next(c for c in clinics if c["name"] == "DENTOR Dental Clinic")
    own = await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": demo["id"], "age": 30, "gender": "Female"})
    assert own.status_code == 201, own.text
    own_id = own.json()["profile"]["patient_id"]

    # the front desk later registers a real person with the same number
    real = await http.post("/api/patients", headers=await staff_headers(http, ADMIN),
                           json={"name": "Real Person", "mobile": MOBILE, "age": 50, "gender": "Male"})
    real_id = real.json()["id"]
    for identifier in (EMAIL, MOBILE):
        ids = {p["patient_id"] for p in (await login(http, identifier, PASSWORD)).json()["profiles"]}
        assert own_id in ids and real_id not in ids


async def test_skipped_when_the_email_or_number_belongs_to_a_real_patient(http, monkeypatch):
    from app.db import db
    from tests.test_apps import patient_signup
    await patient_signup(http, MOBILE, "Real App User")                    # a real account on the number
    await http.post("/api/patients", headers=await staff_headers(http, ADMIN),   # a staff record on the other number
                    json={"name": "Real Person", "mobile": MOBILE2, "age": 50, "gender": "Male"})
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}; {EMAIL2}|{MOBILE2}|{PASSWORD2}")
    assert await sync_patient_test_accounts(db) == {"ready": 0, "skipped": 2, "disabled": 0}
    real = await db.patient_accounts.find_one({"mobile": MOBILE})
    assert not real.get("test_account") and "email" not in real            # the real account is untouched
    assert (await login(http, MOBILE, PASSWORD)).status_code == 401
    assert await db.patient_accounts.find_one({"mobile": MOBILE2}) is None

    # an email already used by a real account is skipped too
    await db.patient_accounts.update_one({"mobile": MOBILE}, {"$set": {"email": EMAIL2}})
    await db.patients.delete_many({"mobile": {"$regex": f"{MOBILE2}$"}})
    configure(monkeypatch, f"{EMAIL2}|{MOBILE2}|{PASSWORD2}")
    assert await sync_patient_test_accounts(db) == {"ready": 0, "skipped": 1, "disabled": 0}
    assert (await login(http, EMAIL2, PASSWORD2)).status_code == 401


async def test_removed_entries_are_disabled_and_a_new_password_applies(http, monkeypatch):
    from app.db import db
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}; {EMAIL2}|{MOBILE2}|{PASSWORD2}")
    await sync_patient_test_accounts(db)
    session = (await login(http, EMAIL2, PASSWORD2)).json()

    # entry two removed, entry one gets a new password
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|Changed9pass")
    assert await sync_patient_test_accounts(db) == {"ready": 1, "skipped": 0, "disabled": 1}
    assert (await login(http, EMAIL2, PASSWORD2)).status_code == 403          # disabled
    assert (await http.get("/api/patient/profiles", headers=bearer(session["access_token"]))).status_code == 401
    assert (await login(http, EMAIL, PASSWORD)).status_code == 401
    assert (await login(http, EMAIL, "Changed9pass")).status_code == 200

    # setting removed entirely: all disabled; put back: enabled again
    configure(monkeypatch, "")
    assert await sync_patient_test_accounts(db) == {"ready": 0, "skipped": 0, "disabled": 1}
    assert (await login(http, EMAIL, "Changed9pass")).status_code == 403
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|Changed9pass")
    await sync_patient_test_accounts(db)
    assert (await login(http, MOBILE, "Changed9pass")).status_code == 200


async def test_with_the_fixed_code_the_same_account_also_logs_in_by_code(http, monkeypatch):
    from app.db import db
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}")
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [MOBILE])
    monkeypatch.setattr(config, "OTP_TEST_CODE", "123456")
    await sync_patient_test_accounts(db)
    assert (await http.post("/api/patient/auth/otp/request", json={"mobile": MOBILE, "purpose": "login"})).status_code == 200
    ticket = (await http.post("/api/patient/auth/otp/verify", json={"mobile": MOBILE, "purpose": "login", "code": "123456"})).json()["ticket"]
    res = await http.post("/api/patient/auth/login-otp", json={"ticket": ticket})
    assert res.status_code == 200 and res.json()["account"]["email"] == EMAIL


def test_setting_is_validated():
    parse = config.parse_test_accounts
    assert parse("") == ([], None)
    accounts, problem = parse(f" {EMAIL} | {MOBILE} | {PASSWORD} ;")
    assert problem is None and accounts == [{"email": EMAIL, "mobile": MOBILE, "password": PASSWORD}]
    assert "email|mobile|password" in parse(f"{EMAIL}|{MOBILE}")[1]
    assert "email|mobile|password" in parse(f"{EMAIL}|{MOBILE}|pa|ss1word")[1]
    assert "email is not valid" in parse(f"not-an-email|{MOBILE}|{PASSWORD}")[1]
    assert "10-digit" in parse(f"{EMAIL}|+91{MOBILE}|{PASSWORD}")[1]
    assert "8 characters" in parse(f"{EMAIL}|{MOBILE}|short1")[1]
    assert "8 characters" in parse(f"{EMAIL}|{MOBILE}|nodigitshere")[1]
    assert "twice" in parse(f"{EMAIL}|{MOBILE}|{PASSWORD};{EMAIL}|{MOBILE2}|{PASSWORD}")[1]
    assert "twice" in parse(f"{EMAIL}|{MOBILE}|{PASSWORD};{EMAIL2}|{MOBILE}|{PASSWORD}")[1]


def test_startup_refuses_a_malformed_setting(monkeypatch):
    monkeypatch.setattr(config, "_TEST_ACCOUNTS_PROBLEM", "PATIENT_TEST_ACCOUNTS entry 1: the email is not valid.")
    with pytest.raises(RuntimeError):
        config.validate_production_config()


async def test_console_shows_only_a_count(http, super_headers, monkeypatch):
    from app.db import db
    configure(monkeypatch, f"{EMAIL}|{MOBILE}|{PASSWORD}")
    await sync_patient_test_accounts(db)
    body = (await http.get("/api/platform/overview", headers=super_headers)).text
    assert '"patient_test_logins":1' in body.replace(" ", "")
    assert EMAIL not in body and MOBILE not in body and PASSWORD not in body

"""The fixed verification code for test mobile numbers (OTP_TEST_MOBILES / OTP_TEST_CODE).

Uses made-up numbers only. Every test sets the two settings itself through monkeypatch, so the feature is off for
every other test, as it is by default.
"""
import logging

import pytest

from app import config, otp
from tests.test_apps import ADMIN, bearer, staff_headers

TEST_MOBILE = "9000000777"   # made up; not used by any seeded patient
OTHER_MOBILE = "9000000778"
CODE = "123456"


def enable(monkeypatch, mobile=TEST_MOBILE, code=CODE):
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [mobile] if isinstance(mobile, str) else list(mobile))
    monkeypatch.setattr(config, "OTP_TEST_CODE", code)


async def request(http, mobile, purpose):
    return await http.post("/api/patient/auth/otp/request", json={"mobile": mobile, "purpose": purpose})


async def verify(http, mobile, purpose, code):
    return await http.post("/api/patient/auth/otp/verify", json={"mobile": mobile, "purpose": purpose, "code": code})


async def drop(http, *mobiles):
    from app.db import db
    for m in mobiles:
        await db.patient_accounts.delete_many({"mobile": m})
        await db.patients.delete_many({"mobile": {"$regex": f"{m}$"}})
        await db.otp_codes.delete_many({"mobile": m})


@pytest.fixture(autouse=True)
async def clean(http):
    await drop(http, TEST_MOBILE, OTHER_MOBILE)
    yield
    await drop(http, TEST_MOBILE, OTHER_MOBILE)


async def test_off_by_default(http):
    assert config.OTP_TEST_MOBILES == [] and config.OTP_TEST_CODE == ""
    assert otp.is_test_mobile(TEST_MOBILE) is False
    sent = await request(http, TEST_MOBILE, "signup")
    assert sent.status_code == 200 and sent.json()["dev_otp"] != ""      # the normal (development) path
    if sent.json()["dev_otp"] != CODE:
        assert (await verify(http, TEST_MOBILE, "signup", CODE)).status_code == 400


async def test_test_number_signs_up_and_logs_in_without_any_sms_gateway(http, monkeypatch, caplog):
    enable(monkeypatch)
    monkeypatch.setattr(otp, "SMS_PROVIDER", "")          # no gateway at all
    caplog.set_level(logging.DEBUG)
    # an ordinary number cannot get a code without a gateway
    assert (await request(http, OTHER_MOBILE, "signup")).status_code == 503

    sent = await request(http, TEST_MOBILE, "signup")
    assert sent.status_code == 200, sent.text
    assert set(sent.json()) == {"sent", "expires_in", "resend_in"}       # same answer as a real SMS: no code in it
    ticket = (await verify(http, TEST_MOBILE, "signup", CODE)).json()["ticket"]
    made = await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "Test Patient", "password": "Secret123"})
    assert made.status_code == 201, made.text
    from app.db import db
    assert (await db.patient_accounts.find_one({"mobile": TEST_MOBILE}))["test_account"] is True

    # code login with the same fixed code
    assert (await request(http, TEST_MOBILE, "login")).status_code == 200
    login_ticket = (await verify(http, TEST_MOBILE, "login", CODE)).json()["ticket"]
    session = await http.post("/api/patient/auth/login-otp", json={"ticket": login_ticket})
    assert session.status_code == 200, session.text
    assert (await http.get("/api/patient/profiles", headers=bearer(session.json()["access_token"]))).status_code == 200
    # never in the log
    assert CODE not in caplog.text
    assert "******0777" in caplog.text


async def test_every_configured_number_gets_the_fixed_code(http, monkeypatch):
    enable(monkeypatch, mobile=[TEST_MOBILE, OTHER_MOBILE])
    monkeypatch.setattr(otp, "SMS_PROVIDER", "")
    for mobile in (TEST_MOBILE, OTHER_MOBILE):
        assert (await request(http, mobile, "signup")).status_code == 200
        ticket = (await verify(http, mobile, "signup", CODE)).json()["ticket"]
        made = await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "Test Patient", "password": "Secret123"})
        assert made.status_code == 201, made.text
        assert (await request(http, mobile, "login")).status_code == 200
        login_ticket = (await verify(http, mobile, "login", CODE)).json()["ticket"]
        assert (await http.post("/api/patient/auth/login-otp", json={"ticket": login_ticket})).status_code == 200
    # a number that is not listed still needs a real SMS
    assert (await request(http, "9000000776", "signup")).status_code == 503


async def test_code_login_on_a_test_number_without_an_account_says_sign_up(http, monkeypatch):
    enable(monkeypatch)
    assert (await request(http, TEST_MOBILE, "login")).status_code == 200
    ticket = (await verify(http, TEST_MOBILE, "login", CODE)).json()["ticket"]
    res = await http.post("/api/patient/auth/login-otp", json={"ticket": ticket})
    assert res.status_code == 404 and "sign up" in res.json()["detail"]
    # a real number without an account still learns nothing: "sent", and no code is stored
    from app.db import db
    assert (await request(http, OTHER_MOBILE, "login")).json()["sent"] is True
    assert await db.otp_codes.count_documents({"mobile": OTHER_MOBILE}) == 0


async def test_wrong_code_is_refused_and_attempts_are_limited(http, monkeypatch):
    enable(monkeypatch)
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    for _ in range(otp.MAX_ATTEMPTS):
        res = await verify(http, TEST_MOBILE, "signup", "654321")
        assert res.status_code == 400 and CODE not in res.text
    # locked: even the right code is refused now
    assert (await verify(http, TEST_MOBILE, "signup", CODE)).status_code == 429


async def test_other_numbers_keep_random_codes_by_sms(http, monkeypatch):
    enable(monkeypatch)
    sent_messages = []
    monkeypatch.setattr(otp, "SMS_PROVIDER", "webhook")
    monkeypatch.setattr(otp, "SMS_WEBHOOK_URL", "https://sms.example.test/send")
    monkeypatch.setattr(otp, "_post_webhook", lambda mobile, message, purpose: sent_messages.append((mobile, message)))

    res = await request(http, OTHER_MOBILE, "signup")
    assert res.status_code == 200 and "dev_otp" not in res.json()
    assert len(sent_messages) == 1 and sent_messages[0][0] == OTHER_MOBILE
    real_code = sent_messages[0][1][:6]
    if real_code != CODE:                                   # 1 in a million it is the same by chance
        assert (await verify(http, OTHER_MOBILE, "signup", CODE)).status_code == 400
    assert (await verify(http, OTHER_MOBILE, "signup", real_code)).status_code == 200

    # and the test number sends nothing
    sent_messages.clear()
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    assert sent_messages == []


async def test_test_code_only_for_its_number(http, monkeypatch):
    enable(monkeypatch)
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    # the code was stored for TEST_MOBILE only: verifying another number with it fails
    assert (await verify(http, OTHER_MOBILE, "signup", CODE)).status_code == 400
    # a number that only ends like the test number is not the test number
    assert otp.is_test_mobile("19000000777") is False and otp.is_test_mobile("900000077") is False


async def test_never_for_fetch_link(http, monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(otp, "SMS_PROVIDER", "")
    # "link" falls back to the normal path, which needs a gateway: no fixed code is issued
    with pytest.raises(Exception) as refused:
        await otp.request_otp(__import__("app.db", fromlist=["db"]).db, TEST_MOBILE, "link")
    assert getattr(refused.value, "status_code", None) == 503


async def test_refused_for_a_staff_registered_number(http, monkeypatch, caplog):
    enable(monkeypatch)
    caplog.set_level(logging.DEBUG)
    admin = await staff_headers(http, ADMIN)
    made = await http.post("/api/patients", headers=admin, json={"name": "Real Person", "mobile": TEST_MOBILE, "age": 40, "gender": "Male"})
    assert made.status_code in (200, 201), made.text
    res = await request(http, TEST_MOBILE, "signup")
    assert res.status_code == 502
    assert "test" not in res.text.lower() and CODE not in res.text      # the answer gives nothing away
    assert CODE not in caplog.text


async def test_refused_for_a_real_account_on_the_number(http, monkeypatch):
    # someone signed up with a real SMS before the number was configured as the test number
    from tests.test_apps import patient_signup
    await patient_signup(http, TEST_MOBILE, "Earlier Real User")
    enable(monkeypatch)
    assert (await request(http, TEST_MOBILE, "login")).status_code == 502
    assert (await request(http, TEST_MOBILE, "reset")).status_code == 502


async def test_test_account_never_sees_staff_records_registered_later(http, monkeypatch):
    enable(monkeypatch)
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    ticket = (await verify(http, TEST_MOBILE, "signup", CODE)).json()["ticket"]
    made = (await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "Test Patient", "password": "Secret123"})).json()
    h = bearer(made["access_token"])
    clinics = (await http.get("/api/patient/clinics", headers=h)).json()["items"]
    demo = next(c for c in clinics if c["name"] == "DENTOR Dental Clinic")
    joined = await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": demo["id"], "age": 30, "gender": "Female"})
    assert joined.status_code == 201, joined.text
    own_id = joined.json()["profile"]["patient_id"]

    # later, the front desk registers a real person with the same number
    admin = await staff_headers(http, ADMIN)
    real = await http.post("/api/patients", headers=admin, json={"name": "Real Person", "mobile": TEST_MOBILE, "age": 52, "gender": "Male"})
    assert real.status_code in (200, 201), real.text
    real_id = real.json()["id"]

    # the test account (signed in with its password, no code needed) still only sees its own record
    from tests.test_apps import patient_login
    session = await patient_login(http, (TEST_MOBILE, "Secret123"))
    ids = {p["patient_id"] for p in session["profiles"]}
    assert own_id in ids and real_id not in ids
    hs = bearer(session["access_token"])
    picked = await http.post("/api/patient/profiles/select", headers=hs, json={"clinic_id": demo["id"], "patient_id": real_id})
    assert picked.status_code in (403, 404), picked.text
    # and the fixed code is now refused for this number
    assert (await request(http, TEST_MOBILE, "login")).status_code == 502
    # with the setting removed, the account is still restricted (flag on the account)
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [])
    monkeypatch.setattr(config, "OTP_TEST_CODE", "")
    session = await patient_login(http, (TEST_MOBILE, "Secret123"))
    assert real_id not in {p["patient_id"] for p in session["profiles"]}


async def test_test_account_never_sees_another_persons_app_record_moved_to_its_number(http, monkeypatch):
    # a real person signs up in the app on another number and registers with the clinic
    from tests.test_apps import patient_signup
    enable(monkeypatch)
    other = await patient_signup(http, OTHER_MOBILE, "Real App User")
    ho = bearer(other["access_token"])
    clinics = (await http.get("/api/patient/clinics", headers=ho)).json()["items"]
    demo = next(c for c in clinics if c["name"] == "DENTOR Dental Clinic")
    joined = await http.post("/api/patient/profiles/join", headers=ho, json={"clinic_id": demo["id"], "age": 41, "gender": "Male"})
    assert joined.status_code == 201, joined.text
    real_id = joined.json()["profile"]["patient_id"]

    # the test account signs up and registers too
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    ticket = (await verify(http, TEST_MOBILE, "signup", CODE)).json()["ticket"]
    h = bearer((await http.post("/api/patient/auth/signup", json={"ticket": ticket, "name": "Test Patient", "password": "Secret123"})).json()["access_token"])
    own = await http.post("/api/patient/profiles/join", headers=h, json={"clinic_id": demo["id"], "age": 30, "gender": "Female"})
    assert own.status_code == 201, own.text
    own_id = own.json()["profile"]["patient_id"]

    # the front desk moves the real person's app record to the test number, and tries to mark it as a test record
    admin = await staff_headers(http, ADMIN)
    moved = await http.patch(f"/api/patients/{real_id}", headers=admin, json={"mobile": TEST_MOBILE, "test_record": True})
    assert moved.status_code == 200, moved.text
    from app.db import db
    from bson import ObjectId
    stored = await db.patients.find_one({"_id": ObjectId(real_id)})
    assert stored["created_by"] == "patient-app" and "test_record" not in stored
    made = await http.post("/api/patients", headers=admin, json={"name": "Marked By Staff", "mobile": OTHER_MOBILE, "age": 33,
                                                                 "gender": "Male", "test_record": True})
    assert "test_record" not in (await db.patients.find_one({"_id": ObjectId(made.json()["id"])}))

    from tests.test_apps import patient_login
    session = await patient_login(http, (TEST_MOBILE, "Secret123"))
    ids = {p["patient_id"] for p in session["profiles"]}
    assert own_id in ids and real_id not in ids
    picked = await http.post("/api/patient/profiles/select", headers=bearer(session["access_token"]),
                             json={"clinic_id": demo["id"], "patient_id": real_id})
    assert picked.status_code in (403, 404), picked.text
    assert (await request(http, TEST_MOBILE, "login")).status_code == 502


async def test_rate_limits_still_apply(http, monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(otp, "RESEND_COOLDOWN_SECONDS", 0)
    for _ in range(otp.OTP_MAX_PER_HOUR):
        assert (await request(http, TEST_MOBILE, "signup")).status_code == 200
    assert (await request(http, TEST_MOBILE, "signup")).status_code == 429


def test_settings_are_validated():
    problem = config.otp_test_settings_problem
    assert problem([], "") is None
    assert problem([TEST_MOBILE], CODE) is None
    assert problem([TEST_MOBILE, OTHER_MOBILE], CODE) is None
    assert "together" in problem([TEST_MOBILE], "")
    assert "together" in problem([], CODE)
    assert "6 digits" in problem([TEST_MOBILE], "12345")
    assert "6 digits" in problem([TEST_MOBILE], "12a456")
    assert "10-digit" in problem(["900000077"], CODE)
    assert "10-digit" in problem(["+919000000777"], CODE)
    assert "10-digit" in problem([TEST_MOBILE, "90000 00778"], CODE)
    assert "twice" in problem([TEST_MOBILE, TEST_MOBILE], CODE)
    assert "at most" in problem([f"90000{n:05d}" for n in range(21)], CODE)
    assert config.parse_test_mobiles(" 9000000777, 9000000778 ,") == [TEST_MOBILE, OTHER_MOBILE]


def test_startup_refuses_half_set(monkeypatch):
    monkeypatch.setattr(config, "OTP_TEST_MOBILES", [TEST_MOBILE])
    monkeypatch.setattr(config, "OTP_TEST_CODE", "")
    with pytest.raises(RuntimeError):
        config.validate_production_config()


async def test_console_shows_only_the_masked_number(http, super_headers, monkeypatch):
    status = (await http.get("/api/platform/overview", headers=super_headers)).json()["integrations"]
    assert status["otp_test_mobiles"] is None
    enable(monkeypatch)
    body = (await http.get("/api/platform/overview", headers=super_headers)).text
    assert '"otp_test_mobiles":["******0777"]' in body.replace(" ", "")
    assert TEST_MOBILE not in body and CODE not in body

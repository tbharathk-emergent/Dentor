"""Fingerprint sign-in: a per-device secret released by the phone's biometric check (app/device_credentials.py)."""
from tests.test_apps import DEMO_PATIENT, OWNER, bearer, patient_login, staff_headers, staff_login


async def test_staff_fingerprint_sign_in(http):
    owner = await staff_headers(http, OWNER, "owner")
    made = await http.post("/api/clinic/users", headers=owner, json={"name": "Thumb", "email": "thumb@test.in", "password": "ThumbPass#2026", "role": "Receptionist"})
    assert made.status_code == 201, made.text
    session = await staff_login(http, ("thumb@test.in", "ThumbPass#2026"), "owner")
    me = bearer(session["access_token"])
    # nothing is enrolled yet
    assert (await http.post("/api/auth/device/login", json={"device_id": "x", "secret": "y", "app": "owner"})).status_code == 401
    assert (await http.post("/api/auth/device/enroll", json={"device_name": "Pixel"})).status_code == 401
    cred = (await http.post("/api/auth/device/enroll", headers=me, json={"device_name": "Pixel"})).json()
    assert set(cred) == {"device_id", "secret"} and len(cred["secret"]) >= 40
    ok = await http.post("/api/auth/device/login", json={**cred, "app": "owner", "device": "Pixel"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["user"]["email"] == "thumb@test.in" and ok.json()["refresh_token"]
    # a wrong secret and the wrong app are refused; the app rules still apply
    assert (await http.post("/api/auth/device/login", json={**cred, "secret": cred["secret"][:-1] + ("B" if cred["secret"].endswith("A") else "A"), "app": "owner"})).status_code == 401
    assert (await http.post("/api/auth/device/login", json={**cred, "app": "consultant"})).status_code == 403
    # only the hash is stored
    from app.db import db
    stored = await db.device_credentials.find_one({"device_id": cred["device_id"]})
    assert cred["secret"] not in str(stored)
    # turning it off ends it
    assert (await http.post("/api/auth/device/revoke", headers=me, json={"device_id": cred["device_id"]})).status_code == 200
    assert (await http.post("/api/auth/device/login", json={**cred, "app": "owner"})).status_code == 401
    # a password change ends every fingerprint sign-in made before it
    again = (await http.post("/api/auth/device/enroll", headers=me, json={"device_name": "Pixel"})).json()
    changed = await http.post("/api/auth/change-password", headers=me, json={"current_password": "ThumbPass#2026", "new_password": "ThumbPass#2027"})
    assert changed.status_code == 200, changed.text
    stale = await http.post("/api/auth/device/login", json={**again, "app": "owner"})
    assert stale.status_code == 401 and "password changed" in stale.json()["detail"]
    # and a deactivated login cannot use one made afterwards
    me = bearer((await staff_login(http, ("thumb@test.in", "ThumbPass#2027"), "owner"))["access_token"])
    third = (await http.post("/api/auth/device/enroll", headers=me, json={})).json()
    login_id = made.json()["id"]
    assert (await http.patch(f"/api/clinic/users/{login_id}", headers=owner, json={"status": "Inactive"})).status_code == 200
    assert (await http.post("/api/auth/device/login", json={**third, "app": "owner"})).status_code in (401, 403)


async def test_patient_fingerprint_sign_in(http):
    session = await patient_login(http)
    me = bearer(session["access_token"])
    cred = (await http.post("/api/patient/auth/device/enroll", headers=me, json={"device_name": "iPhone"})).json()
    ok = await http.post("/api/patient/auth/device/login", json=cred)
    assert ok.status_code == 200, ok.text
    assert ok.json()["access_token"]
    # a staff fingerprint secret is not a patient one, and the other way round
    assert (await http.post("/api/auth/device/login", json={**cred, "app": "web"})).status_code == 401
    assert (await http.post("/api/patient/auth/device/revoke", headers=me, json={"device_id": cred["device_id"]})).status_code == 200
    assert (await http.post("/api/patient/auth/device/login", json=cred)).status_code == 401
    # a password change ends it; put the demo password back afterwards
    cred = (await http.post("/api/patient/auth/device/enroll", headers=me, json={})).json()
    changed = await http.post("/api/patient/account/change-password", headers=me, json={"current_password": DEMO_PATIENT[1], "new_password": "Patient@2027x"})
    assert changed.status_code == 200, changed.text
    assert (await http.post("/api/patient/auth/device/login", json=cred)).status_code == 401
    me = bearer(changed.json()["access_token"])
    back = await http.post("/api/patient/account/change-password", headers=me, json={"current_password": "Patient@2027x", "new_password": DEMO_PATIENT[1]})
    assert back.status_code == 200, back.text

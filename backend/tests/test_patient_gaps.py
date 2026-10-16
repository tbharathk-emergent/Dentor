"""Patient app gaps: fetch a record by patient id, notification settings, callback, case summary, offers (patient_portal.py)."""
from tests.test_apps import DEMO_PATIENT, bearer, patient_login
from tests.test_clinic_app import logins


async def test_fetch_a_record_registered_under_another_number(http):
    owner, reception, _ = await logins(http)
    child = (await http.post("/api/clinic-app/patients", headers=reception, json={"name": "Little Ravi", "mobile": "9845011223", "allow_duplicate": True})).json()
    session = await patient_login(http)
    me = bearer(session["access_token"])
    clinic_id = session["profiles"][0]["clinic_id"]
    assert (await http.post("/api/patient/profiles/fetch", headers=me, json={"clinic_id": clinic_id, "patient_code": "DEN-99999"})).status_code == 404
    # my own record is already mine
    assert (await http.post("/api/patient/profiles/fetch", headers=me, json={"clinic_id": clinic_id, "patient_code": "DEN-1001"})).status_code == 409
    sent = (await http.post("/api/patient/profiles/fetch", headers=me, json={"clinic_id": clinic_id, "patient_code": child["code"]})).json()
    assert sent["sent_to"] == "******1223" and "Little" not in str(sent)
    wrong = "000000" if sent.get("dev_otp") != "000000" else "111111"
    assert (await http.post("/api/patient/profiles/fetch/verify", headers=me, json={"clinic_id": clinic_id, "patient_code": child["code"], "code": wrong})).status_code == 400
    linked = await http.post("/api/patient/profiles/fetch/verify", headers=me, json={"clinic_id": clinic_id, "patient_code": child["code"], "code": sent["dev_otp"]})
    assert linked.status_code == 201, linked.text
    assert any(p["code"] == child["code"] for p in linked.json()["profiles"])
    # the new tokens open the fetched record
    them = bearer(linked.json()["access_token"])
    assert (await http.get("/api/patient/me", headers=them)).json()["profile"]["code"] == child["code"]
    # back to the demo patient's own record (the account remembers the last profile used)
    own = next(p for p in linked.json()["profiles"] if p["code"] == "DEN-1001")
    assert (await http.post("/api/patient/profiles/select", headers=them, json={"clinic_id": own["clinic_id"], "patient_id": own["patient_id"]})).status_code == 200


async def test_prefs_callback_case_summary(http):
    session = await patient_login(http)
    me = bearer(session["access_token"])
    prefs = (await http.get("/api/patient/account/prefs", headers=me)).json()
    assert prefs["appointment_reminders"] is True
    saved = (await http.put("/api/patient/account/prefs", headers=me, json={**prefs, "medicine_alerts": False})).json()
    assert saved["medicine_alerts"] is False
    from app.notify import patient_wants
    assert not patient_wants(saved, "prescription") and patient_wants(saved, "appointment") and not patient_wants({"general": False}, "appointment")
    await http.put("/api/patient/account/prefs", headers=me, json={**prefs})
    first = await http.post("/api/patient/callback", headers=me, json={"when": "after 5 pm", "note": "About my RCT"})
    assert first.status_code in (201, 409)
    assert (await http.post("/api/patient/callback", headers=me, json={})).status_code == 409
    owner, reception, accountant = await logins(http)
    open_ = (await http.get("/api/clinic-app/callbacks", headers=accountant)).json()["items"]
    mine = next(c for c in open_ if c["patient_code"] == "DEN-1001")
    assert (await http.post(f"/api/clinic-app/callbacks/{mine['id']}/done", headers=accountant)).status_code == 403
    assert (await http.post(f"/api/clinic-app/callbacks/{mine['id']}/done", headers=reception)).status_code == 200
    assert (await http.post(f"/api/clinic-app/callbacks/{mine['id']}/done", headers=reception)).status_code == 404
    past = [a for a in (await http.get("/api/patient/appointments?scope=past", headers=me)).json()["items"] if a["status"] == "Completed"]
    if past:
        detail = (await http.get(f"/api/patient/appointments/{past[0]['id']}", headers=me)).json()
        assert "case" in detail and "medicines" in detail["case"]

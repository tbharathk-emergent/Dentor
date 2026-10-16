"""Clinic app appointments and patients (app/routers/clinic_app.py)."""
from datetime import date, timedelta

from tests.test_apps import ADMIN, OWNER, bearer, staff_headers

ACCOUNTANT = ("acc.clinicapp@test.in", "Accounts#2026")
RECEPTION = ("rec.clinicapp@test.in", "Reception#2026")


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


async def logins(http):
    owner = await staff_headers(http, OWNER, "owner")
    for email, password, role in ((*ACCOUNTANT, "Accountant"), (*RECEPTION, "Receptionist")):
        made = await http.post("/api/clinic/users", headers=owner, json={"name": role, "email": email, "password": password, "role": role})
        assert made.status_code in (201, 409), made.text
    return owner, await staff_headers(http, RECEPTION, "owner"), await staff_headers(http, ACCOUNTANT, "owner")


async def free_slot(http, headers, doctor: str, offset: int = 20) -> tuple[str, str]:
    for extra in range(30):
        d = day(offset + extra)
        slots = (await http.get(f"/api/clinic-app/slots?date={d}&doctor={doctor}", headers=headers)).json()["slots"]
        free = [s["time"] for s in slots if s["available"]]
        if free:
            return d, free[-1]
    raise AssertionError("no free slot")


async def test_patients_add_find_and_dashboard(http):
    owner, reception, accountant = await logins(http)
    bad = await http.post("/api/clinic-app/patients", headers=reception, json={"name": "A", "mobile": "12345"})
    assert bad.status_code == 400
    assert (await http.post("/api/clinic-app/patients", headers=reception, json={"name": "Meera Test", "mobile": "9845066778", "bp": "high"})).status_code == 400
    assert (await http.post("/api/clinic-app/patients", headers=reception, json={"name": "Meera Test", "mobile": "9845066778", "dob": "2999-01-01"})).status_code == 400
    made = await http.post("/api/clinic-app/patients", headers=reception, json={
        "name": "Meera Test", "mobile": "98450 66778", "dob": "1997-03-04", "gender": "Female", "blood": "O+", "visit_reason": "Bleeding gums",
        "bp": "120/80", "glucose": "110", "insurance_company": "Star Health", "insurance_policy": "SH-1"})
    assert made.status_code == 201, made.text
    patient = made.json()
    assert patient["code"].startswith("DEN-") and patient["mobile"] == "9845066778"
    dup = await http.post("/api/clinic-app/patients", headers=reception, json={"name": "meera test", "mobile": "9845066778"})
    assert dup.status_code == 409 and patient["code"] in dup.json()["detail"]
    # an accountant reads but cannot add
    assert (await http.post("/api/clinic-app/patients", headers=accountant, json={"name": "X Y", "mobile": "9845066779"})).status_code == 403
    found = (await http.get("/api/clinic-app/patients?q=Meera", headers=accountant)).json()
    assert any(p["id"] == patient["id"] for p in found["items"]) and found["figures"]["total"] >= 1
    # the reception web app sees the same record
    web = await staff_headers(http, ADMIN)
    assert any(p["code"] == patient["code"] for p in (await http.get("/api/patients?q=Meera", headers=web)).json()["items"])
    # money in the dashboard only for roles that may see it
    dash = (await http.get(f"/api/clinic-app/patients/{patient['id']}", headers=reception)).json()
    assert dash["profile"]["vitals"] == {"bp": "120/80", "glucose": "110"} and dash["profile"]["insurance"]["company"] == "Star Health"
    assert isinstance(dash["profile"]["age"], int) and dash["profile"]["age"] >= 29 and dash["profile"]["visitReason"] == "Bleeding gums"
    assert dash["accounts"] is None and dash["money"] is False and dash["can_change"] is True
    dash = (await http.get(f"/api/clinic-app/patients/{patient['id']}", headers=accountant)).json()
    assert dash["accounts"]["balance"] == 0 and dash["can_change"] is False
    demo = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=owner)).json()["items"][0]
    full = (await http.get(f"/api/clinic-app/patients/{demo['id']}", headers=owner)).json()
    assert full["accounts"]["invoices"] and full["clinical"]["treatments"] and sum(full["appointments"]["counts"].values()) > 0
    assert full["tiles"]["prescriptions"] >= 1 and full["tiles"]["imaging"] >= 1


async def test_book_reschedule_swap_cancel_and_drafts(http):
    owner, reception, accountant = await logins(http)
    patient = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=owner)).json()["items"][0]
    doctors = (await http.get("/api/clinic-app/doctors", headers=reception)).json()["items"]
    doctor = next(d["name"] for d in doctors if d["kind"] == "in-house")
    d, t = await free_slot(http, reception, doctor)
    # validation and roles
    assert (await http.post("/api/clinic-app/appointments", headers=reception, json={"patient_id": patient["id"], "doctor": doctor, "date": d, "time": "10:15"})).status_code == 400
    assert (await http.post("/api/clinic-app/appointments", headers=accountant, json={"patient_id": patient["id"], "doctor": doctor, "date": d, "time": t})).status_code == 403
    booked = await http.post("/api/clinic-app/appointments", headers=reception, json={"patient_id": patient["id"], "doctor": doctor, "date": d, "time": t, "treatment": "Scaling"})
    assert booked.status_code == 201, booked.text
    a = booked.json()
    assert a["status"] == "Scheduled" and a["kind"] == "in-house" and a["source"] == "Clinic App"
    # the slot is now taken for that doctor
    again = await http.post("/api/clinic-app/appointments", headers=reception, json={"patient_id": patient["id"], "doctor": doctor, "date": d, "time": t})
    assert again.status_code == 409
    slots = (await http.get(f"/api/clinic-app/slots?date={d}&doctor={doctor}", headers=reception)).json()["slots"]
    assert not next(s for s in slots if s["time"] == t)["available"]
    # listed under upcoming and on the month view
    up = (await http.get("/api/clinic-app/appointments?scope=upcoming&kind=in-house&q=Scaling", headers=accountant)).json()
    assert any(x["id"] == a["id"] for x in up["items"])
    assert (await http.get(f"/api/clinic-app/appointments/month?month={d[:7]}", headers=reception)).json()["days"].get(d, 0) >= 1
    # detail with the case summary
    detail = (await http.get(f"/api/clinic-app/appointments/{a['id']}", headers=reception)).json()
    assert detail["patient_record"]["code"] == "DEN-1001" and detail["can_change"] is True
    # reschedule needs a reason and a free slot
    d2, t2 = await free_slot(http, reception, doctor, 25)
    assert (await http.post(f"/api/clinic-app/appointments/{a['id']}/reschedule", headers=reception, json={"date": d2, "time": t2})).status_code == 400
    moved = await http.post(f"/api/clinic-app/appointments/{a['id']}/reschedule", headers=reception, json={"date": d2, "time": t2, "reason": "Patient travelling"})
    assert moved.status_code == 200, moved.text
    assert moved.json()["date"] == d2 and moved.json()["reschedule_reason"] == "Patient travelling"
    assert moved.json()["rescheduled_from"]["date"] == d and moved.json()["rescheduled_from"]["time"] == t
    # a second appointment the same day swaps times with it
    others = [s["time"] for s in (await http.get(f"/api/clinic-app/slots?date={d2}&doctor={doctor}", headers=reception)).json()["slots"] if s["available"]]
    b = (await http.post("/api/clinic-app/appointments", headers=reception, json={"patient_id": patient["id"], "doctor": doctor, "date": d2, "time": others[0]})).json()
    swapped = await http.post(f"/api/clinic-app/appointments/{a['id']}/swap", headers=reception, json={"other_id": b["id"]})
    assert swapped.status_code == 200, swapped.text
    times = {x["id"]: x["time"] for x in swapped.json()["items"]}
    assert times[a["id"]] == others[0] and times[b["id"]] == t2
    # cancel needs a reason; the refund is only a note
    assert (await http.post(f"/api/clinic-app/appointments/{b['id']}/cancel", headers=reception, json={"reason": ""})).status_code == 400
    cancelled = await http.post(f"/api/clinic-app/appointments/{b['id']}/cancel", headers=reception, json={"reason": "Clinic closed", "refund_note": "Advance to be adjusted"})
    assert cancelled.json()["status"] == "Cancelled" and cancelled.json()["refund_note"] == "Advance to be adjusted"
    assert (await http.post(f"/api/clinic-app/appointments/{b['id']}/reschedule", headers=reception, json={"date": d2, "time": t2, "reason": "x"})).status_code == 400
    # a draft holds no slot, then is booked into one
    draft = (await http.post("/api/clinic-app/appointments", headers=reception, json={"patient_id": patient["id"], "doctor": doctor, "draft": True, "treatment": "Implant review"})).json()
    assert draft["status"] == "Draft"
    drafts = (await http.get("/api/clinic-app/appointments?scope=drafts", headers=reception)).json()
    assert any(x["id"] == draft["id"] for x in drafts["items"]) and drafts["counts"]["drafts"] >= 1
    d3, t3 = await free_slot(http, reception, doctor, 30)
    confirmed = await http.post(f"/api/clinic-app/appointments/{draft['id']}/reschedule", headers=reception, json={"date": d3, "time": t3})
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "Scheduled"
    # check-in and complete
    assert (await http.post(f"/api/clinic-app/appointments/{draft['id']}/status", headers=reception, json={"status": "Cancelled"})).status_code == 400
    assert (await http.post(f"/api/clinic-app/appointments/{draft['id']}/status", headers=reception, json={"status": "Waiting"})).json()["status"] == "Waiting"
    # tidy: cancel what this test booked
    for x in (a["id"], draft["id"]):
        await http.post(f"/api/clinic-app/appointments/{x}/cancel", headers=reception, json={"reason": "test clean-up"})


async def test_clinic_app_api_refuses_other_roles(http):
    owner = await staff_headers(http, OWNER, "owner")
    await http.post("/api/clinic/users", headers=owner, json={"name": "Pharm", "email": "pharm.ca@test.in", "password": "Pharmacy#2026", "role": "Pharmacist"})
    pharmacist = await staff_headers(http, ("pharm.ca@test.in", "Pharmacy#2026"))
    assert (await http.get("/api/clinic-app/appointments", headers=pharmacist)).status_code == 403
    consultant = await staff_headers(http, ("kumar@dentor.in", "Consultant@2026"), "consultant")
    assert (await http.get("/api/clinic-app/patients", headers=consultant)).status_code == 403
    assert (await http.get("/api/clinic-app/patients", headers=bearer("nonsense"))).status_code == 401


async def test_web_moves_are_recorded_and_ranges_and_analytics(http):
    owner, reception, accountant = await logins(http)
    from tests.test_apps import ADMIN
    web = await staff_headers(http, ADMIN)
    patient = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=owner)).json()["items"][0]
    doctor = next(d["name"] for d in (await http.get("/api/clinic-app/doctors", headers=owner)).json()["items"] if d["kind"] == "in-house")
    d, t = await free_slot(http, owner, doctor, 40)
    made = (await http.post("/api/clinic-app/appointments", headers=owner, json={"patient_id": patient["id"], "doctor": doctor, "date": d, "time": t})).json()
    d2, t2 = await free_slot(http, owner, doctor, 45)
    # the reception web app moves it with a plain update: the original slot is kept all the same
    moved = await http.patch(f"/api/appointments/{made['id']}", headers=web, json={"date": d2, "time": t2})
    assert moved.status_code == 200, moved.text
    listed = (await http.get(f"/api/clinic-app/appointments?scope=all&rescheduled=true&date_from={d2}&date_to={d2}", headers=owner)).json()["items"]
    mine = next(x for x in listed if x["id"] == made["id"])
    assert mine["rescheduled_from"]["date"] == d and mine["rescheduled_from"]["time"] == t
    week = (await http.get(f"/api/clinic-app/appointments?date_from={d}&date_to={d2}", headers=accountant)).json()["items"]
    assert any(x["id"] == made["id"] for x in week)
    stats = (await http.get(f"/api/clinic-app/analytics/consultants?date_from={d2}&date_to={d2}", headers=accountant)).json()["items"]
    row = next(x for x in stats if x["name"] == doctor)
    assert row["appointments"] >= 1 and row["hours"] >= 0.5
    await http.post(f"/api/clinic-app/appointments/{made['id']}/cancel", headers=owner, json={"reason": "test clean-up"})


async def test_revisit_lists_each_treated_patient_once_with_the_latest_completed_visit(http):
    owner, reception, accountant = await logins(http)
    data = (await http.get("/api/clinic-app/revisits", headers=reception)).json()
    items = data["items"]
    assert items, "the demo clinic has completed visits"
    codes = [i["patient_code"] for i in items]
    assert len(codes) == len(set(codes)), "a patient is listed twice"
    dates = [i["date"] for i in items]
    assert dates == sorted(dates, reverse=True), "newest first"
    # each row is the patient's latest completed visit
    for row in items[:5]:
        done = (await http.get(f"/api/appointments?patientCode={row['patient_code']}&status=Completed&sort=date&order=desc&limit=1",
                               headers=owner)).json()["items"]
        assert done and done[0]["date"] == row["date"], row
        assert row["patient_id"] and row["last_visit_label"]
    # search narrows by name or code; every clinic-app role may read it; other apps may not
    first = items[0]
    found = (await http.get(f"/api/clinic-app/revisits?q={first['patient_code']}", headers=accountant)).json()["items"]
    assert [i["patient_code"] for i in found] == [first["patient_code"]]
    consultant = await staff_headers(http, ("kumar@dentor.in", "Consultant@2026"), "consultant")
    assert (await http.get("/api/clinic-app/revisits", headers=consultant)).status_code == 403

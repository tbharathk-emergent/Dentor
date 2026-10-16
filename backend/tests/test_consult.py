"""Booking a visiting consultant: the clinic's request and the consultant's answer (app/consult.py)."""
from datetime import date, timedelta

from tests.test_apps import OWNER, staff_headers

VISITING = ("visit.consult@test.in", "Visiting#2026")


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


async def setup(http):
    owner = await staff_headers(http, OWNER, "owner")
    existing = [c for c in (await http.get("/api/consultants?q=Dr. Test Visiting", headers=owner)).json()["items"] if c["name"] == "Dr. Test Visiting"]
    if existing:
        consultant = existing[0]
    else:
        made = await http.post("/api/consultants", headers=owner, json={"name": "Dr. Test Visiting", "specialty": "Orthodontics", "type": "Visiting", "fee": 1200, "status": "Active"})
        assert made.status_code in (200, 201), made.text
        consultant = made.json()
    login = await http.post("/api/clinic/users", headers=owner, json={"name": "Dr. Test Visiting", "email": VISITING[0], "password": VISITING[1], "role": "Consultant", "consultant_id": consultant["id"]})
    assert login.status_code in (201, 409), login.text
    doctor = await staff_headers(http, VISITING, "consultant")
    patient = (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=owner)).json()["items"][0]
    return owner, doctor, consultant, patient


async def free(http, owner, consultant_id, offset):
    for extra in range(14):
        d = day(offset + extra)
        slots = (await http.get(f"/api/clinic-app/consult/consultants/{consultant_id}/slots?date={d}", headers=owner)).json()["slots"]
        times = [s["time"] for s in slots if s["available"]]
        if len(times) >= 4:
            return d, times
    raise AssertionError("no free day")


CASE = {"diagnosis": "Class II malocclusion", "treatment": "Fixed Braces", "teeth": ["11", "21"], "quadrants": ["1", "2"],
        "history": ["Diabetes"], "bp": "130/85", "glucose": "140", "declaration": True}


async def test_own_choice_request_confirm_track_start_complete(http):
    owner, doctor, consultant, patient = await setup(http)
    listed = (await http.get("/api/clinic-app/consult/consultants?specialty=ortho", headers=owner)).json()
    assert any(c["id"] == consultant["id"] for c in listed["items"]) and {t["key"] for t in listed["types"]} == {"standard", "peak", "preferred"}
    d, times = await free(http, owner, consultant["id"], 6)
    base = {"patient_id": patient["id"], "choice": "own", "consultant_id": consultant["id"], "date": d, "time": times[0], **CASE}
    assert (await http.post("/api/clinic-app/consult/requests", headers=owner, json={**base, "declaration": False})).status_code == 400
    assert (await http.post("/api/clinic-app/consult/requests", headers=owner, json={**base, "teeth": ["99"]})).status_code == 400
    assert (await http.post("/api/clinic-app/consult/requests", headers=owner, json={**base, "time": "23:30"})).status_code == 409
    made = await http.post("/api/clinic-app/consult/requests", headers=owner, json=base)
    assert made.status_code == 201, made.text
    req = made.json()
    assert req["status"] == "Requested" and "start_code" not in req and req["code"].startswith("CNS-")
    # the consultant sees it as pending; opening it marks it viewed
    pending = (await http.get("/api/consultant/requests?scope=pending", headers=doctor)).json()
    assert any(x["id"] == req["id"] for x in pending["items"])
    detail = (await http.get(f"/api/consultant/requests/{req['id']}", headers=doctor)).json()
    assert detail["status"] == "Viewed" and detail["mine"] and "start_code" not in detail
    accepted = await http.post(f"/api/consultant/requests/{req['id']}/accept", headers=doctor, json={})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "Confirmed" and "start_code" not in accepted.json()
    # the clinic sees the code and the mirror appointment is on both days
    clinic_view = (await http.get(f"/api/clinic-app/consult/requests/{req['id']}", headers=owner)).json()
    code = clinic_view["start_code"]
    assert len(code) == 4 and clinic_view["appointmentId"]
    appts = (await http.get(f"/api/clinic-app/appointments?date={d}&kind=consultant", headers=owner)).json()["items"]
    assert any(a["id"] == clinic_view["appointmentId"] and a["chair"] == "Consultation Room" for a in appts)
    # tracking, then start needs the clinic's code
    for status in ("On the way", "Running late", "Arrived"):
        assert (await http.post(f"/api/consultant/requests/{req['id']}/track", headers=doctor, json={"status": status, "minutes": 10})).status_code == 200
    assert (await http.post(f"/api/consultant/requests/{req['id']}/complete", headers=doctor, json={"treatment_provided": "Bonding"})).status_code == 400
    wrong = "0000" if code != "0000" else "1111"
    assert (await http.post(f"/api/consultant/requests/{req['id']}/start", headers=doctor, json={"code": wrong})).status_code == 400
    started = await http.post(f"/api/consultant/requests/{req['id']}/start", headers=doctor, json={"code": code})
    assert started.status_code == 200 and started.json()["status"] == "Started"
    assert "start_code" not in (await http.get(f"/api/clinic-app/consult/requests/{req['id']}", headers=owner)).json()
    assert (await http.post(f"/api/consultant/requests/{req['id']}/vitals", headers=doctor, json={"bp": "125/80", "glucose": "120"})).status_code == 200
    # complete with a next sitting: a second confirmed booking and appointment
    done = await http.post(f"/api/consultant/requests/{req['id']}/complete", headers=doctor, json={
        "treatment_provided": "Brackets bonded on upper arch", "notes": "Review wire in 3 weeks", "next_date": day(40), "next_time": times[1]})
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["status"] == "Completed" and body["next_visit"]["date"] == day(40)
    timeline = [t["status"] for t in body["timeline"]]
    assert timeline[:3] == ["Requested", "Viewed", "Confirmed"] and timeline[-1] == "Completed"
    upcoming = (await http.get("/api/consultant/requests?scope=upcoming", headers=doctor)).json()["items"]
    follow = next(x for x in upcoming if x["id"] == body["next_visit"]["id"])
    cancelled = await http.post(f"/api/clinic-app/consult/requests/{follow['id']}/cancel", headers=owner, json={"reason": "Patient moved city"})
    assert cancelled.json()["status"] == "Cancelled"


async def test_propose_other_times_and_dentor_choice(http):
    owner, doctor, consultant, patient = await setup(http)
    d, times = await free(http, owner, consultant["id"], 12)
    req = (await http.post("/api/clinic-app/consult/requests", headers=owner, json={
        "patient_id": patient["id"], "choice": "own", "consultant_id": consultant["id"], "date": d, "time": times[0], **CASE})).json()
    proposed = await http.post(f"/api/consultant/requests/{req['id']}/propose", headers=doctor, json={"slots": [{"date": d, "time": times[2]}, {"date": d, "time": times[3]}], "note": "Busy in the morning"})
    assert proposed.status_code == 200 and proposed.json()["status"] == "Proposed"
    chosen = await http.post(f"/api/clinic-app/consult/requests/{req['id']}/accept-proposal", headers=owner, json={"index": 1})
    assert chosen.status_code == 200, chosen.text
    assert chosen.json()["status"] == "Confirmed" and chosen.json()["time"] == times[3]
    await http.post(f"/api/clinic-app/consult/requests/{req['id']}/cancel", headers=owner, json={"reason": "test clean-up"})
    # Dentor's choice: peak hour must be 5–9 PM; any visiting consultant of the clinic can take it, once
    base = {"patient_id": patient["id"], "choice": "dentor", **CASE}
    assert (await http.post("/api/clinic-app/consult/requests", headers=owner, json={**base, "dentor_type": "peak", "date": d, "time": "10:00"})).status_code == 400
    open_req = (await http.post("/api/clinic-app/consult/requests", headers=owner, json={**base, "dentor_type": "standard"})).json()
    assert open_req["consultant"] == "" and open_req["dentor_type_label"] == "Standard Appointment"
    pending = (await http.get("/api/consultant/requests?scope=pending", headers=doctor)).json()["items"]
    assert any(x["id"] == open_req["id"] for x in pending)
    assert (await http.post(f"/api/consultant/requests/{open_req['id']}/accept", headers=doctor, json={})).status_code == 400
    taken = await http.post(f"/api/consultant/requests/{open_req['id']}/accept", headers=doctor, json={"date": d, "time": times[1]})
    assert taken.status_code == 200, taken.text
    assert taken.json()["consultant"] == "Dr. Test Visiting"
    assert (await http.post(f"/api/consultant/requests/{open_req['id']}/accept", headers=doctor, json={"date": d, "time": times[1]})).status_code == 400
    await http.post(f"/api/consultant/requests/{open_req['id']}/cancel", headers=doctor, json={"reason": "test clean-up"})
    # Dr. Kumar (in-house) never sees the Dentor-choice request
    kumar = await staff_headers(http, ("kumar@dentor.in", "Consultant@2026"), "consultant")
    assert (await http.get(f"/api/consultant/requests/{open_req['id']}", headers=kumar)).status_code == 404


async def test_availability_shapes_the_slots(http):
    owner, doctor, consultant, _ = await setup(http)
    assert (await http.put("/api/consultant/availability", headers=doctor, json={"weekly": {"mon": {"morning": ["10:00", "09:00"]}}, "agreed": True})).status_code == 400
    assert (await http.put("/api/consultant/availability", headers=doctor, json={"weekly": {}, "agreed": False})).status_code == 400
    d = day(20)
    saved = await http.put("/api/consultant/availability", headers=doctor, json={
        "weekly": {k: {"morning": ["10:00", "11:00"]} for k in ("mon", "tue", "wed", "thu", "fri", "sat")}, "custom": {d: [["15:00", "16:00"]]}, "agreed": True})
    assert saved.status_code == 200, saved.text
    slots = (await http.get(f"/api/clinic-app/consult/consultants/{consultant['id']}/slots?date={d}", headers=owner)).json()["slots"]
    assert [s["time"] for s in slots] == ["15:00", "15:30"]
    mine = (await http.get(f"/api/consultant/my-slots?date={d}", headers=doctor)).json()["slots"]
    assert [s["time"] for s in mine] == ["15:00", "15:30"]
    # back to the default for the other tests
    from app.db import db
    await db.consultant_availability.delete_many({"consultant": "Dr. Test Visiting"})

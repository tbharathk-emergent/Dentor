"""Engagement and support (app/routers/engagement.py): tickets, chat, offers, ratings, prefs, wallet, plans, store, inventory, jobs."""
from datetime import date, timedelta

from tests.test_apps import OWNER, bearer, patient_login, staff_headers
from tests.test_clinic_app import logins
from tests.test_consult import setup as consult_setup, CASE, free


async def test_tickets_reach_dentor_and_come_back(http, super_headers):
    owner, reception, _ = await logins(http)
    assert (await http.post("/api/engage/tickets", headers=reception, json={"type": "Party", "subject": "x", "description": "y"})).status_code == 400
    t = (await http.post("/api/engage/tickets", headers=reception, json={"type": "Appointment", "subject": "Cannot reschedule", "description": "The slot grid stays empty."})).json()
    assert t["code"].startswith("DT-") and t["status"] == "Open"
    assert any(x["id"] == t["id"] for x in (await http.get("/api/engage/tickets", headers=reception)).json()["items"])
    # another login does not see it
    assert (await http.get(f"/api/engage/tickets/{t['id']}", headers=owner)).status_code == 404
    listed = (await http.get("/api/platform/tickets", headers=super_headers)).json()["items"]
    assert any(x["code"] == t["code"] and x["clinic"] for x in listed)
    assert (await http.post(f"/api/platform/tickets/{t['id']}/answer", headers=owner, json={"text": "x"})).status_code == 403
    done = await http.post(f"/api/platform/tickets/{t['id']}/answer", headers=super_headers, json={"text": "Fixed, please try again.", "status": "Resolved"})
    assert done.status_code == 200 and done.json()["status"] == "Resolved"
    mine = (await http.get(f"/api/engage/tickets/{t['id']}", headers=reception)).json()
    assert mine["timeline"][-1]["text"] == "Fixed, please try again."
    assert (await http.post(f"/api/engage/tickets/{t['id']}/reply", headers=reception, json={"text": "Thanks"})).status_code == 400
    assert any(n["title"].startswith(f"Ticket {t['code']}") for n in (await http.get("/api/notifications", headers=reception)).json()["items"])


async def test_chat_between_clinic_and_consultant(http):
    owner, doctor, consultant, _ = await consult_setup(http)
    started = await http.post("/api/engage/chats", headers=owner, json={"consultant_id": consultant["id"], "subject": "Lower molar implant", "text": "Please review the HbA1c report."})
    assert started.status_code == 201, started.text
    thread = started.json()
    mine = (await http.get("/api/engage/chats", headers=doctor)).json()
    assert mine["side"] == "consultant" and any(t["id"] == thread["id"] and t["unread"] == 1 for t in mine["items"])
    opened = (await http.get(f"/api/engage/chats/{thread['id']}", headers=doctor)).json()
    assert opened["unread"] == 0 and opened["messages"][0]["from"] == "clinic"
    replied = (await http.post(f"/api/engage/chats/{thread['id']}/messages", headers=doctor, json={"text": "Seen. Please upload the intra-oral pictures."})).json()
    assert [m["from"] for m in replied["messages"]] == ["clinic", "consultant"]
    clinic_side = (await http.get("/api/engage/chats", headers=owner)).json()
    assert any(t["id"] == thread["id"] and t["unread"] == 1 for t in clinic_side["items"])
    # Dr. Kumar is another consultant: he cannot open it
    kumar = await staff_headers(http, ("kumar@dentor.in", "Consultant@2026"), "consultant")
    assert (await http.get(f"/api/engage/chats/{thread['id']}", headers=kumar)).status_code == 404


async def test_offers_reach_the_patient_app_and_count_views_and_bookings(http):
    owner, reception, _ = await logins(http)
    till = (date.today() + timedelta(days=30)).isoformat()
    body = {"title": "20% Off on Cleaning", "kind": "treatment", "treatment": "Scaling", "category": "Preventive", "discount_type": "percentage", "value": 20, "valid_till": till}
    assert (await http.post("/api/engage/offers", headers=reception, json=body)).status_code == 403
    assert (await http.post("/api/engage/offers", headers=owner, json={**body, "value": 95})).status_code == 400
    assert (await http.post("/api/engage/offers", headers=owner, json={**body, "send": "later"})).status_code == 400
    sent = (await http.post("/api/engage/offers", headers=owner, json=body)).json()
    assert sent["status"] == "Sent" and sent["recipients"] >= 1 and sent["label"] == "20% off"
    pat = bearer((await patient_login(http))["access_token"])
    offers = (await http.get("/api/patient/offers", headers=pat)).json()["items"]
    assert any(o["id"] == sent["id"] and o["discount"] == "20% off" for o in offers)
    await http.post(f"/api/patient/offers/{sent['id']}/view", headers=pat)
    await http.post(f"/api/patient/offers/{sent['id']}/view", headers=pat)  # counted once
    detail = (await http.get(f"/api/engage/offers/{sent['id']}", headers=owner)).json()
    assert detail["viewed"] == 1 and detail["viewers"][0]["code"] == "DEN-1001"
    # a scheduled offer goes out when its time has come
    later = (await http.post("/api/engage/offers", headers=owner, json={**body, "title": "Monsoon check-up", "send": "later", "send_at": "2000-01-01T09:00"})).json()
    assert later["status"] == "Scheduled"
    from app.routers.engagement import deliver_due_offers
    assert await deliver_due_offers() >= 1
    assert (await http.get(f"/api/engage/offers/{later['id']}", headers=owner)).json()["status"] == "Sent"


async def test_ratings_after_a_completed_visit(http):
    owner, doctor, consultant, patient = await consult_setup(http)
    d, times = await free(http, owner, consultant["id"], 15)
    req = (await http.post("/api/clinic-app/consult/requests", headers=owner, json={"patient_id": patient["id"], "choice": "own", "consultant_id": consultant["id"], "date": d, "time": times[0], **CASE})).json()
    assert (await http.post("/api/engage/ratings", headers=owner, json={"booking_id": req["id"], "stars": 5})).status_code == 400
    await http.post(f"/api/consultant/requests/{req['id']}/accept", headers=doctor, json={})
    code = (await http.get(f"/api/clinic-app/consult/requests/{req['id']}", headers=owner)).json()["start_code"]
    await http.post(f"/api/consultant/requests/{req['id']}/start", headers=doctor, json={"code": code})
    await http.post(f"/api/consultant/requests/{req['id']}/complete", headers=doctor, json={"treatment_provided": "Bonded"})
    assert (await http.post("/api/engage/ratings", headers=owner, json={"booking_id": req["id"], "stars": 4, "text": "On time"})).status_code == 201
    assert (await http.post("/api/engage/ratings", headers=owner, json={"booking_id": req["id"], "stars": 4})).status_code == 409
    assert (await http.post("/api/engage/ratings", headers=doctor, json={"booking_id": req["id"], "stars": 5, "recommend": True, "aspects": ["sterilization protocol"]})).status_code == 201
    mine = (await http.get("/api/engage/reviews/mine", headers=doctor)).json()
    assert mine["count"] >= 1 and any(r["text"] == "On time" for r in mine["items"])


async def test_prefs_wallet_plans_store_inventory_jobs(http, super_headers):
    owner, reception, _ = await logins(http)
    owner_doctor, doctor, _, _ = await consult_setup(http)
    assert (await http.put("/api/engage/prefs", headers=reception, json={"sleep": {"enabled": True, "start": "25:00", "end": "07:00"}})).status_code == 400
    saved = (await http.put("/api/engage/prefs", headers=reception, json={"mute": False, "muted_minutes": 30, "sleep": {"enabled": True, "start": "22:00", "end": "07:00"}})).json()
    assert saved["muted_until"] and saved["sleep"]["enabled"]
    from app.notify import quiet_now
    from datetime import datetime
    assert quiet_now({"sleep": {"enabled": True, "start": "22:00", "end": "07:00"}}, datetime(2026, 1, 1, 23, 0))
    assert not quiet_now({"sleep": {"enabled": True, "start": "22:00", "end": "07:00"}}, datetime(2026, 1, 1, 12, 0))
    # wallet: points only, the referral code credits the referrer when the referred application is approved
    w = (await http.get("/api/engage/wallet", headers=owner)).json()
    assert w["code"].startswith("DEN") and w["points"] >= 0
    from tests.test_onboarding import verified_ticket, CLINIC_PROFILE
    email = f"referred.{date.today().isoformat()}@test.in"
    from app.db import db
    if not await db.users.find_one({"email": email}):
        ticket = await verified_ticket(http, email, "signup/email")
        applied = (await http.post("/api/auth/signup", json={"ticket": ticket, "kind": "clinic", "password": "Referred#2026", "agreed": True,
                                                             "profile": {**CLINIC_PROFILE, "clinic_name": f"Referred Dental {date.today().isoformat()}", "referral_code": w["code"]}})).json()
        assert (await http.post(f"/api/platform/applications/{applied['id']}/approve", headers=super_headers, json={})).status_code == 200
        assert (await http.get("/api/engage/wallet", headers=owner)).json()["points"] == w["points"] + 150
    # plans: a request, once
    plans = (await http.get("/api/engage/plans", headers=owner)).json()
    assert [p["name"] for p in plans["plans"]] == ["ELITE", "ELITE PRO", "ELITE PREMIUM"]
    if not plans["pending_request"]:
        assert (await http.post("/api/engage/plans/request", headers=owner, json={"plan": "elite_pro"})).status_code == 201
    assert (await http.post("/api/engage/plans/request", headers=owner, json={"plan": "elite_pro"})).status_code == 409
    # store: a catalogue and an enquiry
    from app.seed import seed_products
    await seed_products(db)
    items = (await http.get("/api/engage/products", headers=reception)).json()["items"]
    assert items and (await http.post(f"/api/engage/products/{items[0]['id']}/enquire", headers=reception, json={"quantity": 2})).status_code == 201
    # inventory is the consultant's own
    assert (await http.get("/api/engage/inventory", headers=reception)).status_code == 403
    made = await http.post("/api/engage/inventory", headers=doctor, json={"name": f"Protaper Gold {date.today().isoformat()}", "stock": 3, "reorder": 2})
    assert made.status_code in (201, 409)
    inv = (await http.get("/api/engage/inventory", headers=doctor)).json()
    item = next(i for i in inv["items"] if i["name"].startswith("Protaper Gold"))
    assert (await http.post(f"/api/engage/inventory/{item['id']}/adjust", headers=doctor, json={"change": -(item["stock"] + 1)})).status_code == 400
    used = (await http.post(f"/api/engage/inventory/{item['id']}/adjust", headers=doctor, json={"change": -1, "case": "CNS-2001"})).json()
    assert used["stock"] == item["stock"] - 1
    assert (await http.get("/api/engage/inventory", headers=doctor)).json()["history"][0]["case"] == "CNS-2001"
    # jobs: a clinic hires (admins only), a consultant looks for work
    assert (await http.post("/api/engage/jobs", headers=reception, json={"kind": "hiring", "title": "Endodontist", "description": "Two days a week, Trichy."})).status_code == 403
    job = (await http.post("/api/engage/jobs", headers=owner, json={"kind": "hiring", "title": "Endodontist", "specialty": "Endodontics", "description": "Two days a week, Trichy."})).json()
    seeking = (await http.post("/api/engage/jobs", headers=doctor, json={"kind": "seeking", "title": "Orthodontist available weekends", "description": "Weekend sessions in Trichy and nearby."})).json()
    open_hiring = (await http.get("/api/engage/jobs?kind=hiring", headers=doctor)).json()["items"]
    assert any(j["id"] == job["id"] for j in open_hiring)
    assert (await http.post(f"/api/engage/jobs/{job['id']}/close", headers=doctor)).status_code == 404
    assert (await http.post(f"/api/engage/jobs/{seeking['id']}/close", headers=doctor)).json()["status"] == "Closed"
    await http.post(f"/api/engage/jobs/{job['id']}/close", headers=owner)

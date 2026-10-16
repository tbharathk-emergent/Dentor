"""Clinic app clinical work: labs, complaints, recall, e-prescriptions, certificates, tariff (app/routers/clinic_clinical.py)."""
from tests.test_apps import OWNER, staff_headers
from tests.test_clinic_app import RECEPTION, ACCOUNTANT, logins


async def demo_patient(http, headers):
    return (await http.get("/api/clinic-app/patients?q=DEN-1001", headers=headers)).json()["items"][0]


async def test_labs_book_each_kind_and_complain(http):
    owner, reception, accountant = await logins(http)
    patient = await demo_patient(http, owner)
    directory = (await http.get("/api/clinic-app/labs", headers=reception)).json()
    assert directory["counts"]["Dental"] >= 1 and "CBC" in directory["options"]["blood_tests"]
    by_type = {l["type"]: l for l in directory["items"]}
    base = {"patient_id": patient["id"], "declaration": True}
    # the declaration and each form's own checks
    assert (await http.post("/api/clinic-app/lab-orders", headers=reception, json={**base, "lab_id": by_type["Blood"]["id"], "declaration": False, "details": {"tests": ["CBC"], "collection": "Lab"}})).status_code == 400
    assert (await http.post("/api/clinic-app/lab-orders", headers=reception, json={**base, "lab_id": by_type["Blood"]["id"], "details": {"tests": ["Magic"], "collection": "Lab"}})).status_code == 400
    assert (await http.post("/api/clinic-app/lab-orders", headers=reception, json={**base, "lab_id": by_type["X-ray"]["id"], "details": {"xray_type": "IOPA"}})).status_code == 400
    assert (await http.post("/api/clinic-app/lab-orders", headers=reception, json={**base, "lab_id": by_type["CBCT"]["id"], "details": {"indications": ["Endodontics"], "region": "Maxilla", "fov": "Small FOV (5x5 cm)"}})).status_code == 400
    assert (await http.post("/api/clinic-app/lab-orders", headers=accountant, json={**base, "lab_id": by_type["Blood"]["id"], "details": {"tests": ["CBC"], "collection": "Lab"}})).status_code == 403
    made = {}
    for kind, details in (
        ("Blood", {"tests": ["CBC", "HbA1c"], "collection": "Home Visit"}),
        ("X-ray", {"xray_type": "IOPA", "teeth": ["46"], "reason": "Periapical lesion"}),
        ("Dental", {"work": "Crown", "teeth": ["46"], "material": "Zirconia", "shade_guide": "VITA Classical", "primary_shade": "A2"}),
        ("CBCT", {"indications": ["Implant Planning"], "region": "Mandible", "fov": "Medium FOV (8x8 cm)", "consent": True}),
    ):
        res = await http.post("/api/clinic-app/lab-orders", headers=reception, json={**base, "lab_id": by_type[kind]["id"], "details": details})
        assert res.status_code == 201, (kind, res.text)
        made[kind] = res.json()
        assert made[kind]["stage"] == "Order Received" and made[kind]["code"].startswith("LAB-")
    assert made["Blood"]["caseType"] == "Blood test: CBC, HbA1c" and made["Dental"]["shade"] == "A2"
    # the reception web app sees the dental order on its lab board
    assert any(o["code"] == made["Dental"]["code"] for o in (await http.get("/api/lab_orders?limit=200", headers=owner)).json()["items"])
    ongoing = (await http.get("/api/clinic-app/lab-orders?scope=ongoing", headers=accountant)).json()["items"]
    assert {made[k]["code"] for k in made} <= {o["code"] for o in ongoing}
    # complaints: new → in progress → resolved, and no way back
    assert (await http.post("/api/clinic-app/lab-complaints", headers=reception, json={"order_id": made["Dental"]["id"], "type": "Bad", "description": "Crown does not fit"})).status_code == 400
    c = (await http.post("/api/clinic-app/lab-complaints", headers=reception, json={"order_id": made["Dental"]["id"], "type": "Fit issue", "description": "Crown does not fit"})).json()
    assert c["status"] == "New" and c["lab"] == by_type["Dental"]["name"]
    assert (await http.post(f"/api/clinic-app/lab-complaints/{c['id']}/status", headers=reception, json={"status": "In progress"})).json()["status"] == "In progress"
    assert (await http.post(f"/api/clinic-app/lab-complaints/{c['id']}/status", headers=reception, json={"status": "Resolved"})).json()["status"] == "Resolved"
    assert (await http.post(f"/api/clinic-app/lab-complaints/{c['id']}/status", headers=reception, json={"status": "New"})).status_code == 400
    counts = (await http.get("/api/clinic-app/lab-complaints?status=Resolved", headers=accountant)).json()["counts"]
    assert counts["Resolved"] >= 1
    assert "totals" in (await http.get("/api/clinic-app/lab-invoices", headers=accountant)).json()
    # only admins keep the lab directory
    assert (await http.post("/api/labs", headers=reception, json={"name": "X", "type": "Blood"})).status_code == 403


async def test_recall_templates_and_sending(http):
    owner, reception, _ = await logins(http)
    templates = (await http.get("/api/clinic-app/recall/templates", headers=reception)).json()["items"]
    assert any(t["name"] == "Routine Hygiene Recall" for t in templates)
    assert (await http.post("/api/clinic-app/recall/templates", headers=reception, json={"name": "X", "text": "short"})).status_code == 400
    assert (await http.post("/api/clinic-app/recall/templates", headers=reception, json={"name": "Long", "text": "x" * 161})).status_code == 422
    t = (await http.post("/api/clinic-app/recall/templates", headers=reception, json={"name": "Braces review", "text": "Hi [Patient Name], your braces review at [Clinic Name] is due."})).json()
    edited = await http.patch(f"/api/clinic-app/recall/templates/{t['id']}", headers=reception, json={"name": "Braces review", "text": "Hi [Patient Name], time for your braces review at [Clinic Name]."})
    assert edited.status_code == 200 and "time for your braces review" in edited.json()["text"]
    # the demo patient has the app: the reminder is a notification there, with the name filled in
    patient = await demo_patient(http, owner)
    sent = (await http.post("/api/clinic-app/recall", headers=reception, json={"patient_id": patient["id"], "message": edited.json()["text"], "template_id": t["id"]})).json()
    assert sent["delivered"] is True and sent["message"].startswith("Hi Ravi Kumar,") and "[Clinic Name]" not in sent["message"]
    from tests.test_apps import patient_login, bearer
    pat = bearer((await patient_login(http))["access_token"])
    notes = (await http.get("/api/patient/notifications", headers=pat)).json()["items"]
    assert any(n["title"] == "A reminder from your clinic" for n in notes)
    # a patient without the app is reported back, nothing is pretended
    nobody = (await http.post("/api/clinic-app/patients", headers=reception, json={"name": "No App Person", "mobile": "9845099911", "allow_duplicate": True})).json()
    told = (await http.post("/api/clinic-app/recall", headers=reception, json={"patient_id": nobody["id"], "message": "Hi [Patient Name], please visit us for your check-up."})).json()
    assert told["delivered"] is False and told["channel"] == "Not sent: no patient app"
    assert len((await http.get(f"/api/clinic-app/recall?patient_id={nobody['id']}", headers=reception)).json()["items"]) == 1


async def test_prescription_certificates_and_tariff(http):
    owner, reception, accountant = await logins(http)
    patient = await demo_patient(http, owner)
    catalog = (await http.get("/api/clinic-app/rx/catalog", headers=reception)).json()
    assert catalog["drugs"] and isinstance(catalog["combos"], list) and "Tablet" in catalog["types"]
    rx = {"patient_id": patient["id"], "diagnosis": "Pulpitis 46", "meds": [{"drug": "Amoxicillin 500mg", "dose": "1 tablet", "freq": "TDS", "days": "5"}], "advice": "Warm saline rinses"}
    assert (await http.post("/api/clinic-app/prescriptions", headers=reception, json=rx)).status_code == 403
    assert (await http.post("/api/clinic-app/prescriptions", headers=owner, json={**rx, "meds": []})).status_code == 400
    assert (await http.post("/api/clinic-app/prescriptions", headers=owner, json={**rx, "followUp": "2000-01-01"})).status_code == 400
    written = await http.post("/api/clinic-app/prescriptions", headers=owner, json=rx)
    assert written.status_code == 201, written.text
    assert written.json()["status"] == "Signed" and written.json()["source"] == "Clinic App"
    from tests.test_apps import patient_login, bearer
    pat = bearer((await patient_login(http))["access_token"])
    assert any(p["code"] == written.json()["code"] for p in (await http.get("/api/patient/prescriptions", headers=pat)).json()["items"])
    # a new medicine joins the list once
    drug = {"name": "Chlorhexidine 0.2% Mouthwash", "category": "Oral Care", "type": "Mouth wash", "dosage": "10 ml"}
    first = await http.post("/api/clinic-app/rx/drugs", headers=owner, json=drug)
    assert first.status_code in (201, 409)
    assert (await http.post("/api/clinic-app/rx/drugs", headers=owner, json=drug)).status_code == 409
    # certificates
    assert (await http.post("/api/clinic-app/certificates", headers=owner, json={"patient_id": patient["id"], "type": "Fitness"})).status_code == 400
    fit = await http.post("/api/clinic-app/certificates", headers=owner, json={"patient_id": patient["id"], "type": "Fitness", "examination": "Oral examination",
                                                                              "findings": "Good oral hygiene, no caries", "fitness": "Fit for general anaesthesia"})
    assert fit.status_code == 201 and fit.json()["code"].startswith("CERT-")
    ref = await http.post("/api/clinic-app/certificates", headers=owner, json={"patient_id": patient["id"], "type": "Referral", "specialist": "ENT Specialist", "reason": "Recurrent sinusitis"})
    assert ref.status_code == 201
    assert (await http.post("/api/clinic-app/certificates", headers=reception, json={"patient_id": patient["id"], "type": "Referral", "specialist": "ENT", "reason": "x y z"})).status_code == 403
    one = (await http.get(f"/api/clinic-app/certificates/{fit.json()['id']}", headers=accountant)).json()
    assert one["details"]["fitness"] == "Fit for general anaesthesia" and one["clinic"]["name"]
    assert len((await http.get("/api/clinic-app/certificates?type=Referral", headers=reception)).json()["items"]) >= 1
    tariff = (await http.get("/api/clinic-app/tariff", headers=accountant)).json()["groups"]
    assert any(g["category"] == "Endodontics" and g["items"] for g in tariff)


async def test_treatment_fees_are_checked_and_admin_only(http):
    owner, reception, _ = await logins(http)
    assert (await http.post("/api/treatment_masters", headers=reception, json={"name": "Night guard", "price": 3000})).status_code == 403
    assert (await http.post("/api/treatment_masters", headers=owner, json={"name": "Night guard", "price": 3000, "tax": 40})).status_code == 400
    made = await http.post("/api/treatment_masters", headers=owner, json={"name": "Night guard", "category": "Prosthodontics", "price": "3000", "tax": 18, "duration": 30, "doctorShare": 20, "status": "Active"})
    assert made.status_code in (200, 201), made.text
    assert made.json()["code"].startswith("TRT-") and made.json()["price"] == 3000
    tariff = (await http.get("/api/clinic-app/tariff", headers=reception)).json()["groups"]
    assert any(t["name"] == "Night guard" for g in tariff for t in g["items"])

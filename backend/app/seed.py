"""Idempotent demo-data seeding for the Dentor rebuild.

Runs on startup against the demo clinic's TenantDB; each collection is only seeded
when that clinic has none, so user data is never overwritten. Dates are generated
relative to today to keep the dashboard and calendars alive.
"""
from datetime import date, timedelta

from .auth import hash_password
from .config import ADMIN_DEFAULT_PASSWORD, ADMIN_EMAIL
from .util import now_iso


def d(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


async def ensure_seed(db):
    await seed_users(db)
    await seed_patients(db)
    await seed_consultants(db)
    await seed_appointments(db)
    await seed_invoices_and_payments(db)
    await seed_treatment_masters(db)
    await seed_masters(db)
    await seed_pharmacy(db)
    await seed_lab(db)
    await seed_inventory(db)
    await seed_leads(db)
    await seed_reviews(db)
    await seed_omni(db)
    await seed_schedule_notes(db)
    await seed_staff(db)
    await seed_frs(db)
    await seed_settings(db)


async def seed_reference(db, settings: dict | None = None):
    """Starting data every new clinic needs: masters, treatment list and settings."""
    await seed_treatment_masters(db)
    await seed_masters(db)
    await seed_settings(db, settings)


async def _empty(db, name) -> bool:
    return await db[name].count_documents({}) == 0


def _meta():
    return {"created_at": now_iso(), "updated_at": now_iso(), "created_by": "seed"}


async def seed_users(db):
    if not await _empty(db, "users"):
        return
    await db.users.insert_many([
        {
            "name": "Dr. Admin", "email": ADMIN_EMAIL, "user_id": "admin",
            "role": "Administrator", "department": "Administration",
            "password_hash": hash_password(ADMIN_DEFAULT_PASSWORD), "status": "Active", **_meta(),
        },
    ])


async def seed_patients(db):
    if not await _empty(db, "patients"):
        return
    rows = [
        ("DEN-1001", "Ravi Kumar", 36, "Male", "9876543210", "B+", "Root Canal", "Dr. Kumar", "Low", "Active", d(-35), "Penicillin", "Diabetes Mellitus"),
        ("DEN-1002", "Siva Prakash", 42, "Male", "9876543211", "O+", "Crown", "Dr. Anitha", "Medium", "Active", d(-35), "", "Hypertension"),
        ("DEN-1003", "Anjali Devi", 29, "Female", "9876543212", "A+", "Orthodontics", "Dr. Kumar", "Low", "Active", d(-36), "", ""),
        ("DEN-1004", "Karthik Raj", 51, "Male", "9876543213", "AB+", "Implant", "Dr. Gowtham", "High", "Active", d(-37), "Sulfa drugs", "Cardiac stent · 2021"),
        ("DEN-1005", "Meena Lakshmi", 38, "Female", "9876543214", "O-", "Consultation", "Dr. Anitha", "Low", "New", d(-35), "", ""),
        ("DEN-1006", "Joseph Antony", 47, "Male", "9876543215", "B-", "Extraction", "Dr. Gowtham", "Medium", "Active", d(-38), "", "Smoker"),
        ("DEN-1040", "Arun Kumar", 33, "Male", "9876543216", "A-", "CBCT & Implant Planning", "Dr. Gowtham", "Low", "Active", d(-56), "", ""),
        ("DEN-1041", "Priya Raman", 27, "Female", "9876543217", "B+", "Scaling & Polishing", "Dr. Anitha", "Low", "Active", d(-55), "", ""),
    ]
    await db.patients.insert_many([
        {
            "code": c, "name": n, "age": a, "gender": g, "mobile": m, "blood": b,
            "treatment": t, "doctor": doc, "risk": r, "status": s, "lastVisit": lv,
            "allergy": al, "history": hi, "email": "", "address": "", "city": "Manaparai",
            "source": "Walk-in", "photo": "", **_meta(),
        }
        for c, n, a, g, m, b, t, doc, r, s, lv, al, hi in rows
    ])


async def seed_consultants(db):
    if not await _empty(db, "consultants"):
        return
    inhouse = [
        ("DOC-101", "Dr. Kumar", "General & Restorative Dentistry", "In-house", "BDS, MDS", 12, "Mon–Sat · 9 AM–5 PM"),
        ("DOC-102", "Dr. Anitha", "Prosthodontics & Periodontics", "In-house", "BDS, MDS", 9, "Mon–Sat · 9 AM–5 PM"),
        ("DOC-103", "Dr. Gowtham", "Implantology & Oral Surgery", "In-house", "BDS, MDS", 11, "Mon–Sat · 10 AM–6 PM"),
    ]
    visiting = [
        ("CON-101", "Dr. Vivekanandan M", "Oral & Maxillofacial Surgery", "Visiting", "BDS, MDS, FDSRCS", 18, "Sat · 10 AM–2 PM", "Trichy", 1500),
        ("CON-102", "Dr. Neha Sharma", "Orthodontics & Clear Aligners", "Visiting", "BDS, MDS", 10, "Wed · 2 PM–6 PM", "Madurai", 1200),
        ("CON-103", "Dr. Prasath R", "Periodontics & Laser Dentistry", "Visiting", "BDS, MDS", 14, "Fri · 10 AM–1 PM", "Dindigul", 1000),
        ("CON-104", "Dr. Vivek Raj", "Endodontics & Microscopic RCT", "Visiting", "BDS, MDS", 8, "Tue · 3 PM–7 PM", "Trichy", 1200),
        ("CON-105", "Dr. Sandhya K", "Paediatric Dentistry", "Visiting", "BDS, MDS", 7, "Thu · 10 AM–1 PM", "Karur", 900),
        ("CON-106", "Dr. Ramesh Iyer", "Prosthodontics & Full Mouth Rehab", "Visiting", "BDS, MDS, PhD", 20, "Sun · 10 AM–1 PM", "Coimbatore", 2000),
    ]
    docs = [
        {"code": c, "name": n, "specialty": sp, "type": ty, "credentials": cr, "experience": ex,
         "availability": av, "location": "Manaparai", "fee": 500, "status": "Active", "rating": 4.8, **_meta()}
        for c, n, sp, ty, cr, ex, av in inhouse
    ] + [
        {"code": c, "name": n, "specialty": sp, "type": ty, "credentials": cr, "experience": ex,
         "availability": av, "location": loc, "fee": fee, "status": "Active", "rating": 4.7, **_meta()}
        for c, n, sp, ty, cr, ex, av, loc, fee in visiting
    ]
    await db.consultants.insert_many(docs)


async def seed_appointments(db):
    if not await _empty(db, "appointments"):
        return
    rows = [
        # code, patientCode, patient, day offset, time, treatment, doctor, chair, duration, status
        ("APT-4101", "DEN-1001", "Ravi Kumar", 0, "09:30", "Root Canal", "Dr. Kumar", "Chair 01", "30 min", "Scheduled"),
        ("APT-4102", "DEN-1002", "Siva Prakash", 0, "10:15", "Crown Preparation", "Dr. Anitha", "Chair 02", "30 min", "Waiting"),
        ("APT-4103", "DEN-1005", "Meena Lakshmi", 0, "11:00", "Implant Review", "Dr. Gowtham", "Chair 03", "30 min", "Scheduled"),
        ("APT-4104", "DEN-1003", "Anjali Devi", 0, "12:30", "Ortho Adjustment", "Dr. Kumar", "Chair 01", "30 min", "Completed"),
        ("APT-4105", "DEN-1004", "Karthik Raj", 0, "16:30", "Implant Consultation", "Dr. Gowtham", "Chair 03", "30 min", "Scheduled"),
        ("APT-4106", "DEN-1006", "Joseph Antony", 1, "10:00", "Extraction Review", "Dr. Kumar", "Chair 02", "30 min", "Scheduled"),
        ("APT-4107", "DEN-1003", "Anjali Devi", 2, "11:30", "Ortho Review", "Dr. Anitha", "Chair 01", "30 min", "Scheduled"),
        ("APT-4108", "DEN-1002", "Siva Prakash", -1, "15:00", "Crown Trial", "Dr. Anitha", "Chair 02", "30 min", "Completed"),
    ]
    await db.appointments.insert_many([
        {
            "code": c, "patientCode": pc, "patient": p, "date": d(off), "time": t,
            "treatment": tr, "doctor": doc, "chair": ch, "duration": du, "status": st, "notes": "", **_meta(),
        }
        for c, pc, p, off, t, tr, doc, ch, du, st in rows
    ])


async def seed_invoices_and_payments(db):
    if not await _empty(db, "invoices"):
        return
    rows = [
        # number, source, offset, patientCode, patient, treatment, doctor, total, balance
        ("CLN-INV-2848", "Clinic", -2, "DEN-1001", "Ravi Kumar", "Root Canal Treatment", "Dr. Kumar", 12500, 0),
        ("DEN-INV-2847", "DENTOR", -2, "DEN-1003", "Anjali Devi", "Orthodontic Adjustment", "Dr. Anitha", 8610, 3610),
        ("CLN-INV-2846", "Clinic", -3, "DEN-1005", "Meena Lakshmi", "Dental Implant Review", "Dr. Gowtham", 15750, 15750),
        ("DEN-INV-2845", "DENTOR", -3, "DEN-1002", "Siva Prakash", "Zirconia Crown", "Dr. Anitha", 23100, 0),
        ("CLN-INV-2844", "Clinic", -4, "DEN-1004", "Karthik Raj", "Implant Consultation", "Dr. Gowtham", 8190, 4190),
        ("DEN-INV-2843", "DENTOR", -5, "DEN-1006", "Joseph Antony", "Surgical Extraction", "Dr. Kumar", 9975, 9975),
        ("CLN-INV-2842", "Clinic", -6, "DEN-1041", "Priya Raman", "Scaling & Polishing", "Dr. Anitha", 3500, 0),
        ("DEN-INV-2841", "DENTOR", -7, "DEN-1040", "Arun Kumar", "CBCT & Implant Planning", "Dr. Gowtham", 6825, 0),
    ]
    invoices, payments = [], []
    for num, src, off, pc, p, tr, doc, total, bal in rows:
        paid = total - bal
        status = "Paid" if bal == 0 else ("Partial" if paid > 0 else "Pending")
        invoices.append({
            "number": num, "source": src, "date": d(off), "patientCode": pc, "patient": p,
            "treatment": tr, "doctor": doc, "items": [{"name": tr, "qty": 1, "price": total, "tax": 0}],
            "subtotal": total, "discount": 0, "tax": 0, "total": total,
            "paid": paid, "balance": bal, "status": status, "notes": "", **_meta(),
        })
        if paid > 0:
            payments.append({
                "receipt": f"DEN-RCP-{1900 + len(payments)}", "invoice": num, "invoice_id": None,
                "patient": p, "patientCode": pc, "amount": paid,
                "mode": ["UPI", "Cash", "Card"][len(payments) % 3],
                "reference": f"RCT-{100200 + len(payments)}", "date": d(off),
                "notes": "", "entered_by": "Dr. Admin", "created_at": now_iso(),
            })
    await db.invoices.insert_many(invoices)
    if payments:
        await db.payments.insert_many(payments)


async def seed_treatment_masters(db):
    if not await _empty(db, "treatment_masters"):
        return
    rows = [
        ("TRT-CONS-001", "Dental Consultation", "Consultation", 20, 500, 0, "Per Visit", 0, "Comprehensive dental consultation and treatment planning."),
        ("TRT-SCAL-001", "Scaling & Polishing", "Periodontics", 45, 1500, 0, "Per Session", 25, "Full-mouth ultrasonic scaling and polishing."),
        ("TRT-RCT-001", "Root Canal Treatment", "Endodontics", 60, 6500, 0, "Per Tooth", 30, "Root canal treatment excluding final crown."),
        ("TRT-EXT-001", "Simple Extraction", "Oral Surgery", 30, 1800, 0, "Per Tooth", 30, "Routine non-surgical tooth extraction."),
        ("TRT-IMP-001", "Dental Implant Placement", "Implantology", 90, 35000, 0, "Per Implant", 25, "Implant placement excluding prosthetic crown."),
        ("TRT-CROWN-001", "Zirconia Crown", "Prosthodontics", 45, 8500, 0, "Per Unit", 20, "Monolithic zirconia crown including digital scan."),
        ("TRT-ORTHO-001", "Orthodontic Treatment", "Orthodontics", 40, 45000, 0, "Per Case", 25, "Fixed appliance orthodontic treatment package."),
        ("TRT-WHITE-001", "Professional Teeth Whitening", "Cosmetic Dentistry", 60, 9000, 18, "Per Session", 20, "Chairside professional whitening treatment."),
    ]
    await db.treatment_masters.insert_many([
        {"code": c, "name": n, "category": cat, "duration": du, "price": pr, "tax": tax,
         "unit": u, "doctorShare": ds, "status": "Active", "description": desc, **_meta()}
        for c, n, cat, du, pr, tax, u, ds, desc in rows
    ])


async def seed_masters(db):
    if not await _empty(db, "masters"):
        return
    seed = {
        "clinical": [
            ("TRT-001", "Root Canal Treatment", "Treatments", "Endodontics"),
            ("TRT-002", "Zirconia Crown", "Treatments", "Prosthodontics"),
            ("PRC-001", "Dental Extraction", "Procedures", "Oral Surgery"),
            ("DGN-001", "Reversible Pulpitis", "Diagnosis", "Endodontics"),
            ("FND-001", "Dental Caries", "Clinical Findings", "General Dentistry"),
        ],
        "patients": [
            ("PAT-001", "General Patient", "Patient Types", "Standard"),
            ("REF-001", "Walk-in", "Referral Sources", "Direct"),
            ("MED-001", "Diabetes Mellitus", "Medical Conditions", "Systemic"),
            ("ALG-001", "Penicillin", "Allergies", "Drug"),
            ("REL-001", "Parent", "Relationship Types", "Family"),
        ],
        "appointments": [
            ("APT-001", "Consultation", "Appointment Types", "30 Minutes"),
            ("APS-001", "Scheduled", "Appointment Status", "Open"),
            ("CHR-001", "Chair 1", "Chairs", "Clinical Floor"),
            ("ROM-001", "Surgery Room", "Clinical Rooms", "Sterile Zone"),
            ("CAN-001", "Patient Unavailable", "Cancellation Reasons", "Patient"),
        ],
        "finance": [
            ("SRV-001", "General Consultation", "Service Price List", "₹500"),
            ("TAX-001", "GST 5%", "Tax Rates", "5%"),
            ("PAY-001", "UPI", "Payment Modes", "Digital"),
            ("DIS-001", "Senior Citizen", "Discount Reasons", "10%"),
            ("CST-001", "Clinical Operations", "Cost Centres", "Primary"),
        ],
        "inventory": [
            ("ITC-001", "Clinical Materials", "Item Categories", "Consumables"),
            ("UOM-001", "Piece", "Units of Measure", "Nos"),
            ("WAR-001", "Main Store", "Warehouses", "Ground Floor"),
            ("MFR-001", "Dentsply Sirona", "Manufacturers", "Dental"),
            ("SUP-001", "Dental Materials Supplier", "Suppliers", "Active"),
        ],
        "hr": [
            ("DEP-001", "Clinical", "Departments", "Patient Care"),
            ("DES-001", "Dental Surgeon", "Designations", "Professional"),
            ("SFT-001", "Morning Shift", "Shift Types", "08:00–14:00"),
            ("LEV-001", "Casual Leave", "Leave Types", "12 Days"),
            ("EMP-001", "Permanent", "Employment Types", "Full Time"),
        ],
        "pharmacy": [
            ("DRG-001", "Antibiotics", "Drug Categories", "Prescription"),
            ("DOS-001", "Tablet", "Dosage Forms", "Solid"),
            ("ROU-001", "Oral", "Routes", "Systemic"),
            ("SCH-001", "Schedule H", "Drug Schedules", "Rx Required"),
            ("PHS-001", "MedPlus Distributors", "Pharmacy Suppliers", "Active"),
        ],
        "laboratory": [
            ("LAB-001", "Zirconia Crown", "Lab Products", "Fixed Prosthesis"),
            ("MAT-001", "3Y-TZP Zirconia", "Materials", "Ceramic"),
            ("SHD-001", "VITA Classical", "Shade Systems", "A1–D4"),
            ("STG-001", "CAD Design", "Lab Stages", "Digital"),
            ("DLB-001", "ZIREX Dental Lab", "Dental Laboratories", "Partner"),
        ],
        "communication": [
            ("MSG-001", "Appointment Reminder", "Message Templates", "WhatsApp"),
            ("CHN-001", "WhatsApp", "Communication Channels", "Active"),
            ("TAG-001", "Implant Lead", "Patient Tags", "Marketing"),
            ("CMP-001", "Patient Recall", "Campaign Categories", "Retention"),
            ("CON-001", "Marketing Consent", "Consent Types", "Optional"),
        ],
    }
    docs = []
    for module, rows in seed.items():
        for i, (code, name, typ, detail) in enumerate(rows):
            docs.append({"module": module, "code": code, "name": name, "type": typ,
                         "detail": detail, "status": "Active", "sort": i, **_meta()})
    await db.masters.insert_many(docs)


async def seed_pharmacy(db):
    if not await _empty(db, "pharmacy_items"):
        return
    rows = [
        ("MED-1001", "Amoxicillin 500mg", "Antibiotics", "Tablet", 120, 30, 4.5, 8.0, 12, "AMX-2401", d(300)),
        ("MED-1002", "Augmentin 625 Duo", "Antibiotics", "Tablet", 60, 25, 18.0, 28.5, 12, "AUG-2402", d(240)),
        ("MED-1003", "Metrogyl 400mg", "Antibiotics", "Tablet", 150, 40, 1.2, 2.5, 12, "MTG-2403", d(400)),
        ("MED-1004", "Ketorol DT", "Analgesics", "Tablet", 18, 25, 6.0, 10.5, 12, "KTR-2404", d(150)),
        ("MED-1005", "Zerodol SP", "Analgesics", "Tablet", 90, 30, 7.5, 12.0, 12, "ZRD-2405", d(320)),
        ("MED-1006", "Pan 40", "Antacids", "Tablet", 110, 25, 5.5, 9.0, 12, "PAN-2406", d(365)),
        ("MED-1007", "Hifenac P", "Analgesics", "Tablet", 14, 20, 4.8, 8.5, 12, "HFN-2407", d(120)),
        ("MED-1008", "Chlorhexidine Mouthwash", "Oral Care", "Liquid", 35, 10, 55.0, 95.0, 18, "CHX-2408", d(270)),
        ("MED-1009", "Lignocaine 2% Injection", "Anaesthetics", "Injection", 48, 15, 22.0, 35.0, 12, "LGN-2409", d(200)),
        ("MED-1010", "Ibugesic Plus Syrup", "Paediatric", "Syrup", 8, 12, 38.0, 62.0, 12, "IBU-2410", d(90)),
    ]
    await db.pharmacy_items.insert_many([
        {"code": c, "name": n, "category": cat, "form": f, "stock": s, "reorder": r,
         "purchasePrice": pp, "salePrice": sp, "gst": g, "batch": b, "expiry": e,
         "unit": "Strip" if f == "Tablet" else "Unit", "status": "Active", **_meta()}
        for c, n, cat, f, s, r, pp, sp, g, b, e in rows
    ])


async def seed_lab(db):
    if not await _empty(db, "lab_orders"):
        return
    rows = [
        ("LAB-2680", "Ravi Kumar", "DEN-1001", "Zirconia Crown", "46", "A2", "Multilayer Zirconia", "Dr. Kumar", "ZIREX Dental Lab", "R. Prakash", -6, 1, "Quality Check", "In Progress", "Normal", 4500, 2000, 72),
        ("LAB-2681", "Siva Prakash", "DEN-1002", "Implant Crown", "36", "A3", "Zirconia on Ti-base", "Dr. Gowtham", "Precision Dental Studio", "M. Deepak", -5, 2, "Milling", "In Progress", "High", 8200, 4000, 48),
        ("LAB-2682", "Anjali Devi", "DEN-1003", "Clear Retainer", "Upper & Lower", "Clear", "Thermoplastic", "Dr. Anitha", "OrthoFab", "S. Naren", -4, 0, "Dispatch", "Ready", "Normal", 3200, 3200, 90),
        ("LAB-2683", "Karthik Raj", "DEN-1004", "3 Unit Bridge", "14–16", "B1", "Lithium Disilicate", "Dr. Kumar", "SmileCraft Lab", "A. Sam", -8, -1, "CAD Design", "Delayed", "Urgent", 12600, 5000, 30),
        ("LAB-2684", "Meena Lakshmi", "DEN-1005", "Complete Denture", "Full Arch", "A3.5", "PMMA", "Dr. Anitha", "ZIREX Dental Lab", "P. Vimal", -10, -2, "Delivered", "Delivered", "Normal", 9800, 9800, 100),
    ]
    await db.lab_orders.insert_many([
        {"code": c, "patient": p, "patientCode": pc, "caseType": ct, "teeth": th, "shade": sh,
         "material": m, "doctor": doc, "lab": lab, "technician": tech,
         "received": d(ro), "due": d(do_), "stage": stage, "status": st, "priority": pr,
         "amount": amt, "paid": paid, "progress": prog, "notes": "", **_meta()}
        for c, p, pc, ct, th, sh, m, doc, lab, tech, ro, do_, stage, st, pr, amt, paid, prog in rows
    ])


async def seed_inventory(db):
    if not await _empty(db, "inventory_items"):
        return
    items = [
        ("INV-101", "Latex Examination Gloves", "PPE", "Box", 42, 15, 80, "GLV-240", d(500), "MediSupply Co", 240, "Main Store", 12),
        ("INV-102", "Composite Resin A2", "Restorative Materials", "Syringe", 8, 10, 40, "CMP-241", d(300), "Dental Materials Supplier", 1450, "Clinical Floor", 12),
        ("INV-103", "Gutta Percha Points", "Endodontics", "Pack", 24, 10, 60, "GPP-242", d(700), "Dental Materials Supplier", 380, "Main Store", 12),
        ("INV-104", "Implant Healing Abutment", "Implantology", "Piece", 6, 4, 20, "IHA-243", "No Expiry", "ImplantDirect India", 2200, "Secure Cabinet", 18),
        ("INV-105", "Face Masks 3-Ply", "PPE", "Box", 0, 20, 100, "MSK-244", d(600), "MediSupply Co", 150, "Main Store", 5),
        ("INV-106", "Alginate Impression Material", "Clinical Consumables", "Pack", 16, 8, 40, "ALG-245", d(240), "Dental Materials Supplier", 520, "Main Store", 12),
    ]
    await db.inventory_items.insert_many([
        {"code": c, "name": n, "category": cat, "unit": u, "stock": s, "reorder": r, "max": mx,
         "batch": b, "expiry": e, "supplier": sup, "cost": cost, "location": loc, "gst": g, **_meta()}
        for c, n, cat, u, s, r, mx, b, e, sup, cost, loc, g in items
    ])
    await db.inventory_suppliers.insert_many([
        {"code": "SUP-101", "name": "Dental Materials Supplier", "gstin": "33AAACD1234F1Z2", "contact": "9842011001", "city": "Trichy", "credit": "30 Days", "balance": 18500, "status": "Active", **_meta()},
        {"code": "SUP-102", "name": "MediSupply Co", "gstin": "33AAACM5678G1Z3", "contact": "9842011002", "city": "Madurai", "credit": "15 Days", "balance": 6400, "status": "Active", **_meta()},
        {"code": "SUP-103", "name": "ImplantDirect India", "gstin": "29AAACI9012H1Z4", "contact": "9842011003", "city": "Bengaluru", "credit": "45 Days", "balance": 0, "status": "Active", **_meta()},
    ])


async def seed_leads(db):
    if not await _empty(db, "leads"):
        return
    rows = [
        ("LD-26091", "Priya Sharma", "9876501001", "priya.s@example.com", "Instagram", "Clear Aligners", "New", 92, "Hot", "Dr. Anitha", 85000, "Today, 10:25 AM", "Call today · 4:00 PM"),
        ("LD-26092", "Arun Kumar", "9876501002", "arun.k@example.com", "Google Ads", "Dental Implant", "Contacted", 84, "Hot", "Dr. Kumar", 120000, "Yesterday", "Send treatment plan"),
        ("LD-26093", "Fathima Begum", "9876501003", "fathima.b@example.com", "Website", "Smile Design", "Qualified", 76, "Warm", "Reception", 65000, d(-3), "Schedule consultation"),
        ("LD-26094", "Suresh Babu", "9876501004", "suresh.b@example.com", "Patient Referral", "Full Mouth Rehabilitation", "Consultation", 88, "Hot", "Dr. Gowtham", 250000, d(-2), "Consultation booked"),
        ("LD-26095", "Lakshmi Devi", "9876501005", "lakshmi.d@example.com", "Facebook", "Root Canal", "Converted", 81, "Warm", "Dr. Kumar", 18000, d(-5), "Treatment started"),
        ("LD-26096", "Mohamed Irfan", "9876501006", "irfan.m@example.com", "Walk-in", "Orthodontics", "New", 68, "Warm", "Unassigned", 72000, "Today", "Assign owner"),
        ("LD-26097", "Kavitha Raj", "9876501007", "kavitha.r@example.com", "WhatsApp", "Paediatric Dentistry", "Contacted", 59, "Normal", "Reception", 12000, "Yesterday", "WhatsApp follow-up"),
    ]
    await db.leads.insert_many([
        {"code": c, "name": n, "phone": p, "email": e, "source": s, "interest": i, "stage": st,
         "score": sc, "priority": pr, "owner": o, "value": v, "last": la, "next": nx, "notes": "", **_meta()}
        for c, n, p, e, s, i, st, sc, pr, o, v, la, nx in rows
    ])


async def seed_reviews(db):
    if not await _empty(db, "reviews"):
        return
    rows = [
        ("RV-26055", "Clinic", "DENTOR Main Clinic", "Ananya Ramesh", "Manaparai", 5, "Approved", -1, "Google", "Excellent root canal experience. Completely painless and very professional team.", "Root Canal Treatment", "Positive"),
        ("RV-26054", "Consultant", "Dr. Kumar", "Ravi Kumar", "Trichy", 4, "Approved", -2, "DENTOR App", "Dr. Kumar explained every step clearly. Very satisfied with the treatment.", "Dental Implant", "Positive"),
        ("RV-26053", "Clinic", "DENTOR Main Clinic", "Sasi Kala", "Dindigul", 5, "Pending", -2, "WhatsApp", "Beautiful clinic and friendly staff. My kids love coming here.", "Paediatric Check-up", "Positive"),
        ("RV-26052", "Consultant", "Dr. Anitha", "Mohan Raj", "Madurai", 3, "Flagged", -3, "Google", "Treatment was fine but I waited over 40 minutes past my slot.", "Crown Fitting", "Neutral"),
        ("RV-26051", "Clinic", "DENTOR Main Clinic", "Divya Prakash", "Karur", 5, "Approved", -4, "Facebook", "Best dental clinic in the region. Spotless and modern.", "Scaling & Polishing", "Positive"),
        ("RV-26050", "Consultant", "Dr. Gowtham", "Anonymous", "Coimbatore", 2, "Rejected", -5, "Google", "Not happy with the billing clarity.", "Implant Consultation", "Negative"),
        ("RV-26049", "Clinic", "DENTOR Main Clinic", "Joseph Antony", "Manaparai", 5, "Approved", -6, "DENTOR App", "Extraction was quick and healing was smooth. Thank you team DENTOR!", "Surgical Extraction", "Positive"),
        ("RV-26048", "Consultant", "Dr. Neha", "Keerthana S", "Trichy", 4, "Pending", -7, "WhatsApp", "Aligner consultation was very detailed. Pricing options well explained.", "Clear Aligners", "Positive"),
        ("RV-26047", "Clinic", "DENTOR Main Clinic", "Bala Murugan", "Pudukkottai", 4, "Approved", -8, "Google", "Good experience overall. Parking could be better.", "Dental Consultation", "Positive"),
        ("RV-26046", "Consultant", "Dr. Prasath", "Revathi K", "Dindigul", 5, "Pending", -9, "DENTOR App", "Laser gum treatment was amazing. No pain at all.", "Laser Dentistry", "Positive"),
        ("RV-26045", "Clinic", "DENTOR Main Clinic", "Stephen Raj", "Chennai", 3, "Pending", -10, "Facebook", "Treatment quality is good but appointment slots fill up too fast.", "Zirconia Crown", "Neutral"),
        ("RV-26044", "Consultant", "Dr. Vivek", "Gayathri N", "Trichy", 5, "Approved", -12, "Google", "Microscopic RCT saved my tooth. Highly recommended!", "Root Canal Treatment", "Positive"),
    ]
    def disp(off):
        dt = date.today() + timedelta(days=off)
        return dt.strftime("%d %b %Y")
    await db.reviews.insert_many([
        {"code": c, "type": t, "subject": s, "reviewer": r, "location": loc, "rating": rate,
         "status": st, "date": disp(off), "dateISO": d(off), "channel": ch, "text": txt,
         "visit": v, "sentiment": sen, "response": "", "moderationNote": "", **_meta()}
        for c, t, s, r, loc, rate, st, off, ch, txt, v, sen in rows
    ])


async def seed_omni(db):
    if await _empty(db, "omni_templates"):
        rows = [
            ("TPL-01", "Appointment Confirmation", "WhatsApp", "Utility", "Approved", "Hello {{patient_name}}, your appointment at DENTOR is confirmed for {{date}} at {{time}}."),
            ("TPL-02", "Treatment Follow-up", "SMS", "Clinical", "Approved", "Dear {{patient_name}}, how are you feeling after your {{treatment}}? Contact us if you need assistance."),
            ("TPL-03", "Payment Reminder", "WhatsApp", "Utility", "Approved", "Hello {{patient_name}}, a balance of {{amount}} is pending for invoice {{invoice_no}}."),
            ("TPL-04", "Recall Reminder", "Email", "Retention", "Draft", "It is time for your periodic dental check-up. Book your preferred appointment slot."),
            ("TPL-05", "Lab Case Ready", "SMS", "Laboratory", "Approved", "Your dental restoration is ready. Please contact DENTOR to schedule your appointment."),
            ("TPL-06", "Birthday Greeting", "WhatsApp", "Engagement", "Approved", "Happy Birthday {{patient_name}}! DENTOR wishes you a healthy and confident smile."),
        ]
        await db.omni_templates.insert_many([
            {"code": c, "name": n, "channel": ch, "category": cat, "status": st, "text": txt, **_meta()}
            for c, n, ch, cat, st, txt in rows
        ])
    if await _empty(db, "omni_campaigns"):
        rows = [
            ("CMP-2609", "Six-Month Recall Campaign", "WhatsApp + SMS", 284, 260, 252, 91, "Running", d(-2)),
            ("CMP-2608", "Implant Awareness", "Email + WhatsApp", 420, 420, 402, 138, "Completed", d(-7)),
            ("CMP-2607", "Pending Treatment Follow-up", "WhatsApp", 86, 86, 83, 47, "Completed", d(-11)),
            ("CMP-2606", "Children Dental Check-up", "SMS", 190, 0, 0, 0, "Scheduled", d(5)),
        ]
        await db.omni_campaigns.insert_many([
            {"code": c, "name": n, "channel": ch, "audience": a, "sent": s, "delivered": dl,
             "engaged": e, "status": st, "date": dt, **_meta()}
            for c, n, ch, a, s, dl, e, st, dt in rows
        ])
    if await _empty(db, "omni_conversations"):
        rows = [
            ("Ravi Kumar", "DEN-1001", "WhatsApp", "10:42 AM", 2, "Open", "Dr. Kumar", "+91 98765 43210", "Root Canal Follow-up", "Opted-in",
             [["in", "Doctor, slight pain after yesterday's session. Is that normal?", "10:40 AM"], ["in", "Should I continue the medicines?", "10:42 AM"]]),
            ("Anjali Devi", "DEN-1003", "Instagram", "09:58 AM", 1, "Open", "Reception", "+91 98765 43212", "Clear Aligners Enquiry", "Social inquiry",
             [["in", "Hi! How much do clear aligners cost?", "09:58 AM"]]),
            ("Siva Prakash", "DEN-1002", "SMS", "Yesterday", 0, "Pending", "Dr. Anitha", "+91 98765 43211", "Crown Review", "Opted-in",
             [["out", "Dear Siva, your crown trial is scheduled tomorrow at 3 PM.", "Yesterday"], ["in", "Ok doctor, I will come.", "Yesterday"]]),
            ("Meena Lakshmi", "DEN-1005", "Email", "Yesterday", 0, "Resolved", "Reception", "+91 98765 43214", "Invoice Copy", "Opted-in",
             [["in", "Please send a copy of my last invoice.", "Yesterday"], ["out", "Sure Meena, the invoice copy has been emailed to you.", "Yesterday"]]),
            ("Joseph Antony", "DEN-1006", "Website Chat", "Mon", 0, "Open", "Unassigned", "+91 98765 43215", "Extraction Aftercare", "Web session",
             [["in", "What foods should I avoid after extraction?", "Mon"]]),
        ]
        await db.omni_conversations.insert_many([
            {"name": n, "patientId": pid, "channel": ch, "time": t, "unread": u, "status": st,
             "assigned": asg, "phone": ph, "topic": tp, "consent": con, "messages": msgs, **_meta()}
            for n, pid, ch, t, u, st, asg, ph, tp, con, msgs in rows
        ])


async def seed_schedule_notes(db):
    if not await _empty(db, "schedule_notes"):
        return
    rows = [
        ("SN-1001", "09:15", "Schedule", "Morning clinical briefing", "Daily team sync on today's cases", "", "Clinical Team", "High"),
        ("SN-1002", "13:30", "Note", "Call implant patients", "Confirm post-op reviews for this week", "", "Reception", "Medium"),
        ("SN-1003", "17:45", "Schedule", "Daily collection review", "Verify day's collections and pending balances", "", "Dr. Admin", "Normal"),
    ]
    await db.schedule_notes.insert_many([
        {"code": c, "date": d(0), "time": t, "type": ty, "title": ti, "details": de,
         "patient": p, "assigned": a, "priority": pr, "status": "Pending",
         "reminder": "15 minutes", "color": "#0d9488", **_meta()}
        for c, t, ty, ti, de, p, a, pr in rows
    ])


async def seed_staff(db):
    if not await _empty(db, "staff"):
        return
    rows = [
        ("EMP-101", "Dr. Admin", "Administrator", "Administration", "9733929933", "admin@dentor.in", "Full Time", 0),
        ("EMP-102", "Dr. Kumar", "Senior Dentist", "Clinical", "9733929934", "kumar@dentor.in", "Full Time", 95000),
        ("EMP-103", "Dr. Anitha", "Resident Consultant", "Clinical", "9733929935", "anitha@dentor.in", "Full Time", 78000),
        ("EMP-104", "Dr. Gowtham", "Implantologist", "Clinical", "9733929936", "gowtham@dentor.in", "Full Time", 92000),
        ("EMP-105", "Priya S", "Receptionist", "Front Desk", "9733929937", "priya@dentor.in", "Full Time", 24000),
        ("EMP-106", "Senthil M", "Dental Assistant", "Clinical", "9733929938", "senthil@dentor.in", "Full Time", 20000),
        ("EMP-107", "Lakshmi R", "Pharmacist", "Pharmacy", "9733929939", "lakshmi@dentor.in", "Part Time", 18000),
    ]
    await db.staff.insert_many([
        {"code": c, "name": n, "role": r, "department": dep, "mobile": m, "email": e,
         "employment": emp, "salary": sal, "status": "Active", "joined": d(-400), **_meta()}
        for c, n, r, dep, m, e, emp, sal in rows
    ])


async def seed_frs(db):
    if not await _empty(db, "frs_records"):
        return
    rows = [
        ("FRS-1001", "Ravi Kumar", "DEN-1001", "Zirconia Crown · 46", 8500, 80, "Treatment Accepted", 1, "Dr. Kumar"),
        ("FRS-1002", "Siva Prakash", "DEN-1002", "Implant · 36 Region", 35000, 65, "Plan Presented", 2, "Dr. Gowtham"),
        ("FRS-1003", "Anjali Devi", "DEN-1003", "Teeth Whitening", 9000, 50, "Estimate Shared", 1, "Dr. Anitha"),
        ("FRS-1004", "Karthik Raj", "DEN-1004", "Full Mouth Rehabilitation", 250000, 65, "Clinical Evaluation", 3, "Dr. Gowtham"),
        ("FRS-1005", "Meena Lakshmi", "DEN-1005", "Denture Reline", 6500, 35, "Consultation", 2, "Dr. Anitha"),
        ("FRS-1006", "Joseph Antony", "DEN-1006", "Implant · Extraction Site", 35000, 50, "Follow-up Due", 1, "Dr. Kumar"),
    ]
    def month(off):
        dt = date.today() + timedelta(days=30 * off)
        return dt.strftime("%b %Y")
    await db.frs_records.insert_many([
        {"code": c, "patient": p, "patientId": pid, "treatment": t, "value": v, "probability": prob,
         "weightedValue": round(v * prob / 100), "stage": st, "expected": month(off), "doctor": doc,
         "completionStatus": "Pending Treatment", "revenueStatus": "Forecast Only — Not Recognized",
         "source": "Clinical Pipeline", **_meta()}
        for c, p, pid, t, v, prob, st, off, doc in rows
    ])


async def seed_settings(db, overrides: dict | None = None):
    if await db.app_settings.find_one({"key": "settings"}):
        return
    await db.app_settings.update_one(
        {"key": "settings"},
        {"$set": {"values": {
            "clinicName": "DENTOR Dental Clinic",
            "legalName": "Thiru.Pathy Dento Facial Centre",
            "phone": "+91 73392 99339",
            "email": "admin@dentor.in",
            "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
            "timezone": "Asia/Kolkata",
            "currency": "INR",
            "dateFormat": "DD/MM/YYYY",
            "gstin": "33ABCDE1234F1Z5",
            "registration": "TNDC-TPDFC-2026",
            "invoicePrefix": "DEN-INV",
            "receiptPrefix": "DEN-RCP",
            "toothNumbering": "FDI",
            "apptDuration": "30",
            "financialLock": True,
            "apptReminder24": True,
            "lowStockAlert": True,
            "notifyWhatsApp": True,
            "notifySms": True,
            "partialPayments": True,
            "consentRequired": True,
            "allergyAlert": True,
            "smartQueue": True,
            "onlineBooking": False,
            "doubleBooking": False,
            "twoFactor": False,
            "sessionTimeout": True,
            "strongPassword": True,
            **(overrides or {}),
        }, "updated_at": now_iso()}},
        upsert=True,
    )
    await db.app_settings.update_one(
        {"key": "advertisement"},
        {"$set": {"values": {
            "title": "Create & Manage Clinic Advertisement",
            "subtitle": "Promote treatments, offers, awareness campaigns and clinic announcements.",
            "button": "Manage Advertisement",
            "destination": "Appointments",
            "audience": "All Dashboard Users",
            "status": "Active",
            "image": "",
        }, "updated_at": now_iso()}},
        upsert=True,
    )

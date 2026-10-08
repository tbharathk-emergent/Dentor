from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import db
from .migrate import ensure_tenancy
from .routers import billing, misc, platform
from .routers.auth_router import router as auth_router
from .routers.resource import crud_router
from .seed import ensure_seed
from .tenancy import TenantDB


@asynccontextmanager
async def lifespan(app: FastAPI):
    demo_clinic_id = await ensure_tenancy(db, [name for name, _, _ in RESOURCES])
    await ensure_seed(TenantDB(db, demo_clinic_id))
    yield


app = FastAPI(title="Dentor API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(misc.router)
app.include_router(billing.router)
app.include_router(platform.router)

# (resource, search fields, code field config)
RESOURCES = [
    ("patients", ["name", "code", "mobile", "treatment", "doctor", "email"], dict(code_field="code", code_prefix="DEN-", code_start=1050)),
    ("appointments", ["patient", "code", "treatment", "doctor", "date", "chair"], dict(code_field="code", code_prefix="APT-", code_start=5001)),
    ("consultants", ["name", "code", "specialty", "location"], dict(code_field="code", code_prefix="CON-", code_start=107)),
    ("consultant_bookings", ["patient", "consultant", "code", "reason"], dict(code_field="code", code_prefix="CNS-", code_start=2001)),
    ("invoices", ["number", "patient", "patientCode", "treatment", "doctor"], dict(code_field="number", code_prefix="CLN-INV-", code_start=2849)),
    ("payments", ["receipt", "patient", "invoice", "mode"], {}),
    ("workflow_records", ["patient", "reference", "type", "code"], {}),
    ("prescriptions", ["patient", "code", "doctor", "diagnosis"], dict(code_field="code", code_prefix="RX-", code_start=1001)),
    ("rx_combos", ["name"], {}),
    ("pharmacy_items", ["name", "code", "category", "batch"], dict(code_field="code", code_prefix="MED-", code_start=1011)),
    ("pharmacy_bills", ["number", "patient"], dict(code_field="number", code_prefix="PH-INV-", code_start=1001)),
    ("lab_orders", ["code", "patient", "caseType", "lab", "doctor"], dict(code_field="code", code_prefix="LAB-", code_start=2685)),
    ("lab_payments", ["receipt", "order", "patient", "lab"], dict(code_field="receipt", code_prefix="LAB-RCP-", code_start=1001)),
    ("inventory_items", ["name", "code", "category", "supplier"], dict(code_field="code", code_prefix="INV-", code_start=107)),
    ("inventory_suppliers", ["name", "code", "city", "gstin"], dict(code_field="code", code_prefix="SUP-", code_start=104)),
    ("inventory_movements", ["item", "reference", "type", "department"], {}),
    ("inventory_purchases", ["code", "supplier", "invoice", "item"], dict(code_field="code", code_prefix="PUR-", code_start=3001)),
    ("leads", ["name", "phone", "email", "interest", "source", "code"], dict(code_field="code", code_prefix="LD-", code_start=26098)),
    ("reviews", ["reviewer", "subject", "text", "channel", "code"], dict(code_field="code", code_prefix="RV-", code_start=26056)),
    ("omni_conversations", ["name", "patientId", "topic", "channel"], {}),
    ("omni_templates", ["name", "text", "category"], dict(code_field="code", code_prefix="TPL-", code_start=7)),
    ("omni_campaigns", ["name", "code", "channel"], dict(code_field="code", code_prefix="CMP-", code_start=2610)),
    ("schedule_notes", ["title", "patient", "details", "assigned"], dict(code_field="code", code_prefix="SN-", code_start=1004)),
    ("masters", ["name", "type", "module", "code", "detail"], {}),
    ("treatment_masters", ["name", "code", "category"], {}),
    ("staff", ["name", "code", "role", "department", "mobile"], dict(code_field="code", code_prefix="EMP-", code_start=108)),
    ("certificates", ["code", "patient", "type", "doctor"], {}),
    ("payslips", ["code", "employee", "period"], {}),
    ("frs_records", ["patient", "treatment", "stage", "doctor", "code"], {}),
    ("frs_outbox", ["patient", "treatment", "recipient"], {}),
    ("patient_timeline", ["patientId", "name", "doctor"], {}),
    ("charts", ["patientId", "type"], {}),
    ("queue", ["token", "patient", "stage"], {}),
    ("waitlist", ["patient", "treatment", "doctor"], {}),
    ("credit_notes", ["code", "patient", "invoice", "type"], {}),
    ("day_closures", ["code", "date"], {}),
    ("saved_reports", ["name", "source"], {}),
    ("patient_files", ["patientId", "name", "category"], {}),
    ("activities", ["message", "type", "user"], {}),
    ("patient_treatments", ["patientId", "name", "doctor", "status"], {}),
    ("patient_procedures", ["patientId", "name", "doctor", "status"], {}),
    ("patient_consents", ["patientId", "title", "status"], {}),
]

for name, fields, extra in RESOURCES:
    app.include_router(crud_router(name, fields, **extra))


@app.get("/api/health")
async def health():
    return {"ok": True}

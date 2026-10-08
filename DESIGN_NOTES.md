# Dentor Redesign — Functional Parity & UX Improvements

Reference app: https://lively-dance-effects.lovable.app (single 1.58 MB static HTML file;
all data in-memory/localStorage, most dashboards hardcoded). The rebuild is a real
client–server product with persistent MongoDB storage behind every screen.

## Module parity

| Original module | Rebuilt as | Status |
|---|---|---|
| Login / auth (admin, lockout, change password) | `/login`, JWT + bcrypt, change-password in Settings | ✅ (server-side auth replaces client-side SHA-256) |
| Dashboard (8 KPI cards — mostly fake) | `/` — all KPIs computed live from DB | ✅ improved |
| Patients directory + add form + OTP step | `/patients` — grid/list, risk filter, streamlined form | ✅ (OTP step dropped — was decorative) |
| Patient profile (12 tabs incl. fake ones) | `/patients/:id` — 8 real tabs (Overview, Treatments, Procedures, Dental Chart, Files, Invoices, Consents, Timeline) | ✅ |
| Appointments (calendar, drag-drop, bulk reschedule) | `/appointments` — day grid + week strip + list, click-slot booking, conflict check, status workflow | ✅ (drag-drop → tap-based reschedule via edit dialog; mobile-safe) |
| Smart Queue / Rapid Registration side panels | Check-in / Waiting / Complete workflow on dashboard & appointments | ✅ simplified (token TV display dropped) |
| Book a Consultant (3-step wizard, mirror appointment) | `/book-consultant` — wizard, slot blocking, monthly duplicate guard, mirror appointment | ✅ |
| Consultants roster (read-only in original) | `/consultants` — roster + **add/edit/delete** (missing in original) | ✅ improved |
| Clinical Chart / Perio / Ortho | `/clinical` — per-patient perio grid (6 sites, CAL auto-calc, thresholds) + ortho (exam/occlusion/ceph with norms/plan/progress) | ✅ |
| FRS (Future Revenue Scope, 7 overlapping layers) | `/frs` — one coherent pipeline board with weighted forecast, archive, reminder → schedule note | ✅ consolidated |
| E-Prescription (7 tabs, wizard, builder, pediatric calc) | `/prescriptions` — compose + combos + history + print (A5 letterhead) | ✅ core flows (pediatric dose calculator not ported) |
| Pharmacy (10 tabs, POS) | `/pharmacy` — stock, dispense POS (stock decrement, GST), bills | ✅ |
| Lab orders + advanced payments | `/lab` — stage board, orders, payment with outstanding cap/TDS/reference rules | ✅ |
| Inventory (items/movements/purchases/suppliers) | `/inventory` — same four tabs, stock math enforced | ✅ |
| Accounts (invoices, payments, ledger, financial lock) | `/accounts` — invoices w/ line items & GST, payment recording w/ server-side balance invariants, patient ledger; financial masking on dashboard | ✅ (day-closure/credit-note registers not ported) |
| Reports (static numbers + saved reports) | `/reports` — live aggregations (by doctor/treatment/mode), registers w/ CSV, custom report builder + saved reports | ✅ improved |
| Reviews + Google integration skeleton | `/reviews` — moderation, bulk actions, responses, distribution/sources, CSV | ✅ (Google OAuth skeleton not ported — needs real credentials) |
| Omnichannel (7 tabs, simulated sending) | `/omni` — inbox, templates, campaigns with live preview/cost | ✅ (sending still logged-only; needs a gateway) |
| Lead Generation | `/leads` — kanban + table + follow-ups; **Convert now creates a real patient** (original only flipped a status) | ✅ improved |
| Masters (9 modules × types) | `/masters` | ✅ |
| Staff | `/staff` (payslip generator not ported) | ✅ core |
| Certificates (medical/fitness/referral) | `/certificates` — numbered, printable | ✅ |
| Settings (12 sections, ~40 toggles) | `/settings` — identity, billing, clinical, toggle groups, advertisement manager, password change, JSON export | ✅ |
| Schedule Notes | `/schedule-notes` + dashboard card | ✅ |

## Major UX improvements

1. **Workflow-first**: register / book / check-in / collect are one tap from the dashboard;
   global ⌘K search over patients, appointments and invoices from anywhere.
2. **Honest numbers**: every KPI, chart and counter is computed from the database —
   the original dashboard was largely hardcoded (148 patients, ₹12.8L etc.).
3. **Mobile-first**: bottom navigation with a prominent center “+” action, bottom-sheet
   dialogs, card lists instead of squeezed tables, safe-area support. No horizontal overflow.
4. **Fewer clicks**: appointment booking from any empty slot; patient creation inline inside
   booking/billing flows; payment collection directly from the invoice row.
5. **Guardrails**: double-booking conflict warnings (doctor + chair), payment-exceeds-balance
   blocks, stock-insufficient blocks, confirmation dialogs on all destructive actions,
   specific inline validation messages.
6. **Consistency**: one design system (teal/slate, Inter, shared status→color mapping,
   skeletons, empty states, toasts) across all 21 modules.

## Known gaps vs the original (candidates for Phase 2)

- Voice assistant / dictation, weather widget, Scan & OCR intake, confetti moments.
- Financial controls sub-registers (credit notes, refunds, day closure, audit export).
- Payslip generator; pediatric dose calculator; prescription header/footer image upload.
- Google Business reviews OAuth sync (needs real Google Cloud credentials + backend tokens).
- Omnichannel real delivery (needs WhatsApp/SMS/email gateway credentials).

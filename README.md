# Dentor — Clinic Management (Rebuild)

Modern rebuild of the Dentor Reception Application (functional reference:
https://lively-dance-effects.lovable.app) as a real client–server product:

- **Frontend** — React 19 + Vite + TypeScript + Tailwind CSS v4, mobile-first design system (`frontend/`)
- **Backend** — FastAPI + Motor (async MongoDB), JWT auth (`backend/`)
- **Database** — MongoDB (`dentor` database), seeded automatically with demo data on first start

## Run it

Prereqs: Node 20+, [uv](https://docs.astral.sh/uv/), MongoDB running on `mongodb://127.0.0.1:27017`.

```bash
# One-time setup
npm install                 # root helper (concurrently)
cd frontend && npm install && cd ..
cd backend && uv sync && cd ..

# Start everything (backend :8000 + frontend :5173)
npm run dev
```

Or run them separately:

```bash
cd backend && uv run uvicorn app.main:app --reload    # http://127.0.0.1:8000, Swagger at /docs
cd frontend && npm run dev                            # http://localhost:5173 — proxies /api
```

Sign in with **admin@dentor.in / Dentor@2026** (demo clinic admin), or
**superadmin@dentor.in / SuperAdmin@2026** for the platform console at `/platform`
(onboard clinics, manage their logins, suspend/reactivate, jump into any clinic).

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DENTOR_ENV` | `development` | `production` enables fail-fast safety checks, disables `/docs` |
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | MongoDB connection |
| `DB_NAME` | `dentor` | Database name |
| `JWT_SECRET` | dev value | **Required in production** (≥32 chars, e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRE_MINUTES` | `720` | Token lifetime (clinics with "Session timeout" on get 30 min) |
| `SUPER_ADMIN_EMAIL` | `superadmin@dentor.in` | Platform admin login |
| `SUPER_ADMIN_PASSWORD` | — | **Required in production**; also rotates a defaulted account at startup |
| `SEED_DEMO` | `1` in dev, `0` in production | Demo clinic + demo data on first start |
| `CORS_ORIGINS` | localhost dev origins | Only needed if the frontend is served from another origin |
| `MAX_BODY_BYTES` | `16777216` | Request body cap (file uploads are base64 JSON) |

Production boot refuses to start with a default/weak `JWT_SECRET` or a super admin still on
the default password, and seeds no demo data. Login endpoints are rate limited (30/min per IP,
plus a 5-failure lockout per IP+account). Business rules from Settings — double booking,
partial payments, consent-before-treatment, strong passwords, session timeout, financial lock —
are enforced by the API, not just the UI.

Demo data is seeded only into empty collections — user data is never overwritten.
To reset: drop the `dentor` database and restart the backend.

## Architecture notes

- `backend/app/routers/resource.py` — generic CRUD router factory used by ~40 collections
  (search, filters, sorting, auto-generated codes like `DEN-1050`, `CLN-INV-2849`).
- `backend/app/routers/billing.py` — payment recording with invoice balance/status invariants.
- `backend/app/routers/misc.py` — global search, live dashboard KPIs, settings, advertisement.
- `frontend/src/components/ui/` — the Dentor design system (buttons, fields, dialogs/bottom-sheets,
  tabs, badges with shared status→color mapping, data tables that collapse to cards on mobile).
- `frontend/src/lib/hooks.ts` — React-Query CRUD hooks + INR/date formatters.

## Design system

Teal/emerald healthcare palette on soft slate neutrals, Inter typeface, 12px-radius cards,
desktop sidebar + compact mobile bottom navigation with a prominent **+ New Appointment** action.
All destructive actions confirm; all mutations toast; every list has loading skeletons and empty states.

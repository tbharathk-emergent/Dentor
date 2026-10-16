# Dentor — Clinic Management (Rebuild)

Modern rebuild of the Dentor Reception Application (functional reference:
https://lively-dance-effects.lovable.app) as a real client–server product:

- **Frontend** — React 19 + Vite + TypeScript + Tailwind CSS v4, mobile-first design system (`frontend/`).
  The reception app and the Super Admin console; installable as a PWA.
- **Mobile apps** — Patient, Consultant and Dentor Clinic (formerly Owner) apps for Android and iOS:
  React Native (Community CLI, native projects, no Expo) in one workspace (`mobile/`). The Clinic app
  is the clinic's working app for owners, administrators, dentists, receptionists and accountants:
  appointments, patients, booking visiting consultants, labs, prescriptions, certificates, recall,
  accounts and expenses, offers, chat and support, with what each role may do enforced by the API
- **Backend** — FastAPI + Motor (async MongoDB), JWT auth (`backend/`), one API for all four apps
- **Database** — MongoDB (`dentor` database), seeded automatically with demo data on first start

| Document | What it is for |
|---|---|
| [`docs/BUILD_AND_DEPLOYMENT_GUIDE.md`](docs/BUILD_AND_DEPLOYMENT_GUIDE.md) | **Main guide**: run, test and build all four apps locally, and prepare each for production and the stores |
| [`docs/DEPLOYMENT_CHECKLIST.md`](docs/DEPLOYMENT_CHECKLIST.md) | Production release checklist: backup, upgrade check, environment, rollback, smoke tests, Android signing |
| [`docs/BUILD_COMMANDS.md`](docs/BUILD_COMMANDS.md) | One-page build commands for all four apps, with what was verified and what is blocked |
| [`docs/WEB_BUILD.md`](docs/WEB_BUILD.md) | Building and testing the web reception app and Super Admin console |
| [`docs/MOBILE_BUILD.md`](docs/MOBILE_BUILD.md) | Building and running all four apps: web, Android, iOS, release builds, settings, tests |
| [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) | What is still needed before a release: devices, SMS, push, signing, security, configuration |
| [`docs/SCOPE_CHANGE.md`](docs/SCOPE_CHANGE.md) | How the scope grew to four apps, and what deploying changes for clinics that use the web app today |
| [`docs/CONSISTENCY_AUDIT.md`](docs/CONSISTENCY_AUDIT.md) | Where the four apps agreed, what was aligned, and open inconsistencies in the web app and API |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | The designed features: gap analysis, who may do what, the agreed exclusions the designs run into, and what each phase built and tested |
| [`docs/DESIGN_REVIEW.md`](docs/DESIGN_REVIEW.md) | Frame-by-frame comparison with the Figma designs (15 October): functional, visual and responsive status of all 530 frames |
| [`docs/REMEDIATION_PLAN.md`](docs/REMEDIATION_PLAN.md) | Every unfinished design frame: classification against the documented scope, fix, dependencies and status |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Email, SMS, push and fingerprint sign-in: exact settings, what the API sends, and how to test each on real devices |
| [`docs/BUSINESS_CONTENT.md`](docs/BUSINESS_CONTENT.md) | Content Dentor must provide before release (legal text, contacts, store, plans, points, labs) |
| [`docs/MOBILE_API.md`](docs/MOBILE_API.md) | The API the mobile apps use |
| [`mobile/README.md`](mobile/README.md) | How the mobile workspace is organised |

## Run it

Prereqs: Node 22.11+ (the web app alone also runs on Node 20), [uv](https://docs.astral.sh/uv/), MongoDB running on `mongodb://127.0.0.1:27017`.

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

To run a mobile app as well (patient shown; `consultant` and `owner` work the same), with the
API running as above:

```bash
cd mobile && npm install                                  # once
cd apps/patient && npm start                              # terminal 1: Metro
cd apps/patient && adb reverse tcp:8000 tcp:8000 && npm run android    # terminal 2: Android emulator
cd apps/patient/ios && pod install && cd .. && npm run ios             # terminal 2: iPhone simulator
```

The mobile apps are React Native with native Android (Gradle) and iOS (Xcode) projects. Expo
is not used. Toolchain versions and release builds are in `docs/MOBILE_BUILD.md`.

Sign in with **admin@dentor.in / Dentor@2026** (demo clinic admin), or
**superadmin@dentor.in / SuperAdmin@2026** for the platform console at `/platform`
(onboard clinics, manage their logins, suspend/reactivate, jump into any clinic).
Demo logins for the mobile apps are listed in `docs/MOBILE_BUILD.md`.

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
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | `console` in dev, off in production | One-time codes for the patient app. `webhook` posts each message to your SMS gateway; without it, production refuses code requests |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | off | Push delivery through your FCM / APNs adapter; without it, notifications stay in-app |
| `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES` | `30`, `60` | Mobile session lifetimes (rotating refresh tokens) |
| `NOTIFICATION_RETENTION_DAYS` | `180` | In-app notifications are deleted after this many days (`0` keeps them) |

Production boot refuses to start with a default/weak `JWT_SECRET` or a super admin still on
the default password, and seeds no demo data. Login endpoints are rate limited (30/min per IP,
plus a 5-failure lockout per IP+account). Signing out ends that session on the server, and
changing or resetting a password, or deactivating a login, ends every existing session of
that login: in each case the token stops working at once, not when it would have expired. Business rules from Settings — double booking,
partial payments, consent-before-treatment, strong passwords, session timeout, financial lock —
are enforced by the API, not just the UI.

Demo data is seeded only into empty collections — user data is never overwritten.
To reset: drop the `dentor` database and restart the backend.

## Tests never touch production

- `cd backend && uv run pytest` creates and drops a database called `dentor_test`. It refuses
  to start unless `MONGO_URL` points at a MongoDB on this machine.
- The browser suites (`frontend/e2e`, `mobile/e2e`) create and delete real records. They
  refuse any app or API address that is not on this machine (`E2E_ALLOW_REMOTE=1` permits a
  test server) and always refuse the production hosts.
- The native smoke flows (`mobile/e2e/native`) stop before typing a password unless the app
  is a debug build. Release builds talk to the production API; debug builds to
  `http://localhost:8000`.

How the scope grew from one web app to four apps, and what deploying the new backend changes
for the live reception app: [`docs/SCOPE_CHANGE.md`](docs/SCOPE_CHANGE.md).

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

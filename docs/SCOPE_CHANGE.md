# Dentor scope change: from one web app to four apps

This records how Dentor's scope grew on 13 October 2026, what was decided as a result, what it
costs, and how to change course. Nothing described here has been committed, pushed or
deployed: it exists only as uncommitted changes in this repository (see "Status" at the end).

## Before the change

Dentor was one product: the clinic reception web app, with a Super Admin console for the
platform owner.

| When | What existed |
| --- | --- |
| 8 Oct 2026 | The Lovable reception app rebuilt as React + FastAPI + MongoDB (commit `b70ec0d`). |
| 8–9 Oct 2026 | Multi-clinic tenancy, the Super Admin console, production hardening and deployment (commits up to `211c0d2`). |
| 9 Oct 2026 | Live at `dentor.localappstore.in` (web) and `dentorapi.localappstore.in` (API). |

At that point the confirmed scope was "web application only". Features explicitly left for a
later phase were: voice assistant, OCR intake, day closure with credit notes and refunds,
payslips, paediatric dose calculator, prescription letterhead, Google Reviews sign-in, and
real WhatsApp or SMS gateways.

## The change request

On 13 October three Figma files were shared with this instruction:

> The 3 Figma links has the Screen Designs, Workflows, Buttons, themes, Menu Options, Tabs,
> Lists, Details, Reports etc of the Super Admin (Web PWA), Patient APP (Native APP),
> Consultant APP (Native APP) and Clinic Owner APP (Native APP). Add these features to the
> already developed Dentor reception application … design the architecture and apps
> accordingly that connect to the existing Dentor reception Web PWA already created.

Two follow-up instructions shaped the work: build all four apps end to end without waiting
for approval at each stage, and do not use Expo for developing, running or building the apps.

So the scope went from one web app to four apps on one API:

| App | Users | Form |
| --- | --- | --- |
| Reception app and Super Admin console | Clinic staff, platform owner | Web, installable (PWA). Existed; extended. |
| Dentor | Patients | Android and iOS. New. |
| Dentor Consultant | Visiting doctors | Android and iOS. New. |
| Dentor Owner | Clinic owners | Android and iOS. New. |

## Decisions and their reasons

**Three separate native apps, not one app with a role switch.** The request names three apps.
Beyond that: each has a different audience and store listing; a patient never downloads staff
screens; and the API can refuse a login outright in the wrong app (a front-desk login cannot
sign in to the Consultant app, and so on).

**React Native, one code base for Android and iOS.** Building each app twice in Kotlin and
Swift would double the work for the same screens. The three apps share one package (API
client, session handling, navigation, design tokens, UI kit, sign-in, notifications and
change-password screens), so a fix there reaches all three.

**React Native Community CLI with native projects, no Expo.** This was an explicit
instruction. The apps were first scaffolded on Expo and were moved off it the same day; the
Expo-era workspace is archived, not lost (see "Status").

**The web app stays one app.** The Super Admin console already lived inside the reception web
app. It gained a platform overview, owner logins and consultant links, and the whole web app
became installable. A separate Super Admin app would have duplicated it.

**One API, extended.** The new apps use new, role-scoped endpoint groups (`/api/patient`,
`/api/consultant`, `/api/owner`, `/api/clinic/users`, `/api/notifications`: 71 routes) beside
the existing reception endpoints. Reception data is not copied: an appointment booked in the
patient app is the same record the front desk sees.

**Design came second.** The apps were built before the three Figma files could be read, from
the product's existing data and workflows. On 14 October every frame was compared and the
apps took the designs' brand, fonts, artwork and navigation chrome; many designed features
are still not built (see "Open items"), so the apps are not design-complete.

## Size of what was added

| Part | Size |
| --- | --- |
| Patient app | 30 screens, about 6,600 lines |
| Consultant app | 16 screens, about 3,700 lines |
| Owner app | 10 screens, about 2,500 lines |
| Shared mobile package | about 2,300 lines |
| API additions (new modules) | about 2,600 lines, 71 routes |
| Automated tests | API tests, four browser suites, native smoke flows: about 6,000 lines |

## What deploying this would change for the live reception app

The new backend is a superset of the live one, but seven behaviours of the *existing*
reception app change when it is deployed. For each: who it could hurt, what now guards
against that, and what to do at rollout.

Before any of it, run the read-only check against the database the new backend will serve.
It lists every clinic and marks what must be fixed first (it changes nothing):

```sh
cd backend && uv run python -m app.preflight
```

### 1. Only a Clinic Owner or an Administrator may change settings and the advertisement

- **Before:** any signed-in clinic login could.
- **Who is affected:** Receptionist, Doctor, Pharmacist and Accountant logins that change
  settings today. A clinic with no Owner or Administrator login would have nobody who can.
- **Safeguards:** the check marks any active clinic without an Owner or Administrator as
  "fix first". The new web app shows Settings read-only to other roles with the reason. The
  web app that is live today shows the API's message ("Only the clinic owner or an
  administrator can do this.") and changes nothing; this was run and confirmed.
- **At rollout:** tell clinics; where needed the Super Admin gives a login the Administrator
  role in the platform console.

### 2. The role "Consultant" is for the Consultant app only

- **Before:** the role did not exist as a choice (Administrator, Doctor, Receptionist,
  Pharmacist, Accountant). "Doctor" is unchanged and still uses the web app.
- **Who is affected:** only a login that was somehow given the role "Consultant". It is
  refused by the web app, and by the Consultant app too unless it is linked to a consultant
  profile.
- **Safeguards:** the check lists every Consultant login and marks unlinked ones "fix first".
  The API refuses to create an unlinked Consultant login.
- **At rollout:** link such logins to their profile, or give them the role Doctor.

### 3. New role "Clinic Owner"

- **Before:** a clinic's first login was an Administrator.
- **Who is affected:** nobody loses anything. Existing clinics have no owner, so nobody there
  can sign in to the Owner app, and an Administrator cannot create an owner.
- **Safeguards:** the check notes each clinic without an owner.
- **At rollout:** the Super Admin adds an owner login (or changes one login's role) for each
  clinic that should use the Owner app.

### 4. Sessions end on the server

- **Before:** signing out only cleared the browser, and a password change or reset left the
  old session usable until it expired (30 minutes or 12 hours).
- **Who is affected:** nobody is signed out by the upgrade. People signed in before it stay
  signed in with the token they have, and the web app they have open keeps working. This was
  run and confirmed, and is covered by tests.
- **Safeguards:** tokens from before the upgrade are accepted until they expire; a password
  reset or deactivation ends them like any other.
- **At rollout:** nothing.

### 5. Notifications are recorded

- **Before:** nothing was recorded.
- **Who is affected:** nobody directly. Every booking, bill, payment, prescription and chat
  reply at the front desk now writes notifications for the patient, the doctor and the desk,
  whether or not anyone uses the apps, so the collection grows.
- **Safeguards:** each notification is deleted automatically 180 days after it was created
  (`NOTIFICATION_RETENTION_DAYS`; 0 keeps them for ever).
- **At rollout:** choose the number of days if 180 is not right.

### 6. New collections and indexes are created at start-up

- **Before:** these collections did not exist.
- **Who is affected:** nobody. Only new collections are touched (patient accounts, sessions,
  one-time codes, device tokens, notifications); no existing document is changed.
- **Safeguards:** start-up was read line by line for this, and the original API tests (27,
  unchanged since the last commit) pass against the new backend.
- **At rollout:** back up the database first, as for any release.

### 7. Patient sign-up needs an SMS gateway, and each clinic opts in

- **Before:** there was no patient sign-up.
- **Who is affected:** patients of a clinic that expects the app to work on day one. Without
  a gateway the API refuses to send codes (sign-up, code login, reset by code); password
  login works. Separately, a clinic that existed before the upgrade has "Patient app
  booking" off until its owner or administrator switches it on, so the upgrade exposes no
  existing clinic to self-registration.
- **Safeguards:** production never falls back to showing codes on screen. The Super Admin
  console shows whether SMS and push are connected. The check reports both, per clinic.
- **At rollout:** connect the gateway before announcing the patient app, then switch booking
  on clinic by clinic.

### Order of deployment

1. **Backend first.** It serves the web app that is live today without changes: that web app
   was built from the last commit and run against the new backend (sign-in, all 21 pages,
   saving settings, the Super Admin console). The check is `frontend/e2e/previous-release.compat.mjs`.
2. **Then the web app.** The new web app needs the new backend (it saves settings with a call
   the old backend does not have), so never deploy it first.
3. **Then the mobile apps**, when the stores and outside services are ready.

## Costs and risks the change brings

- **Three more things to release.** Each app needs store accounts, signing keys, review
  cycles and version management on two stores.
- **Operational dependencies** that the web app did not have: an SMS gateway for patient
  sign-up, and a push service (Firebase and APNs) if notifications should reach a phone that
  is not showing the app.
- **A larger attack surface.** Patients now reach the API directly. This is why the work
  includes server-side roles, per-app login, one-time-code throttling, rotating sessions and
  isolation tests between patients, consultants, owners and clinics.
- **Design risk.** Until the Figma files are compared screen by screen, the apps may differ
  from what was designed in layout, navigation or content.
- **Scope creep in the other direction.** Items that are still out of scope: everything in
  the later-phase list above, online payment in the patient app, and real SMS, WhatsApp and
  push providers.

## How to change course

All of the following are possible without losing work, because the four parts are separate:

- **Ship fewer apps.** Each app lives in its own folder (`mobile/apps/patient`,
  `consultant`, `owner`) and can be released or held back on its own. The API parts for an
  unreleased app can stay deployed; they are unreachable without a login of that role.
- **Ship web only for now.** Deploying only the backend and the web app delivers the staff
  logins screen, the notification bell and the installable web app, with the seven behaviour
  changes above. The mobile endpoints stay dormant, and no clinic is open to patient
  registration until "Patient app booking" is switched on for it.
- **Offer a role as a web app instead of a native app.** Each mobile app already builds for
  the browser (used for testing). Turning one into a real installable web app would need
  hosting and some web-specific polish, not a rewrite.
- **Drop the change entirely.** The last commit (`211c0d2`) is the web-only product, and
  production still runs it. Discarding the uncommitted changes returns to it; the changes are
  also saved as a ZIP outside the repository.

## Status

- **Nothing is committed, pushed or deployed.** Production runs commit `211c0d2`.
- **All new work is preserved** as uncommitted files in this repository and as ZIP backups in
  `~/Documents/Projects/Dentor-backups/`: the changed and new files, and the Expo-era mobile
  workspace that was replaced.
- **How to build and test everything**: [`MOBILE_BUILD.md`](MOBILE_BUILD.md).
  **The mobile API**: [`MOBILE_API.md`](MOBILE_API.md).
  **Screen-by-screen design check, incomplete**: [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md).

## Open items that need a decision or an outside party

1. **Design scope.** All 530 designed frames were compared (`DESIGN_REVIEW.md`). The apps now
   take the designs' look, but 356 frames describe features that were never built. Which of
   them are wanted, and which design the Owner app follows, needs a decision.
2. **Approval to commit and to deploy**, including the seven behaviour changes above.
3. **SMS gateway and push service** accounts.
4. **Store accounts and signing**: a Google Play upload key and an Apple Developer team.
5. **The number of days notifications are kept** (180 unless changed).

The full list of what stands between this repository and a release is in
[`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).

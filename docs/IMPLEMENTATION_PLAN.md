# Implementing the designs: gap analysis, roles and plan

Started 14 October 2026. This is the working tracker for building what the Figma designs have and
the apps do not. Frame numbers refer to `DESIGN_REVIEW.md` (`#` = row in the `dentor` table; other
frames by id). Status: **Done** (built and tested), **In progress**, **Planned**, **Blocked**
(needs an outside service or your decision), **Excluded** (an agreed exclusion; the conflict is
recorded, nothing is built).

## 1. Which app is which

The red "Clinic app" in the `dentor` file is the app a clinic runs its practice with: its home
books visiting consultants, and its menu holds appointments, patients, accounts, clinical work,
labs, offers, chat, tracking, tariff, tickets, refer-and-earn and help. The Owner app built so
far was a read-only overview. **Decision: the Owner app becomes the Clinic app** ("Dentor
Clinic"): the designed workflows are built into it, the owner's analytics stay in it (under
Accounts and the home figures), and it opens to more clinic roles than the owner, with the API
deciding what each role may do. Package names and bundle ids stay `in.dentor.owner` so nothing
already installed breaks.

| App | Who signs in |
| --- | --- |
| Web (reception, PWA) | every clinic role except Consultant; Super Admin |
| Dentor Clinic (was Owner) | Clinic Owner, Administrator, Dentist, Receptionist, Accountant |
| Dentor Consultant | Consultant |
| Dentor (patient) | patients |

## 2. Who may do what (enforced by the API)

| Workflow | Owner | Admin | Dentist | Receptionist | Accountant | Consultant (own data) |
| --- | --- | --- | --- | --- | --- | --- |
| Appointments, patients, drafts, recall | yes | yes | yes | yes | read | own appointments |
| Book a consultant, tracking | yes | yes | yes | yes | – | receives, accepts, updates |
| Prescriptions, certificates, case summary | yes | yes | yes | read | – | own patients |
| Labs (order, complaints) | yes | yes | yes | yes | read | – |
| Lab invoices, accounts, expenses, statements | yes | yes | – | – | yes | own earnings |
| Offers, jobs, subscription, uploads, clinic settings | yes | yes | – | – | – | own jobs, own uploads |
| Team and logins | yes | yes (not owners) | – | – | – | – |
| Tickets, chat, help | yes | yes | yes | yes | yes | yes |

## 3. Agreed exclusions the designs run into

| Design | Conflict | What is built instead |
| --- | --- | --- |
| "Pay Now" after booking (#99–109), wallet top-up (#311), Elite plan purchase (#312–315), shop checkout (#259–260), refunds "processed in 2–5 days" (#223) | online payments excluded | Pay later / pay at the clinic; wallet shows points and credits only; plans are shown and "request upgrade" notifies Dentor; shop is a catalogue with enquiry; refunds are recorded, not paid out |
| "Start Video Consultation" (patient `18:163`, `31:55`) | video consultation excluded | not shown |
| Recall and offers sent by SMS / WhatsApp / email (#152–158, #243–250) | real gateways excluded | messages are recorded and shown as in-app notifications; external delivery goes through the existing gateway hooks when one is configured |
| Back up to Google Drive (#0–1) | outside service, device-level | data already lives on the server; not built |
| Live map tracking (#274–275, #394) | needs a maps key and device location | status tracking (on the way, running late, arrived, started, finished) with times; the map is a later dependency |
| Permissions screen with six switches and "Enable All & Continue" (#17, #326) | location, camera, calendar and microphone serve features that are excluded or not built (live map, voice consultation, calendar sync); there is no push service yet | the screen lists all six with what each is for and its real state ("Not used yet", "You choose each photo", "In the app") and a "Continue" button; nothing is requested up front |
| "Login with" fingerprint (#22) | biometric data must not be stored | the phone's own fingerprint / Face ID check releases a per-device key; nothing biometric reaches the app or the API |

## 4. Workflow groups

Each group lists the frames it covers, the screens and API it needs, the kind of gap, acceptance
criteria and status. Shared components are listed once in section 5.

### Authentication and onboarding (all apps)

| | |
| --- | --- |
| Frames | #15–41, #325–354, patient `2:434`, `108:*`, `3:2185`, `89:265` |
| Screens | permissions, onboarding, disclaimer, login with email or mobile and remember me, fingerprint, forgot password by email code, sign-up (clinic: KYC, academic, address, finish; consultant: same), code verification, approval pending / approved / rejected |
| API | email codes (`EMAIL_PROVIDER` console or webhook, like SMS); staff sign-up applications; Super Admin approval; biometric unlock uses the device keychain (no biometric data leaves the device) |
| Gap | both |
| Acceptance | a new clinic or consultant can apply, verify their email, wait, be approved in the platform console and sign in; any staff or patient with an email can reset a password with a 4-digit code; fingerprint unlocks a remembered session on a real device |
| Built | API: `email_codes.py`, `routers/onboarding.py`, `device_credentials.py`, platform approve / reject (with an email to the applicant), patient email reset. Apps: first launch (permissions, onboarding, disclaimer) in the Clinic and Consultant apps; login with Remember me, Forget Password, Sign Up and the fingerprint button; four-step sign-up with the email code, attachments and the success pop-up; forgot password by email (staff, and patients as "Use my email instead"); fingerprint switch in each app's settings. Web: applications review in the Super Admin console. |
| Tests | `test_onboarding.py` (4), `test_device_credentials.py` (2); browser suites: Clinic sign-up → approval → sign-in, forgot password, remember me, first launch; Consultant sign-up → approval into a clinic; patient reset by email; web console reject / approve |
| Not verifiable here | the biometric prompt (needs a phone with an enrolled fingerprint or face; simulators and browsers cannot show it); real email delivery (needs `EMAIL_PROVIDER=webhook` and a mail service, see RELEASE_CHECKLIST 2a) |
| Status | Done (phase 2), except the real-device biometric check |

### Clinic home and navigation

| | |
| --- | --- |
| Frames | #56–68, #73 |
| Screens | home (banner, specialities grid to book, figures flip side, reviews strip), side menu, header notifications |
| API | existing figures; banner from the clinic advertisement |
| Gap | both |
| Acceptance | every designed menu entry opens a working screen or is marked as excluded |
| Status | Done for the shell (phase 1): designed home, side menu by role, figures redacted for roles without money access; menu entries for later phases appear as they are built |

### Appointments (clinic app)

| | |
| --- | --- |
| Frames | #120–124, #142–151, #192–193, #213–228 |
| Screens | my appointments (in-house / consultant), appointment detail and case summary, schedule, reschedule (date, slots, reason), time swap, cancel with reason and refund note, monthly view, existing appointments, fix timing (slot generation), drafts |
| API | `/api/clinic-app/appointments*`, `/slots`, `/doctors` (new, role-checked); the same `appointments` collection as the web app; drafts are status `Draft` and hold no slot |
| Built | Clinic app: My Appointments (in-house / Dentor, Today / Upcoming / Previous / Cancelled / Drafts, search, counts), New Appointment (patient, doctor, date strip, slot grid, save as draft), appointment detail with case summary, check-in and complete, Re-Schedule (reason, original and new dates kept), Time Swap, Cancel (reason, refund note only), Monthly view |
| Tests | `test_clinic_app.py`; Clinic browser suite: book, slot taken, reschedule, swap, cancel, draft then book, monthly counts |
| Not built | "timer" (#124) and "Fix timing / minutes select" (#143–147) belong to consultant visits and are covered by the start / end procedure flow; "switch to OTP" (#150) and "payment confirmation" (#151) conflict with excluded online payments |
| Status | Done (phase 3) |

### Patients (clinic app)

| | |
| --- | --- |
| Frames | #125–141 |
| Screens | patients list and figures, add patient, patient dashboard (counts), appointments by state, clinical profile (single and multi-visit), accounts and payments with breakdown, profile, consent form |
| API | `/api/clinic-app/patients*` (new): list with figures, add with duplicate warning, dashboard with tiles, appointments by state, clinical profile, accounts (money roles only), profile with vitals and insurance, consents |
| Built | Clinic app: Patients (figures, search, list), Add Patient (the design's personal, contact, medical and additional sections), patient dashboard with tabs |
| Tests | `test_clinic_app.py`; Clinic browser suite: add with validation, duplicate warning, dashboard |
| Not built | consent form signing stays at the reception web app (the dashboard lists consents and their state) |
| Status | Done (phase 3) |

### Book a consultant (clinic) and the consultant's side

| | |
| --- | --- |
| Frames | #82–111, #118–119, #69–72, #355–391 |
| Screens | clinic: booking form (patient, tooth and quadrant, history, treatment, images, lab reports, vitals, preference), own choice or Dentor choice, consultants near by, profile, slots, appointment type (standard, peak, clinic preferred), confirmations, timers; consultant: pending requests, accept or propose times, reminders, set availability (default and custom), start procedure with the clinic's code, vitals, complete or end procedure, add notes, case summary |
| API | `app/consult.py`; clinic `/api/clinic-app/consult/*` (consultants, profile, slots from the consultant's availability, request, accept an offered time, cancel); consultant `/api/consultant/requests*` (view, accept, propose up to three times, decline, track, start with the clinic's 4-digit code, vitals, complete with the next sitting, cancel), `/availability`, `/my-slots`. Uses the web app's `consultant_bookings` collection; a confirmed booking gets a mirror appointment in "Consultation Room" |
| Built | Clinic app: specialities on home open the booking wizard (case with tooth, quadrant, medical history, vitals, intra-oral photos, lab findings; own choice with the consultant's slots by morning / afternoon / evening, or Dentor choice with standard / peak / clinic-preferred), declaration, request status with timeline and the start code, offered times, cancel; consultant profile. Consultant app: pending count on home, Clinic Requests (pending / upcoming / previous), Appointment Summary with accept, offer times, decline, on the way / running late / arrived, Start Procedure (code), vitals, End Procedure with next sitting, cancel; Set Availability (default weekly and custom days) |
| Tests | `test_consult.py` (3); Consultant browser suite: availability → clinic slots, accept → track → wrong and right code → complete with next sitting, offer other times → clinic confirms; Clinic browser suite: wizard with validation, consultant's answer and start code, Dentor choice peak hours |
| Not built | "Pay Now" after booking (excluded payments: fees show "pay at the clinic"); group / multi-patient booking (#89, #94–95: one patient per request; book again for the next); live map (#274–275: status tracking instead); ratings from the clinic (#368: phase 7 with reviews) |
| Status | Done (phase 4) |

### Clinical: prescriptions, certificates, labs, recall, tariff

| | |
| --- | --- |
| Frames | #3–12, #152–191, #261–272, #303–306, #317–324 |
| API | `routers/clinic_clinical.py`: labs directory (new `labs`, admin-managed through `/api/labs`), lab orders by kind into the web app's `lab_orders` (stage "Order Received"), lab complaints (new `lab_complaints`: New → In progress → Resolved), lab invoices, recall templates (`omni_templates`, category Recall, 160 characters) and sending (new `recalls`), prescription catalogue (drugs, combos, recent), new medicine, prescriptions (signed, reach the patient app), certificates (fitness, referral), tariff (`treatment_masters`) |
| Built | Clinic app: Labs (diagnostic labs by kind with counts, lab list and profile, Book a Service per kind — blood tests and collection, X-ray type and teeth, dental work with shades and implant details, CBCT indications / region / field of view / consent — preview and sent pop-up), Lab Cases, Complaints (new / on going / completed, create, resolve), Lab Invoices; Recall (patient, templates, edit / create template, message, due, result pop-up); E-prescription (individual drugs by category and type, combos, copy & paste, dose / frequency / days / instruction, general instructions, next appointment, preview, share, submit, add new medicine); Certificates (fitness / referral, add, preview, share); Treatment Tariff |
| Tests | `test_clinic_clinical.py` (3); Clinic browser suite: dental lab order to the lab board, complaint resolved, recall to a patient without the app, prescription with copied drugs, fitness certificate, tariff prices |
| Exclusion conflicts | recall by SMS / WhatsApp (#153–155): delivered in the patient app only; a patient without the app is reported back for a call. Prescription and certificate "Download" as letterhead PDF (#272, #321, #324): letterhead printing is an agreed Phase-2 exclusion; share sends the text, the reception web app prints |
| Not built | lab "Download" of the request form as PDF (#171: share and the lab board instead); attachments on lab requests and complaints are accepted by the API but the app does not offer a picker for them yet |
| Status | Done (phase 5) |

### Accounts

| | |
| --- | --- |
| Frames | #194–212, #252–256, #414–417, CMS `346:178`, `351:1801`, `362:3347`, `364:4244`, `382:694` |
| API | `routers/clinic_accounts.py` (owner, administrators, accountants only): summary with change on the period before, expenses by the design's seven categories (recorded in the new `expenses` collection — also `/api/expenses` for the web app — plus lab payments and completed consultant visits added automatically), invoices with receipts, receipts, statement of accounts with a running balance, Dentor accounts (consultant visits by fee status). Consultant: `/api/consultant/earnings/visits` |
| Built | Clinic app: Accounts (In-house: revenue, expenses, net, expense categories, invoices and receipts, invoice view with share, statement with share; Dentor: completed / outstanding / cancelled visits), Expenses with Add expense. Consultant app: clinic visits in Earnings (earned, pending, by status). Web: Expenses page (finance roles only; hidden from other roles in the sidebar) |
| Tests | `test_clinic_accounts.py` (3); Clinic browser suite: figures equal the API, expense recorded, invoices and statement; Consultant suite: completed visit in earnings; web suite: Expenses add, receptionist refused, failure states |
| Exclusion conflicts | refunds "processed in 2–5 days" and "refunded" lists (#223, #255, #417): no payment is taken or refunded; cancelled visits are shown as "Cancelled — no charge". "Download" of invoices and statements as PDF (#200, #212): shared as text; the web app prints invoices |
| Status | Done (phase 6) |

### Engagement and support

| | |
| --- | --- |
| Frames | #229–251, #273–316, #392–413, #418–442 |
| API | `routers/engagement.py` (`/api/engage/*`, Clinic app roles and consultants): support tickets (global `support_tickets`, `DT-` codes) with Super Admin answers (`/api/platform/tickets`), clinic–consultant chat (`staff_chats`), offers (`offers`; send now or scheduled — a one-minute background task sends due ones; patients see them at `/api/patient/offers`, views and bookings are counted), ratings both ways after a completed visit (into `reviews`), notification settings (`user_prefs`; quiet hours hold back phone alerts in `notify.py`), refer-and-earn (code per login; 150 points when a referred application is approved), points wallet, plans (a request ticket), store catalogue (`products`, enquiry ticket), the consultant's inventory and usage, job posts (global `job_posts`) |
| Built | Shared screens in both staff apps: Ticket (raise, recent / previous, details with Dentor's answers, reply), Chat (list, new message to a consultant / the clinic, thread), Help center (FAQ with search, contact → ticket), Privacy Policy and Terms (placeholder text, marked as such), Notification setting (mute, sound, vibrate, silence 30 / 60 / 90 minutes, sleep mode), Refer 'n' earn and points wallet, Subscription plans, Dentor Store, Job Posts, the designed logout dialog (sad tooth). Clinic app: My Posts and Create an Offer (treatment-specific or general, percentage or amount, valid till, send now or later), Live Tracking (today's consultant visits and statuses), rate the consultant. Consultant app: Inventory (items, low stock, adjust, history, usage per case), Ratings & Reviews, rate the clinic. Web: support tickets in the Super Admin console |
| Tests | `test_engagement.py` (5); Clinic browser suite: ticket answered by Dentor, chat with a consultant, offer to the patient app with views counted, rating, settings / wallet / plans / store / jobs / help; Consultant suite: rating the clinic, chat reply, inventory usage |
| Exclusion conflicts | wallet top-up and money balance (#311, #400): points only; Elite plan purchase (#312–315): "Begin Journey" files a request with Dentor; store checkout (E-com #396–397): catalogue with enquiry; offers "sending option" by SMS / WhatsApp (#246): patient-app notifications only; live map (#274–275, #394): status tracking with times |
| Not built | profile update with a 4-digit code (#238, #241, #424: profile edits use the existing edit screens, protected by the session; SMS codes to staff are not configured), adding a second clinic under one owner (#240–242: a new clinic is a new application), document uploads for letterhead, signature and seal (#296–301: they exist only to print on letterhead, which is an agreed exclusion), photo change with camera (#251: no camera permission is used) |
| Needs Dentor's input | contact links for the help centre (website, WhatsApp, Instagram), the final privacy and terms text, store products and prices, plan activation process |
| Status | Done (phase 7) |

### Patient app gaps

| | |
| --- | --- |
| Frames | `2:434`, `108:3353`, `98:1076`, `18:163`, `136:1692`, `27:70`, `76:2621`, `51:776`, `96:803`, `31:55` |
| API | `/api/patient/profiles/fetch` and `/fetch/verify` (a record registered under another number joins the account after a 6-digit code to that number; `linked_accounts` on the patient record), `/account/prefs` (alert switches honoured by push in `notify.py`), `/callback` (front desk notified; `/api/clinic-app/callbacks` lists and closes them), case summary on `/appointments/{id}`, `/offers` |
| Built | Permissions list on first launch (shared with the staff apps), FETCH and OFFERS tiles, Fetch screen with code, Offers with "Apply and book" (the booking counts for the clinic), Request Callback in the scheduler, Notification Settings (general, sound, vibrate, appointment reminders, medicine alerts, lab result alerts), Case summary on a past visit, Share records. Fingerprint login was built in phase 2. Clinic app: callback requests on the Patients screen with "Mark called" |
| Tests | `test_patient_gaps.py` (2); patient browser suite: permissions, offers, callback, notification settings, fetch |
| Exclusion conflicts | "Start Video Consultation" and its consent (`18:163`, `31:55`): not shown |
| Not built | "Download records" (`51:776`): files open in the app and records can be shared as a list; saving files to the phone needs a file-system library. The "no slots" pop-up (`136:1692`) keeps the app's own inline notice. The clinic's recall pop-up (`27:70`) arrives as a notification (phase 5) |
| Status | Done (phase 8) |

### Web app gaps (CMS)

| | |
| --- | --- |
| Frames | the `CMS` rows of DESIGN_REVIEW.md marked Missing or Differs |
| Built | Appointments: Week view (`334:3694`), Month view with counts (`320:140`), Day by doctor in columns (`313:14323`), Rescheduled list with the first date and time (`306:13494`; any move — web, Clinic app — is recorded by the API). Masters → Treatment fees: the procedure form with fee, GST, duration, unit and doctor's share (`328:2428`; owner and administrators only, checked by the API). Patient profile → Case sheet, printable (`223:4621`, `202:9390`) and Virtual card with print, copy and WhatsApp share (`199:7976`). Accounts dashboard for finance roles: income, expenses, net this month and where the money went (`346:178`), Expenses page (`362:3347`, `364:4244`, phase 6). Consultants: this month's load, hours and completion rate per doctor (`383:1566`). Super Admin console: sign-up applications and support tickets |
| Tests | `test_clinic_app.py::test_web_moves_are_recorded_and_ranges_and_analytics`, `test_clinic_clinical.py::test_treatment_fees_are_checked_and_admin_only`; web suite 113/113: rescheduled / month / week, procedure form, case sheet and virtual card, accounts dashboard and consultant load, layout at every width |
| Not built | full-page booking form and group appointment (`322:765`, `420:1929`, `411:944`): the booking dialog stays; one patient per booking. Add patient with OTP verification and "Save as Draft" (`215:2053`, `210:12426`): SMS to staff-entered numbers is not configured. Collapsed icon sidebar (`155:7575`). 2D/3D tooth chart with AI insight (`287:10971`, `343:6528`, `165:15803`): needs a 3D model and an AI service. FRS care plans (`423:1682`, `423:837`). Invoice "issued" success screen (`435:1217`): a confirmation message is shown instead. Dashboard queue table and revenue tiles of `291:11615` |
| Status | Done for the listed screens (phase 9); the rest is recorded above |

## 5. Shared pieces

Mobile kit (`packages/shared`): list screen with search and date range, tab chips, design form
fields (label above, pill field, tick), the tooth mascot pop-up, timeline, star rating, file
attachment field, tooth and quadrant picker, slot grid and date strip (exists), side menu.
API: role-aware resource router (read and write roles per collection), email codes, sign-up
applications.

## 6. Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Gap analysis, roles, `.gitignore` for design exports | Done |
| 1 | Role-aware API, Clinic app shell (roles, menu, home) | Done |
| 2 | Authentication and onboarding | Done (biometric prompt needs a real device) |
| 3 | Appointments and patients in the Clinic app | Done |
| 4 | Book a consultant, consultant workflows | Done |
| 5 | Clinical, labs, recall, tariff | Done |
| 6 | Accounts and expenses (apps and web) | Done |
| 7 | Engagement and support | Done |
| 8 | Patient app gaps | Done |
| 9 | Web app gaps | Done (see "Not built") |

## 7. Verification on 15 October 2026

Final pass, local only: the API on a freshly seeded development database (`DB_NAME=dentor_final_1015`;
the API tests use their own `dentor_test`). Nothing was committed, pushed or deployed; production, its
data and its configuration were not touched; no outside service was called.

| Check | Result |
|---|---|
| Backend tests (`backend/`, `uv run pytest -q`) | **121 passed** (adds `test_security_matrix.py`: 9 kinds of login × 39 API calls, handler-level refusals, isolation between two clinics, deactivation and password change ending sessions; and `test_exclusions.py`: no payment, video or SMS / WhatsApp endpoints, outbound calls only from the email, SMS and push modules, recall and offers never call the SMS or email webhooks) |
| Mobile typecheck and unit tests (`mobile/`) | clean; 23 / 23 |
| Web typecheck (`tsc -b`) and lint (`oxlint`) | clean; lint warnings only, in files not changed in this pass |
| Clinic app browser suite | 59 / 59 |
| Consultant app browser suite | 33 / 33 |
| Patient app browser suite | 39 / 39 |
| Reception web suite (production build) | 113 / 113 (one step, the browser's own "Install app" prompt, cannot be triggered headless and is listed by the suite as not verified) |
| Previous web release (commit `211c0d2`) against the new backend | 7 / 7 |
| Responsive sweep (browser builds, 121 screens × 320–1024 px) | 120 pass; the Clinic side menu is flagged by the column rule by design (`DESIGN_REVIEW.md`) |
| Debug builds after the final changes: Android APK (arm64) and iOS simulator app, all three apps | **all six built** |
| Device flows, Android emulator (API 36) | Consultant 58, back guard 41, Clinic 62, Patient 55, stay signed in 25: all passed |
| Device flows, iPhone 16 simulator | Clinic 62, Patient 55, stay signed in 25, reinstall 3: all passed. **Consultant: not verified on the final build** (see below) |

**Not verified in this pass, and why:**

- **iPhone Consultant flow on the final build** (resolved in the second pass, section 8). The disk had about 1.3 GB free. While it ran, free
  space fell below the safety limit (the build Mac's MongoDB, shared with other projects, lives on
  the same disk), a guard stopped the run, and a second attempt stopped the same way while the
  simulator booted. It passed (58 / 58) on the earlier build of 15 October; the JavaScript changed
  since then only in the switch colours and the Clinic monthly view, and the Android Consultant flow
  passed on the final build.
- **Release builds** (signed APK / AAB, iOS archive / IPA): not rebuilt in this pass for lack of disk
  space and signing material; see `RELEASE_CHECKLIST.md` sections 4 and 5 for the blockers and
  `MOBILE_BUILD.md` sections 6 and 7 for the commands. Release APKs for all three apps, a patient AAB (all signed with the
  public debug key) and iOS Release simulator builds last succeeded on 13 October, before phases 0–9.
- **Anything needing real devices or outside services**: the fingerprint / Face ID prompt; email,
  SMS and push delivery; tablets on devices (browser widths up to 1024 px are checked). See
  `INTEGRATIONS.md`.

**Flaky or environment-dependent results seen during the project:** the iPhone simulator once lost
typed text in the Clinic flow (passed on re-run); a fingerprint test that built its wrong secret by
changing the last character (fixed to be deterministic); the Consultant flow on iPhone once failed
while the fingerprint row shifted the layout as it loaded (fixed in `BiometricSetting`).

**Defects found and fixed in this pass:** blank cells of the Clinic monthly view drawn as selected;
switch knobs teal in the browser builds; the web Expenses page showing ₹0 while Accounts counted lab
payments and consultant visits (details in `DESIGN_REVIEW.md`).

## 8. Second pass, 15 October 2026: remediation work and re-verification

Planned in [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) (every unfinished frame, classified against the
documented scope; decisions D1–D20 in `BUSINESS_CONTENT.md`). Built in this pass: the Re-Visit list
(#2), the Settings screen in both staff apps with the design's profile rows (#281, #426, #233, #419),
the mute messages (#289), the line-art pattern and coloured list-card edges (the shared visual layer),
the collapsible web sidebar (CMS `155:7575`) and the email status in the Super Admin console. Found and
fixed: the Clinic home showed the design's sample banner and dollar-priced products as real content;
it now shows the clinic's own advertisement and the real store catalogue.

| Check (API on a fresh `dentor_rem_1016` database) | Result |
|---|---|
| Backend tests | **122 passed** (adds the Re-Visit endpoint and the email status) |
| Mobile typecheck and unit tests | clean; 23 / 23 |
| Web typecheck and lint | clean; warnings only on lines not changed |
| Clinic app browser suite | 60 / 60 (adds Re-Visit; Settings, mute messages, home advertisement and catalogue checks) |
| Consultant app browser suite | 33 / 33 |
| Patient app browser suite | 39 / 39 |
| Reception web suite | 114 / 114 (adds the collapsible sidebar; email status cases). The first run failed 6 steps because of two mistakes in the new test code (a "nothing is wrong" check applied where push is genuinely off, and a layout check given an answer without the email field); fixed in the test, then 114 / 114 |
| Responsive sweep, 125 screens × 320 / 360 / 390 / 430 / 768 / 1024 px | 124 pass; the Clinic side menu flag is by design |
| Device flows on the existing debug builds (JavaScript from Metro, so the current code) | Android emulator: Clinic 69, Consultant 63. iPhone 16 simulator: **Consultant 63**, Clinic 69. All passed; the disk never fell below 3.3 GB free |

**Not repeated in the second pass:** the patient device flows (the patient app changed only through
shared components, and the new options there have no effect without a brand pattern or a stripe; its
browser suite passed), the Consultant back-guard flow, native
rebuilds (no native code changed), release builds (signing material missing, `RELEASE_CHECKLIST.md`
sections 4–5).

## 9. Third pass, 15 October 2026 (afternoon)

Visual batches from `REMEDIATION_PLAN.md`: offer cards (#249), tariff sections (#306), the plan card with
arrows in both staff apps (#312–315, #406–408), lab invoice cards with Receipt / Invoice (#188), Consultant
review cards (#440), expenses total card and edged lines (#204). Visual totals now: Close 28, Partial 87,
Differs 60, Not compared 280. A nested-button warning in the new offer card was caught by the Clinic suite
and fixed. Clinic suite 60 / 60, Consultant suite 33 / 33, mobile typecheck clean, widths 320–1024 clean on
every reworked screen. **Native rebuild not done:** free disk stayed near 750 MB (5 GB required);
nothing of the other project's build, the shared caches or MongoDB was touched. The plans' discount
percentages are left out: the design files contradict each other (decision D19).

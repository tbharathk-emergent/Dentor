# Remediation plan: every frame that is not finished

Built from the same frame data as [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md) (generator:
`scratchpad review2/gen_plan.py`, backed up under `Dentor-backups/design-review-*`), so the two agree.
It lists each frame that is **not built, partly built, excluded, visually Partial or Differs, or not
yet compared**: 497 frames. Frames that are built and a close visual match are not listed.

## How each frame is classified

The classification was checked against the documented scope, not assumed:

- **Out of scope by documentation** (`SCOPE_CHANGE.md`): voice assistant, OCR intake, day closure
  with credit notes and refunds, payslips, paediatric dose calculator, **prescription letterhead**,
  Google Reviews sign-in, real WhatsApp / SMS / push providers, online payment in the patient app.
- **Excluded by instruction** (15 October 2026): online payments, video consultation, real SMS /
  WhatsApp integrations.
- Everything else in the designs is treated as **in scope** unless the requirement is unclear. Some
  earlier "not built" choices of mine (the live map, the profile status switch, additional clinic
  locations) are **not** in either list, so they are marked *Clarify*, not *Excluded*.

| Class | Meaning | Frames |
| --- | --- | --- |
| Required | in scope, requirement clear enough to build | 391 |
| Required, blocked | in scope, waiting for business content or an outside service | 26 |
| Clarify | the frame's behaviour or scope needs a decision (questions in section 3) | 53 |
| Excluded | documented later phase or excluded by instruction; the frame's visual parts are still listed when the screen exists | 27 |

| Priority | Meaning | Frames |
| --- | --- | --- |
| P1 | clear, high impact, no dependency: done first | 2 |
| P2 | a screen that clearly differs from the design, or a missing flow of medium impact | 90 |
| P3 | partial look, near-copies and states to compare, low-impact gaps | 392 |
| – | excluded, nothing to do | 13 |

## 1. Work order

1. **P1 functional**: the clear missing pieces (Re-Visit list, Settings screens, mute messages,
   Super Admin email status, collapsible web sidebar).
2. **Shared visual layer** (fixes many Partial / Differs rows at once): the designs' line-art
   pattern behind staff screens, edge-striped list cards, design-style profile rows, the home's
   "Post a Job" and "Service To" line.
3. **P2 screens** that clearly differ, one workflow at a time, each re-compared afterwards.
4. **Not compared** frames: capture each state (form steps, pop-ups, filled lists) and record a
   verdict in `DESIGN_REVIEW.md`.
5. Blocked and Clarify rows once the decisions and content arrive.

Responsive rule for every mobile row: Portrait 320–1024 px; safe-area insets top and bottom; no clipped control; touch targets ≥ 44 pt. For every web row: Desktop 1024–1440+ as designed; 320–768 px drawer layout; dialogs fit the viewport.
Verification for every mobile row: Browser sweep at 320 / 360 / 390 / 430 / 768 / 1024 px; app suite step; Maestro flow where it covers the screen; screenshot beside the PDF page. For web rows: Web suite layout step at 320–1440 px; screenshot at 1440 px beside the PDF page.

## 2. Status column

*Done* means built and verified as described in `DESIGN_REVIEW.md`; *In progress* means started;
empty means not started.

## 3. Decisions needed (questions and recommended options)

D1–D20 are in [`BUSINESS_CONTENT.md`, "Decisions needed"](BUSINESS_CONTENT.md#decisions-needed), each with
the exact question and the recommended option first.

## 4. Done in this pass (15 October 2026, second pass)

| Item | Frames | Result |
| --- | --- | --- |
| Re-Visit list in the Clinic app (API `GET /api/clinic-app/revisits` + screen) | #2 | Built; visual Close; API test and Clinic suite step |
| Settings screen in both staff apps, design rows on More / Profile | #281, #426, #233, #419 | Built (Uploads row waits for D4, Status row for D8) |
| Mute / unmute messages | #289 | Built; Clinic suite checks both messages |
| Line-art pattern behind screens (all Consultant screens; Clinic screens that draw it) | many, e.g. #25, #159–191, #243–250, #82, #326–442 | Applied; 125-screen sweep passes; frames re-compared where listed |
| Coloured left edges on list cards | chats, lab cases, complaints, lab invoices, tickets, consultant bookings, Re-Visit, reviews | Applied; #181 and #229 now Close |
| Clinic home showed the design's sample banner and $-priced products as if real | #56 | Replaced by the clinic's advertisement and the real catalogue |
| Collapsible icon sidebar on the web | CMS `155:7575` | Built; web suite step |
| Email status in the Super Admin console | (no frame; asked for in the review) | Built; API test and web suite cases |
| Visual batch 3 (third pass): expenses total card and edged lines | #204 | Partial (compared empty); Clinic 60/60, widths clean |
| Visual batch 2 (third pass): lab invoice cards with Receipt / Invoice, Consultant review cards with search | #188, #440 | both Close; Clinic 60/60, Consultant 33/33, widths clean |
| Visual batch 1 (third pass): offer cards, tariff sections, plan card with arrows | #249, #306, #312–315, #406–408 | #306 and the plans Close, #249 Partial (tabs); Clinic 60/60, Consultant 33/33, widths 320–1024 clean |

## 5. Frames


### `dentor` file (Clinic app #0–324, Consultant app #325–442): 417 frames

| Frame | Name | Now | Functional | Visual | Class | P | Functional fix | Visual fix | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #0 | backup | – | Not built | – | Clarify | P3 | If wanted: a server-side export the owner can download; Google Drive needs a Google OAuth client. | – | Decision D9 |  |
| #1 | restore | – | Not built | – | Clarify | P3 | If wanted: a server-side export the owner can download; Google Drive needs a Google OAuth client. | – | Decision D9 |  |
| #3 | Book a service | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #4 | blood | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #5 | xray | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #6 | cbct | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #7 | x ray labs | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #8 | Lab (profile) | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #9 | cbct form | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #10 | cbct form1 | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #11 | cbct form2 | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #12 | cbct form3 | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #13 | set availability | Consultant app › Set Availability | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #14 | set availability custom | Consultant app › Set Availability | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #17 | PERMISSIONS | `/welcome` (first launch) | Built | Differs | Required | P2 | – | Rework the layout to the frame: Status text instead of switches (deliberate, see the functional note). | – |  |
| #19 | login | `/welcome` | Built | Partial | Required | P3 | – | Close the remaining gap: Disclaimer text and veil as designed; no "I understand" tick box, the button takes the app red. | – |  |
| #22 | fingerprint login | `/login` fingerprint | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #23 | Forget password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #24 | forget password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #25 | enter email | `/forgot` | Built | Partial | Required | P3 | – | Close the remaining gap: Same brand and fields; the design shows the code step on the line-art background. | – | Pattern applied |
| #26 | check ur email | `/forgot` | Built | Partial | Required | P3 | – | Close the remaining gap: Same brand and fields; the design shows the code step on the line-art background. | – |  |
| #27 | enter 4 digit code | `/forgot` | Built | Partial | Required | P3 | – | Close the remaining gap: Same brand and fields; the design shows the code step on the line-art background. | – |  |
| #28 | password reset | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #29 | set new password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #30 | set new password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #31 | sucessful pop | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #32 | register popup | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #33 | SIGNUP | `/signup` | Built | Partial | Required | P3 | – | Close the remaining gap: The app starts with the email step; the design's stepper form comes after. | – |  |
| #34 | SIGNUP 2 | `/signup` | Built | Partial | Required | P3 | – | Close the remaining gap: The app starts with the email step; the design's stepper form comes after. | – |  |
| #35 | SIGNUP 3 | `/signup` | Built | Partial | Required | P3 | – | Close the remaining gap: The app starts with the email step; the design's stepper form comes after. | – |  |
| #36 | SIGNUP 4 | `/signup` | Built | Partial | Required | P3 | – | Close the remaining gap: The app starts with the email step; the design's stepper form comes after. | – |  |
| #37 | sucessfully registered popup | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #38 | sucessfully registered popup 1 | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #39 | loading | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #40 | profile approval | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #41 | profile Rejection | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #42 | post a job | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #43 | view  post | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #44 | My post | `/jobs` | Built | Partial | Required | P3 | – | Close the remaining gap: Tabs and empty state; the design shows listing cards with Edit / Close. | – |  |
| #45 | Job post option | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #46 | Add post Job | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #47 | Add post Job seeking | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #48 | No post | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #49 | CANCEL THE POST | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #50 | Job post successfull | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #51 | Job applied successfull | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #52 | fix time notification | – | Not built | – | Clarify | P3 | Part of the multi-patient "fix timing" flow (#142–148). | – | Decision D6 |  |
| #53 | job view  hiring | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #54 | view Job seeking | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #55 | Log In | `/login` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #56 | Home | Home | Built | Partial | Required | P3 | – | Close the remaining gap: Header, location, specialities grid and reviews as designed; the banner is the clinic's text advertisement, not the sample artwork, and the product cards show the real catalogue; no "Post a Job" link or live-tracking strip. | – | Sample banner and $ products replaced with real data |
| #57 | timer in home screen | – | Not built | – | Clarify | P3 | A countdown on home; what it counts down to is not defined. | – | Decision D7 |  |
| #58 | ads | – | Not built | – | Clarify | P3 | A countdown on home; what it counts down to is not defined. | – | Decision D7 |  |
| #59 | todays appointment  notification | – | Not built | – | Clarify | P3 | A countdown on home; what it counts down to is not defined. | – | Decision D7 |  |
| #60 | Home after flip | Home (Flip) | Built | Partial | Required | P3 | – | Close the remaining gap: Count tiles as designed; the labels are the app's (Booked, Waiting, Completed, Collected). | – |  |
| #61 | floating page | – | Not built | – | Required | P2 | Request list cards with the progress line (Requested → viewed → Confirmed) as in #62. | – | – |  |
| #62 | floating page timestamp | – | Not built | – | Required | P2 | Request list cards with the progress line (Requested → viewed → Confirmed) as in #62. | – | – |  |
| #63 | floating page timestamp | – | Not built | – | Required | P2 | Request list cards with the progress line (Requested → viewed → Confirmed) as in #62. | – | – |  |
| #64 | Home menu | Home › menu | Built | Partial | Required | P3 | – | Close the remaining gap: A full-height panel with outlined rows instead of the design's red-edged card. | – |  |
| #65 | Home menu options appointments | Home › menu | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #66 | Home menu options clinical | Home › menu | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #67 | Home header notification | Bell › `/notifications` | Partial | Not compared | Required | P2 | Bell opens a notification panel over home; status ticker ("Our consultant is reviewing your request"). | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #68 | Home header notification | Bell › `/notifications` | Partial | Not compared | Required | P2 | Bell opens a notification panel over home; status ticker ("Our consultant is reviewing your request"). | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #69 | Consultant arrived | Notifications, Live Tracking | Partial | Not compared | Required | P2 | In-app pop-up when a tracked visit becomes Arrived / Completed while the app is open. "Pay Now" stays excluded. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts (INTEGRATIONS 3) |  |
| #70 | after consultant completes the case | Notifications, Live Tracking | Partial | Not compared | Required | P2 | In-app pop-up when a tracked visit becomes Arrived / Completed while the app is open. "Pay Now" stays excluded. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts (INTEGRATIONS 3) |  |
| #71 | procedure completed | Notifications, Live Tracking | Partial | Not compared | Required | P2 | In-app pop-up when a tracked visit becomes Arrived / Completed while the app is open. "Pay Now" stays excluded. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts (INTEGRATIONS 3) |  |
| #72 | procedure completed for multiple cases | Notifications, Live Tracking | Partial | Not compared | Required | P2 | In-app pop-up when a tracked visit becomes Arrived / Completed while the app is open. "Pay Now" stays excluded. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts (INTEGRATIONS 3) |  |
| #79 | CONSULTANT APP | – | Not built | – | Excluded | – | Three separate apps (documented decision, SCOPE_CHANGE "Decisions"). | – | – |  |
| #80 | CLINIC APP | – | Not built | – | Excluded | – | Three separate apps (documented decision, SCOPE_CHANGE "Decisions"). | – | – |  |
| #81 | Log In | `/login` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #82 | new appointment | `/consult/book` | Built | Partial | Required | P3 | – | Close the remaining gap: Patient, diagnosis, treatment chips and tooth grid; the design has drop-downs, upload rows and ticks. | – |  |
| #83 | own choice | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #84 | dentorchoice | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #85 | quadrant | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #86 | Tooth | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #87 | medical history | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #88 | treatment needed | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #89 | appointment notification popup | – | Not built | – | Clarify | P3 | Multi-patient request pop-up. | – | Decision D6 |  |
| #90 | SELECT NEAR BY | `/consult/book` › own choice | Built | Differs | Required | P2 | – | Rework the layout to the frame: Cards per consultant with fee and rating; the design has photo cards with "Profile" and "View Slots". | – |  |
| #91 | VIEW SLOT | `/consult/book` › own choice | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #92 | consultant profile | `/consult/book` › own choice | Built | Partial | Required | P3 | – | Close the remaining gap: Name, experience, fee, services, reviews; no photo or "Confirm Appointment" on the profile. | – |  |
| #93 | appointment confirmation  pop up | `/consult/book` › own choice | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #94 | bookin appointment multi patient if available own chpoice | – | Not built | – | Clarify | P3 | Several patients in one request. | – | Decision D6 |  |
| #95 | bookin appointment multi patient if available for dentor | – | Not built | – | Clarify | P3 | Several patients in one request. | – | Decision D6 |  |
| #96 | for ROOT CANAL SELECTION | `/consult/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #97 | appointment confirmation  from consultant 2 | `/consult/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #98 | appointment confirmation  from consultant 3 | `/consult/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #99 | appointment confirmed and payment | – | Excluded | – | Excluded | – | Online payment (excluded); fees are paid at the clinic. | – | – |  |
| #100 | view invoice | – | Excluded | – | Excluded | – | Online payment (excluded); fees are paid at the clinic. | – | – |  |
| #101 | appointment confirmed After payment | – | Excluded | – | Excluded | – | Online payment (excluded); fees are paid at the clinic. | – | – |  |
| #103 | appointment confirmed After payment | – | Excluded | – | Excluded | – | As #99. | – | – |  |
| #104 | time slot | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #105 | dentor appointment confirm popup | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #106 | peak hour time slot | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #107 | timer for appointment | Consult request timeline | Partial | Not compared | Clarify | P3 | Timer: what it measures (time to arrival, procedure time). | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D7 |  |
| #108 | appointment confirmed and payment | – | Excluded | – | Excluded | – | As #99. | – | – |  |
| #109 | view invoice | – | Excluded | – | Excluded | – | As #99. | – | – |  |
| #110 | select a choice drop down | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #111 | select a choice drop down | `/consult/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #112 | rate us | `/consult/[id]` › rate | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #113 | ratings and reviews | `/consult/[id]` › rate | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #114 | ratings and reviews | `/consult/[id]` › rate | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #115 | rate us | `/consult/[id]` › rate | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #116 | reviews / pending | Web › Reviews | Partial | – | Required | P2 | Pending / approved reviews with Approve and Reject in the Clinic app (the web app already moderates). | – | – |  |
| #117 | reviews / approved | Web › Reviews | Partial | – | Required | P2 | Pending / approved reviews with Approve and Reject in the Clinic app (the web app already moderates). | – | – |  |
| #118 | Case Profile | `/consult/[id]` case | Partial | Not compared | Required | P3 | Case profile layout for single and multi-visit cases. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #119 | Case Profile for multi visit | `/consult/[id]` case | Partial | Not compared | Required | P3 | Case profile layout for single and multi-visit cases. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #120 | RE - SCHEDULE APPOINMENT | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #121 | RE - SCHEDULE APPOINMENT time date select | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #122 | reschedule confirmation | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #123 | TIME SWAP | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #124 | timer | – | Not built | – | Clarify | P3 | As #107. | – | Decision D7 |  |
| #125 | PATIENTS | `/patients`, `/patients/new` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Figure tiles and a list; the design has summary cards with avatars and "Quick Actions". | – |  |
| #126 | Add patient | `/patients`, `/patients/new` | Built | Partial | Required | P3 | – | Close the remaining gap: Sections and fields follow the design; chips instead of drop-downs. | – |  |
| #127 | sucessfully added | `/patients/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #128 | PATIENTS | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #129 | PATIENTS individual dashboard | `/patients/[id]` | Built | Partial | Required | P3 | – | Close the remaining gap: Count tiles like the design's; the photo card is an initials banner. | – |  |
| #130 | PATIENT APPOINTMENT  SCHEDULED | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #131 | rescheduled | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #132 | prevoious | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #133 | Clinical profile | `/patients/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Tiles and a multi-visit list; the design repeats the case summary with vitals. | – |  |
| #134 | patient Clinical profile  for musti visit | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #135 | patient Clinical profile  for musti visit | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #136 | patient Accounts | `/patients/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Billed / paid / balance and invoices; the design has big boxed totals. | – |  |
| #137 | patient Accounts / payments | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #138 | view break down | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #139 | View all | `/patients/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #140 | Patient profile | `/patients/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Key-value list; the design has sectioned cards. | – |  |
| #141 | Consent form | Web › consents | Partial | – | Clarify | P3 | Consent signing on the clinic phone vs in the patient app / web. | – | Decision D10 |  |
| #142 | Existing APPOINTMENT | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #143 | Fix timing | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #144 | Time fixed | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #145 | fix timing time /date selector | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #146 | minutes select | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #147 | Time fixed | – | Not built | – | Clarify | P3 | Existing appointments of an order and fixing a time per case (start, end, interval, patients per slot). | – | Decision D6 |  |
| #148 | View Appointment for order id more than 1 patients | – | Not built | – | Clarify | P3 | As #142. | – | Decision D6 |  |
| #149 | switch to | – | Not built | – | Clarify | P3 | As #142. | – | Decision D6 |  |
| #150 | switch to otp | – | Excluded | – | Excluded | – | Payment confirmation (online payments excluded). | – | – |  |
| #151 | payment confirmation | – | Excluded | – | Excluded | – | Payment confirmation (online payments excluded). | – | – |  |
| #152 | Select template | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #153 | recall notes | `/recall` | Built | Partial | Required | P3 | – | Close the remaining gap: Patient, templates, message, due; the design adds the delivery channel (excluded) and a recipient card. | – |  |
| #154 | DAte select | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #155 | recall popup | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #156 | edit template | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #157 | Create template | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #158 | recall popup | `/recall` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #159 | LAB | `/labs` | Built | Partial | Required | P3 | – | Close the remaining gap: Line-art background as designed; lab kinds as tiles with counts where the design has a striped list; the sample "10% OFF" promo banner is left out. | – | Pattern applied; re-compared |
| #160 | diagnostic labs | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #161 | Blood  Investigation Labs | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #162 | x-ray labs | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #163 | DENTAL LABS | `/labs` | Built | Partial | Required | P3 | – | Close the remaining gap: List with turnaround and services; no banner or tick boxes. | – |  |
| #164 | CBCT LABS | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #165 | Lab (profile) | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #166 | Blood  Investigation Labs FORM | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #167 | Blood  Investigation Labs FORM | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #168 | dental labs | `/labs` | Built | Partial | Required | P3 | – | Close the remaining gap: Work, tooth and material chips; the design has boxed sections and tick boxes. | – |  |
| #169 | dental labs | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #170 | dental labs | `/labs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #171 | dental labs | `/labs/book` | Partial | Not compared | Required | P3 | Download the lab request as PDF. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | A PDF and file-saving library in the apps |  |
| #172 | cbct form | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #173 | cbct form1 | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #174 | cbct form2 | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #175 | cbct form3 | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #176 | X RAY LAB | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #177 | X RAY LAB DROPDOWN | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #178 | sent sucessfully popup to labs | `/labs/book` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #179 | complaints / new | `/labs/complaints` | Built | Partial | Required | P3 | – | Close the remaining gap: Line-art background and tabs; seen as the empty state; filled rows carry the red / orange / green edge; the design shows counter boxes. | – | Pattern and stripes applied; re-compared (empty state) |
| #180 | view | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #182 | completed | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #183 | view/ completed | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #184 | Create complaints | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #185 | Create complaints epand | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #186 | complaints marked resoved popup | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #187 | complaints submitted | `/labs/complaints` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #189 | dental labs | `/labs/invoices`, `/labs/orders` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #190 | dental labs | `/labs/invoices`, `/labs/orders` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #191 | dental labs | `/labs/invoices`, `/labs/orders` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #192 | draft | `/appointments` › Drafts | Built | Differs | Required | P2 | – | Rework the layout to the frame: Drafts as a filter of My Appointments; the design has a separate draft list with a banner. | – |  |
| #193 | Delete draft | `/appointments` › Drafts | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #194 | Accounts | `/accounts`, `/accounts/invoices` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Period chips and figure tiles; the design has revenue / expense cards and category rows. | – |  |
| #195 | in -house selection | `/accounts`, `/accounts/invoices` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #196 | dentor selection | `/accounts`, `/accounts/invoices` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #197 | in-house selection | `/accounts`, `/accounts/invoices` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #198 | Invoice | `/accounts`, `/accounts/invoices` | Built | Differs | Required | P2 | – | Rework the layout to the frame: A filtered list; the design has a menu of Invoices, Receipts and Statement. | – |  |
| #199 | reciept selection | `/accounts`, `/accounts/invoices` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Receipts list; the design shows a receipt preview on letterhead (excluded). | – |  |
| #200 | reciept view | `/accounts/invoices` | Partial | Not compared | Required | P3 | Download receipt as PDF (not letterhead). | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | As #171 |  |
| #201 | invoice selection | `/accounts/invoices` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #202 | invoice view | `/accounts/invoice/[id]` | Partial | Differs | Required | P2 | Download invoice as PDF (not letterhead). | Rework the layout to the frame: Key-value invoice; the design is a letterhead invoice with QR. | As #171 |  |
| #203 | In house selection | `/accounts/expenses` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Category chips and a list; the design has a total card and category tiles. | – |  |
| #204 | consultant / expenses | `/accounts/expenses` | Built | Partial | Required | P3 | – | Close the remaining gap: Red total card and green-edged lines with the amount on the right (third pass); compared on an empty month, filled lines checked by the Clinic suite; the design adds an outstanding figure per line and a sample promo banner. | – |  |
| #205 | Duty doctors/ expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #206 | staff/ expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #207 | Purchases/ expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #208 | Domestic/ expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #209 | Misc/ expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #210 | Lab expenses | `/accounts/expenses` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #211 | Statement | `/accounts/statement` | Built | Partial | Required | P3 | – | Close the remaining gap: From / to, generate, totals, lines. | – |  |
| #212 | Satement view | `/accounts/statement` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #213 | MY APPOINTMENT | `/appointments`, `/appointments/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Counts, scope chips and list; the design has In-House / Dentor cards with artwork. | – |  |
| #214 | In-house | `/appointments`, `/appointments/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #215 | schedule appointment | `/appointments`, `/appointments/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Cards with actions; the design has a date strip and treatment-progress cards. | – |  |
| #216 | re-schedule appointment | `/appointments`, `/appointments/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #217 | cancelled appointment | `/appointments`, `/appointments/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Cancel is a bottom sheet with reasons; the design shows the cancelled card. | – |  |
| #218 | menu expand | `/appointments`, `/appointments/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #219 | case summary view | `/appointments`, `/appointments/[id]` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Details card with actions; the design opens straight to the case summary. | – |  |
| #220 | Consent form | Web › consents | Partial | – | Clarify | P3 | As #141. | – | Decision D10 |  |
| #221 | cancelled Popup | `/appointments/[id]` › Cancel | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #222 | Popup | `/appointments/[id]` › Cancel | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #223 | Popup for refund | `/appointments/[id]` › Cancel | Excluded | Not compared | Excluded | P3 | Refunds: online payments and "day closure with credit notes and refunds" are out of scope. | – | – |  |
| #224 | monthly | `/appointments/month` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #225 | RE - SCHEDULE APPOINMENT | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #226 | RE - SCHEDULE APPOINMENT time date select | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #227 | reschedule confirmation | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #228 | TIME SWAP | `/appointments/reschedule`, `/swap` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #230 | chat view | `/chat` | Built | Partial | Required | P3 | – | Close the remaining gap: Thread and send; the design has a framed panel and an upload action. | – |  |
| #231 | message | `/chat` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #232 | create message | `/chat` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #233 | Profile | More tab | Built | Partial | Required | P3 | – | Close the remaining gap: Name centred above round-icon rows in the design's order (Profile, Post A Offer, Settings, Help); initials instead of a photo, no Status or Ratings rows, extra app rows below. | – | Rows reordered; Status (D8) and photo remain |
| #234 | Profile | – | Not built | – | Clarify | P2 | Active / Inactive status on the profile: what it switches off (bookings, visibility). | – | Decision D8 |  |
| #235 | profile | `/clinic-profile` | Partial | Differs | Required | P2 | Show the sign-up (KYC) details and completion on the profile. | Rework the layout to the frame: Contact form; the design is the doctor's profile with completion and sections. | Editing them needs D5 |  |
| #236 | update profile | `/clinic-profile` | Partial | Not compared | Required | P3 | Show the sign-up (KYC) details and completion on the profile. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Editing them needs D5 |  |
| #237 | update profile options | `/clinic-profile` | Partial | Not compared | Required | P3 | Show the sign-up (KYC) details and completion on the profile. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Editing them needs D5 |  |
| #238 | profile update popup | – | Not built | – | Clarify | P3 | Confirm profile changes with a 4-digit code: by email (available) or SMS (excluded). | – | Decision D5 |  |
| #239 | profile update popup | – | Not built | – | Clarify | P3 | Confirm profile changes with a 4-digit code: by email (available) or SMS (excluded). | – | Decision D5 |  |
| #240 | Add clinic | – | Not built | – | Clarify | P3 | Additional clinic location (address, geo-tag, "set as primary"). | – | Decision D11 |  |
| #241 | profile update popup | – | Not built | – | Clarify | P3 | Additional clinic location (address, geo-tag, "set as primary"). | – | Decision D11 |  |
| #242 | add clinic | – | Not built | – | Clarify | P3 | Additional clinic location (address, geo-tag, "set as primary"). | – | Decision D11 |  |
| #243 | post a offer | `/offers/new` | Built | Partial | Required | P3 | – | Close the remaining gap: Same fields as chips; the design has a framed form over a banner. | – |  |
| #244 | post a offer select a tratment | `/offers/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #245 | post a offer | `/offers/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #246 | Sending option | `/offers/new` | Excluded | Not compared | Excluded | P3 | SMS / WhatsApp sending excluded; an email channel needs a decision. | – | Decision D12 for email |  |
| #247 | date time selector send later | `/offers` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #248 | post a offer poopup | `/offers` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #249 | post a offer view my post | `/offers` | Built | Partial | Required | P3 | – | Close the remaining gap: Red discount block with treatment, discount, valid-till and EDIT as designed (second pass); the offer title and view counts are added; the "My Post / Viewed" tabs are not built (who viewed opens in a sheet); the sample promo banner is left out. | – | Batch 1: design cards (tabs remain) |
| #250 | post a offer view | `/offers` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #251 | user pic change | – | Not built | – | Required | P2 | Change profile picture: from the gallery, remove; "Take photo" needs camera permission. | – | Camera: decision D13 |  |
| #252 | my history | `/accounts` › Dentor | Partial | Not compared | Excluded | P3 | Purchase history depends on store purchases (online payment excluded). | – | – |  |
| #253 | Payments | `/accounts` › Dentor | Partial | Partial | Excluded | P3 | Purchase history depends on store purchases (online payment excluded). | – | – |  |
| #254 | Filter | `/accounts` › Dentor | Partial | Not compared | Excluded | P3 | Purchase history depends on store purchases (online payment excluded). | – | – |  |
| #255 | refund | `/accounts` › Dentor | Excluded | Not compared | Excluded | P3 | As #223. | – | – |  |
| #256 | Pending | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Excluded | P3 | As #252. | – | – |  |
| #257 | labs | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Excluded | P3 | As #252. | – | – |  |
| #258 | labs | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Excluded | P3 | As #252. | – | – |  |
| #259 | e-com | `/store` | Partial | Differs | Required, blocked | P2 | Catalogue with enquiry; checkout excluded. | Rework the layout to the frame: Catalogue; the design frame is the purchase history (checkout excluded). | Store catalogue (BUSINESS_CONTENT 3) |  |
| #260 | e-com | `/store` | Partial | Not compared | Required, blocked | P3 | Catalogue with enquiry; checkout excluded. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Store catalogue (BUSINESS_CONTENT 3) |  |
| #261 | e prescription | `/rx/new` | Built | Partial | Required | P3 | – | Close the remaining gap: Chips for categories and types; the design has a drop-down and a list box. | – |  |
| #262 | copy paste | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #263 | copy paste | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #264 | e prescription | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #265 | e prescription | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #266 | drugs type | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #267 | drugs type | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #268 | e prescription | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #269 | combo drugs | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #270 | combo drugs selection | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #271 | SUCCEDDFULLY ADDED | `/rx/new` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #272 | PREVIEW | `/rx/new` › Preview | Partial | Not compared | Excluded | P3 | Prescription letterhead is a documented later-phase item. | – | – |  |
| #273 | Notification | `/notifications` | Built | Partial | Required | P3 | – | Close the remaining gap: Grouped by day; seen only as the empty state in this pass. | – |  |
| #274 | TRACKING clinic | `/tracking` | Partial | Differs | Clarify | P2 | Live map of the consultant. | Rework the layout to the frame: Request details and timeline; the design is the map tracking screen. | Decision D3 (maps key, location permission) |  |
| #275 | TRACKING multiple cases | `/tracking` | Partial | Differs | Clarify | P2 | Live map of the consultant. | Rework the layout to the frame: Empty state without a map; the design has visit cards with a progress line. | Decision D3 (maps key, location permission) |  |
| #276 | raise a ticket | `/support` | Built | Partial | Required | P3 | – | Close the remaining gap: FAQ / Contact, recent / previous tickets; the design's card layout differs. | – |  |
| #277 | create a ticket | `/support` | Built | Partial | Required | P3 | – | Close the remaining gap: Complaint type chips, subject, description; the design has a framed form over a banner. | – |  |
| #278 | ticket popup | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #279 | ticket details view | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #280 | ticket details view | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #281 | Settings | `/settings` (More › Settings) | Partial | Partial | Required | P1 | Separate Settings screen with the design rows (notification setting, password, fingerprint, uploads, privacy, terms, help). | Close the remaining gap: Same rows in the same order; round brand icons instead of outline icons, the fingerprint switch inline; no Uploads row (D4). | – | Done (Uploads row waits for D4) |
| #282 | finger print | More › Fingerprint sign-in | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #283 | finger print enable | More › Fingerprint sign-in | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #285 | password manager | `/change-password` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #286 | notification setting main | `/notification-settings` | Built | Partial | Required | P3 | – | Close the remaining gap: Same switches and silence chips; laid out as a plain list. | – |  |
| #287 | notification setting | `/notification-settings` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #288 | sleep mode | `/notification-settings` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #289 | text | `/notification-settings` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #290 | Privacy Policy | `/privacy`, `/terms` | Partial | Differs | Required, blocked | P2 | Final legal text. | Rework the layout to the frame: Placeholder text; the design carries the full policy text. | BUSINESS_CONTENT 1 |  |
| #291 | terms and conditions1 | `/privacy`, `/terms` | Partial | Differs | Required, blocked | P2 | Final legal text. | Rework the layout to the frame: As above. | BUSINESS_CONTENT 1 |  |
| #292 | terms and conditions 2 | `/privacy`, `/terms` | Partial | Not compared | Required, blocked | P2 | Final legal text. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 1 |  |
| #293 | terms and conditions 3 | `/privacy`, `/terms` | Partial | Not compared | Required, blocked | P2 | Final legal text. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 1 |  |
| #294 | Help center - FAQ | `/help` | Partial | Partial | Required, blocked | P2 | Contact links. | Close the remaining gap: FAQ with search; the design has a red header band. | BUSINESS_CONTENT 2 |  |
| #295 | Help center - contact us | `/help` | Partial | Differs | Required, blocked | P2 | Contact links. | Rework the layout to the frame: Contact is a ticket button; the design lists website, WhatsApp, Instagram (contacts not provided). | BUSINESS_CONTENT 2 |  |
| #296 | Upload | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #297 | upload | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #298 | Upload documets | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #299 | Upload documents | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #300 | Delete | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #301 | Upload empty | – | Not built | – | Clarify | P3 | Letterhead, signature and seal uploads: prescription letterhead is documented later phase; certificates are not named. | – | Decision D4 |  |
| #302 | faq text | `/help` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #303 | add new medicine | `/rx/new` › Add medicine | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #304 | add new medicine  select | `/rx/new` › Add medicine | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #305 | treatement tariff | `/tariff` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #307 | refer n earn | `/wallet` | Built | Differs | Required | P2 | – | Rework the layout to the frame: Points card, code and invite; the design has an illustration and steps. | – |  |
| #308 | invite | `/wallet` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #309 | offers | `/offers` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #310 | offers | `/offers` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #311 | wallet | `/wallet` | Excluded | Not compared | Excluded | P3 | Wallet money balance and top-up (online payments). | – | – |  |
| #312 | elite | `/plans` | Partial | Close | Required, blocked | P2 | Plans: request instead of purchase. | – | Decision D2 (activation) |  |
| #313 | elite | `/plans` | Partial | Close | Required, blocked | P2 | Plans: request instead of purchase. | – | Decision D2 (activation) |  |
| #314 | elite pro | `/plans` | Partial | Close | Required, blocked | P2 | Plans: request instead of purchase. | – | Decision D2 (activation) |  |
| #315 | elite PREMIUM | `/plans` | Partial | Close | Required, blocked | P2 | Plans: request instead of purchase. | – | Decision D2 (activation) |  |
| #317 | certificate options | `/certificates` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #318 | certificate | `/certificates` | Built | Partial | Required | P3 | – | Close the remaining gap: Tabs, search and list; the design has outlined cards with View. | – |  |
| #319 | certificate | `/certificates` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #320 | fitness certicate | `/certificates` | Built | Partial | Required | P3 | – | Close the remaining gap: Chips and the findings field; the design has drop-downs. | – |  |
| #321 | preview certificate | `/certificates/[id]` | Partial | Differs | Clarify | P2 | Certificate letterhead. | Rework the layout to the frame: Key-value certificate; the design is the letterhead certificate (excluded). | Decision D4 |  |
| #323 | referal certificate | `/certificates/new?type=Referral` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #324 | referel certificate | `/certificates/[id]` | Partial | Not compared | Clarify | P3 | As #321. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D4 |  |
| #326 | PERMISSIONS | `/welcome` | Built | Differs | Required | P2 | – | Rework the layout to the frame: As #17. | – |  |
| #328 | post a job | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #329 | view  post | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #330 | My post | `/jobs` | Built | Partial | Required | P3 | – | Close the remaining gap: Tabs and empty state. | – |  |
| #331 | Add post Job seeking | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #332 | No post | `/jobs` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #333 | Login agree | `/welcome` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #335 | forget password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #336 | forget password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #337 | enter email | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #338 | check ur email | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #339 | enter 4 digit code | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #340 | password reset | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #341 | set new password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #342 | set new password | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #343 | sucessful pop | `/forgot` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #344 | Chat | `/chat` | Built | Partial | Required | P3 | – | Close the remaining gap: Line-art background; seen as the empty state (rows carry the coloured edges as in the Clinic app). | – | Pattern and stripes applied; re-compared (empty state) |
| #345 | view | `/chat` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #346 | message | `/chat` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #347 | new message | `/chat` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #348 | signup agree | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #349 | SIGNUP | `/signup` | Built | Partial | Required | P3 | – | Close the remaining gap: As #33. | – |  |
| #350 | SIGNUP CON 1 | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #351 | SIGNUP CON 2 | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #352 | SIGNUP CON 3 | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #353 | otp | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #354 | sucessfully registered popup | `/signup` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #355 | Home | Today tab | Built | Partial | Required | P3 | – | Close the remaining gap: Line-art background and tiles in the design's navy and gold; no promo banner, Flip or product strip. | – | Pattern applied; re-compared |
| #356 | home after flip | Today tab | Partial | Not compared | Required | P2 | A "Flip" on the Today tiles. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #357 | Pending appointments | `/requests` | Built | Partial | Required | P3 | – | Close the remaining gap: Tabs and empty state; the design shows request cards. | – |  |
| #358 | floating page timestamp | – | Not built | – | Required | P3 | Floating status page (as #61–63). | – | – |  |
| #359 | floating page timestamp | – | Not built | – | Required | P3 | Floating status page (as #61–63). | – | – |  |
| #360 | menu | Profile tab | Partial | Not compared | Required | P3 | Side menu panel (the Clinic app has one). | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #361 | appointment notification | `/notifications` | Partial | Not compared | Required | P3 | In-app pop-ups for requests and reminders. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts |  |
| #362 | reminder 1 | `/notifications` | Partial | Not compared | Required | P3 | In-app pop-ups for requests and reminders. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts |  |
| #363 | reminder 2 | `/notifications` | Partial | Not compared | Required | P3 | In-app pop-ups for requests and reminders. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Push for closed-app alerts |  |
| #364 | set availability | `/availability` | Built | Partial | Required | P3 | – | Close the remaining gap: Default / custom and the times per day; the design uses day chips and time pickers in a gold frame. | – |  |
| #365 | set availability custom | `/availability` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #366 | set availability pop up | `/availability` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #367 | appointment pop up | Today › pending requests | Partial | Not compared | Required | P3 | Request pop-up on home. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #368 | ratings from clinic | `/reviews` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #369 | Home floating notification | – | Not built | – | Required | P3 | As #358. | – | – |  |
| #370 | complete procedure | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #371 | Vitals update | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #372 | end Procedure | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #373 | end Procedure | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #374 | start procedure | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #375 | start procedure | `/requests/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #376 | MY APPOINTMENT | Schedule tab | Built | Partial | Required | P3 | – | Close the remaining gap: Week strip and cards with the gold stripe; no totals band or drop-down per card. | – | Pattern applied; re-compared |
| #377 | action | Schedule tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #378 | Upcoming appointments | Schedule tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #379 | previous appointments | Schedule tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #380 | case summary view | `/appointments/[id]` | Built | Partial | Required | P3 | – | Close the remaining gap: Time, patient card with the allergy alert, actions; the design is the full case summary with images. | – |  |
| #381 | Appointment summary | `/appointments/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #382 | date time selector | `/requests/[id]` › offer times | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #383 | add notes | `/appointments/[id]` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #384 | re - SCHEDULE APPOINMENT | `/requests/[id]` › offer times | Partial | Not compared | Clarify | P3 | Who re-schedules a confirmed consultant visit, and whether the clinic must accept. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D14 |  |
| #385 | RE - SCHEDULE APPOINMENT time date select | `/requests/[id]` › offer times | Partial | Not compared | Clarify | P3 | Who re-schedules a confirmed consultant visit, and whether the clinic must accept. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D14 |  |
| #386 | reschedule confirmation | `/requests/[id]` › offer times | Partial | Not compared | Clarify | P3 | Who re-schedules a confirmed consultant visit, and whether the clinic must accept. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D14 |  |
| #387 | cancel APPOINMENT | `/requests/[id]` › Cancel | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #388 | appointment notification | `/notifications`, toast | Partial | Not compared | Required | P3 | Pop-ups instead of toasts. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #389 | cancelled Popup | `/notifications`, toast | Partial | Not compared | Required | P3 | Pop-ups instead of toasts. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #390 | View completed profile | `/patients/[id]`, Today tab | Built | Differs | Required | P2 | – | Rework the layout to the frame: Patient record with tabs; the design is the case summary. | – |  |
| #391 | Todays appoinment | `/patients/[id]`, Today tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #392 | treatement tariff | – | Not built | – | Clarify | P3 | Treatment tariff in the Consultant app: which clinic's tariff, or the consultant's own fees. | – | Decision D15 |  |
| #393 | treatement tariff 2 | – | Not built | – | Clarify | P3 | Treatment tariff in the Consultant app: which clinic's tariff, or the consultant's own fees. | – | Decision D15 |  |
| #394 | TRACKING | `/requests/[id]` statuses | Partial | Not compared | Clarify | P2 | As #274. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Decision D3 |  |
| #395 | my history | – | Not built | – | Excluded | – | As #252. | – | – |  |
| #396 | e-com | `/store` | Partial | Differs | Required, blocked | P2 | As #259. | Rework the layout to the frame: As #259. | BUSINESS_CONTENT 3 |  |
| #397 | e-com | `/store` | Partial | Not compared | Required, blocked | P3 | As #259. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 3 |  |
| #398 | refer n earn | `/wallet` | Built | Differs | Required | P2 | – | Rework the layout to the frame: As #307. | – |  |
| #399 | invite | `/wallet` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #400 | wallet | `/wallet` | Excluded | Not compared | Excluded | P3 | As #311. | – | – |  |
| #401 | inventory | `/inventory` | Built | Partial | Required | P3 | – | Close the remaining gap: Totals and tabs; the design adds a membership banner and per-item cards. | – |  |
| #402 | adjust | `/inventory` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #403 | history | `/inventory` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #404 | usage | `/inventory` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #405 | Update pop up | `/inventory` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #406 | elite | `/plans` | Partial | Close | Required, blocked | P2 | As #312. | – | Decision D2 |  |
| #407 | elite pro | `/plans` | Partial | Close | Required, blocked | P2 | As #312. | – | Decision D2 |  |
| #408 | elite PREMIUM | `/plans` | Partial | Close | Required, blocked | P2 | As #312. | – | Decision D2 |  |
| #409 | raise a ticket | `/support` | Built | Partial | Required | P3 | – | Close the remaining gap: As #276. | – | Pattern and stripes applied; re-compared (empty state) |
| #410 | create a ticket | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #411 | ticket popup | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #412 | ticket details view | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #413 | COMPLETED TICKET | `/support` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #414 | EARNINGS | Earnings tab | Built | Partial | Required | P3 | – | Close the remaining gap: Period chips and tiles; the design has a profile banner and visit cards. | – |  |
| #415 | date select | Earnings tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #416 | Completed | Earnings tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #417 | Refunded | Earnings tab | Excluded | Not compared | Excluded | P3 | As #223. | – | – |  |
| #418 | Notification | `/notifications` | Built | Partial | Required | P3 | – | Close the remaining gap: As #273. | – |  |
| #419 | Profile | Profile tab | Built | Partial | Required | P3 | – | Close the remaining gap: Profile card and practice details first, then Settings, Ratings & Reviews, Help; the design shows the photo and five rows only. | – | Rows reordered; Status (D8) remains |
| #420 | Profile | Profile tab | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #421 | update profile | `/edit-profile` | Partial | Not compared | Required | P3 | Full profile sections with completion. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Editing KYC needs D5 |  |
| #422 | Edit profile | `/edit-profile` | Partial | Differs | Required | P2 | Full profile sections with completion. | Rework the layout to the frame: Short edit form; the design has the full profile sections. | Editing KYC needs D5 |  |
| #423 | selection | `/edit-profile` | Partial | Not compared | Required | P3 | Full profile sections with completion. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | Editing KYC needs D5 |  |
| #424 | profile update popup | – | Not built | – | Clarify | P3 | As #238. | – | Decision D5 |  |
| #425 | profile update popup | – | Not built | – | Clarify | P3 | As #238. | – | Decision D5 |  |
| #426 | Settings | `/settings` (Profile › Settings) | Partial | Partial | Required | P1 | As #281. | Close the remaining gap: Judged against #281 (#426 has no PDF page): same rows and order; line-art background as the Consultant design. | – | Done (Uploads row waits for D4) |
| #427 | finger print enable | Profile › Fingerprint sign-in | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #429 | notification setting | `/notification-settings` | Built | Partial | Required | P3 | – | Close the remaining gap: As #286. | – |  |
| #430 | Privacy Policy | `/privacy`, `/terms` | Partial | Differs | Required, blocked | P2 | As #290. | Rework the layout to the frame: As #290. | BUSINESS_CONTENT 1 |  |
| #431 | terms and conditions1 | `/privacy`, `/terms` | Partial | Differs | Required, blocked | P2 | As #290. | Rework the layout to the frame: As #290. | BUSINESS_CONTENT 1 |  |
| #432 | terms and conditions 2 | `/privacy`, `/terms` | Partial | Not compared | Required, blocked | P2 | As #290. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 1 |  |
| #433 | terms and conditions 3 | `/privacy`, `/terms` | Partial | Not compared | Required, blocked | P2 | As #290. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 1 |  |
| #434 | Help center - FAQ | `/help` | Partial | Not compared | Required, blocked | P2 | As #294. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 2 |  |
| #435 | Help center - contact us | `/help` | Partial | Not compared | Required, blocked | P2 | As #294. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 2 |  |
| #436 | faq text | `/help` | Partial | Not compared | Required, blocked | P2 | As #294. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | BUSINESS_CONTENT 2 |  |
| #437 | rate us1 | `/reviews`, rate the clinic | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #438 | ratings and reviews 1 | `/reviews`, rate the clinic | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #439 | ratings and reviews | `/reviews`, rate the clinic | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| #441 | rate us | `/reviews`, rate the clinic | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |

### `patient-app` file: 40 frames

| Frame | Name | Now | Functional | Visual | Class | P | Functional fix | Visual fix | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2:434 | PERMISSIONS | first launch | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 1:8853 | login (disclaimer) | welcome + disclaimer | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 108:3353 | fingerprint login | `/login` fingerprint | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 108:3392 | forget password | `/forgot` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 108:4792 | enter email | `/forgot-email` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 108:6193 | enter 4 digit code | `/forgot-email` | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 108:7595 | password reset | `/forgot-email` | Partial | Not compared | Required | P3 | Pop-up between the code and the new password. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 108:9036 | set new password | reset, last step | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 108:9061 | set new password (filled) | reset, last step | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 108:9006 | sucessful pop | reset done | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 3:2185 | signup | `/signup` | Partial | Differs | Clarify | P2 | Patient sign-up fields (date of birth, alternate number, address in parts). | Rework the layout to the frame: see the review row. | Decision D16 |  |
| 215:400 | signup (short) | `/signup` | Partial | Differs | Clarify | P2 | As above. | Rework the layout to the frame: see the review row. | Decision D16 |  |
| 89:265 | Signup POP | `/signup` code | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 4:5421 | sucessfully registered popup | `/signup` done | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 6:1887 | Home | Home tab | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 98:1076 | Home (Fetch) | FETCH › `/fetch` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 18:163 | SCHEDULER | `/book` | Partial | Differs | Excluded | P2 | One-screen scheduler; "Start Video Consultation" is excluded; date/slot/callback are built in a wizard. | – | – |  |
| 90:281 | slot | `/book` step 2 | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 90:359 | date | `/book` step 2 | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 98:4010 | sucessfully Booked popup | `/book` done | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 135:293 | pop up for no slot | `/book` step 2 | Partial | Partial | Required | P3 | No-slot pop-up. | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 136:1692 | appointment rejected request | – | Not built | – | Clarify | P3 | Clinics approving or rejecting patient bookings (today they are confirmed at once). | – | Decision D17 |  |
| 76:2423 | upcoming | Visits tab | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 76:2531 | upcoming (Previous) | Visits tab | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 27:70 | recall popup from clinic | notification | Partial | Not compared | Required | P3 | Recall pop-up in the app. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 31:55 | video call consent | – | Excluded | – | Excluded | – | Video consultation (excluded). | – | – |  |
| 76:2621 | Case Profile | `/appointment/[id]` case summary | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 46:470 | xray & records | X-Ray & Reports | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 51:776 | xray & records (viewer) | `/reports/[id]` | Partial | Not compared | Required | P3 | Download records. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | File-saving library |  |
| 49:664 | Lab record | Records › Lab work | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 92:312 | CBCT | X-Ray & Reports, CBCT | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 92:405 | Payments | Payments | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 74:447 | ratings and reviews | `/reviews/new` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 74:518 | ratings and reviews (1 star) | `/reviews/new` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 74:586 | ratings and reviews (2 stars) | `/reviews/new` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 95:299 | Notification | Notifications tab | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 95:430 | Profile | Profile tab | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 215:306 | update profile | `/account/edit` | Partial | Differs | Clarify | P2 | The frame shows a doctor's profile; confirm the patient profile fields. | Rework the layout to the frame: see the review row. | Decision D16 |  |
| 96:984 | Terms and Conditions | `/account/terms` | Partial | Differs | Required, blocked | P2 | Final legal text. | Rework the layout to the frame: see the review row. | BUSINESS_CONTENT 1 |  |
| 97:1035 | Privacy policy | `/account/privacy` | Partial | Differs | Required, blocked | P2 | As above. | Rework the layout to the frame: see the review row. | BUSINESS_CONTENT 1 |  |

### `CMS` file (web): 40 frames

| Frame | Name | Now | Functional | Visual | Class | P | Functional fix | Visual fix | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 247:4787 | cms (home) | `/` Dashboard | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 155:7575 | cms / nav bar transform | Sidebar › collapse (desktop) | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – | Done (rail width differs) |
| 291:11615 | cms / appointments | `/appointments` | Partial | Differs | Required | P2 | Real-time queue table and revenue tiles. | Rework the layout to the frame: see the review row. | – |  |
| 313:14323 | appointments / daily view | `/appointments` By doctor | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 334:3694 | appointments / weekly view | `/appointments` Week | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 320:140 | appointments monthly view | `/appointments` Month | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 322:765 | appointments booking form | New Appointment dialog | Partial | Differs | Required | P2 | Full-page booking with specialities, consultants and projected invoice. | Rework the layout to the frame: see the review row. | – |  |
| 420:1929 | appointments booking form (service chosen) | New Appointment dialog | Partial | Differs | Required | P2 | As above. | Rework the layout to the frame: see the review row. | – |  |
| 411:944 | group appointment | – | Not built | – | Clarify | P3 | Group appointment. | – | Decision D6 |  |
| 306:13494 | Rescheduled appointments | `/appointments` Rescheduled | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 291:12260 | cancelled appointments | `/appointments` status filter | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 293:12811 | completed appointments | `/appointments` status filter | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 328:2428 | add procedure form | Masters › Treatment fees | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 183:1439 | cms / patients | `/patients` | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 210:12426 | patients / add patient | Register New Patient dialog | Partial | Differs | Required | P2 | Sectioned add-patient form with "Save as Draft". | Rework the layout to the frame: see the review row. | – |  |
| 215:2053 | add patient / otp verification | – | Not built | – | Excluded | – | OTP to the patient's mobile needs a real SMS gateway (excluded for now). | – | SMS gateway |  |
| 216:2638 | add patient / success | Register dialog | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 183:2491 | patients PROFILE / list view | `/patients/:id` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 198:7311 | patients PROFILE / grid view | `/patients/:id` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 382:190 | patient dash board | `/patients/:id` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 199:7976 | virtual card | `/patients/:id` › Virtual card | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 202:9390 | patients / case summary | Case sheet | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 223:4621 | patients / case sheet | `/patients/:id` › Case sheet | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 287:10971 | Clinical Chart | `/clinical` | Partial | Differs | Clarify | P2 | 2D / 3D tooth chart with AI insight. | Rework the layout to the frame: see the review row. | Decision D18 (3D model, AI service) |  |
| 343:6528 | Clinical Chart (2) | `/clinical` | Partial | Differs | Clarify | P2 | As above. | Rework the layout to the frame: see the review row. | Decision D18 |  |
| 165:15803 | cms / 3D dental chart | – | Not built | – | Clarify | P3 | As above. | – | Decision D18 |  |
| 346:178 | ACCOUNTS (dashboard) | `/accounts` dashboard | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 351:1801 | ACCOUNTS (invoice table) | `/accounts` Invoices | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 382:694 | ACCOUNTS / invoices | `/accounts` Invoices | Built | Partial | Required | P3 | – | Close the remaining gap: decorative layer (pattern background, edge-striped cards, design fields). | – |  |
| 362:3347 | ACCOUNTS / expenses / professional | `/expenses` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 364:4244 | ACCOUNTS / expenses / non-professional | `/expenses` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 383:1566 | cms / consultant | `/consultants` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 423:1389 | Future Revenue & Care Planning Dashboard | `/frs` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 423:1098 | Revenue Forecasting - FRS | `/frs` | Built | Differs | Required | P2 | – | Rework the layout to the frame: see the review row. | – |  |
| 423:1682 | Create New Care Plan - FRS | – | Not built | – | Required | P3 | Create a care plan (FRS). | – | – |  |
| 423:837 | Care Plan Review - FRS | – | Not built | – | Required | P3 | Care plan review (FRS). | – | – |  |
| 435:697 | Create New Invoice - FRS | New Invoice dialog | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 435:979 | Record Partial Payment - FRS | Record Payment dialog | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 435:1348 | Invoice Preview - FRS | Invoice view dialog | Built | Not compared | Required | P3 | – | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |
| 435:1217 | Invoice Issued - Success | toast | Partial | Not compared | Required | P3 | Invoice issued success screen. | Capture the state the frame shows at 360 × 800 (web 1440), pair with the PDF page and record a verdict. | – |  |

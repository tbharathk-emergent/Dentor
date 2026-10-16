# Design review: the Figma designs against the implemented apps

**Status on 15 October 2026, second pass** (after phases 0–9 and the first remediation work in
[`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md)). This replaces the 14 October statuses. Every frame of the three Figma files (530) is listed below with **three
separate results**:

- **Functional**: does the app do what the frame shows?
- **Visual**: does the screen look like the frame? This was judged only where a screenshot was put
  beside the design in this pass.
- **Responsive**: was the screen checked at phone and tablet widths?

**The apps are not design-complete.** Most built screens use the designs' brand, header, type,
colours and wording, but a simpler layout: plain cards, chips and lists instead of the designs'
illustrated cards, promo banners and patterned backgrounds. Only 28 frames are judged a
close visual match. The functional coverage is much higher than the visual coverage.

Nothing in the Figma files was changed. Nothing was committed, pushed or deployed.

## Totals

### Functional

| File | Frames | Built | Partial | Excluded | Not built | Not a screen |
| --- | --- | --- | --- | --- | --- | --- |
| `dentor` (Clinic + Consultant apps) | 443 | 305 | 71 | 14 | 44 | 9 |
| `patient-app` | 44 | 32 | 10 | 1 | 1 | 0 |
| `CMS` (web) | 43 | 28 | 7 | 0 | 5 | 3 |
| **All** | 530 | 365 | 88 | 15 | 50 | 12 |

- **Built**: the app does what the frame shows (possibly laid out differently).
- **Partial**: the screen exists, but part of what the frame shows is missing or done another way. The row says what.
- **Excluded**: the frame needs an agreed exclusion: online payments or refunds, video consultation, or real SMS / WhatsApp sending.
- **Not built**: nothing in the apps does this yet. The row says why.
- **Not a screen**: covers, reference sheets, loose panels.

### Visual

| File | Close | Partial | Differs | Not compared | n/a (not built, not a screen) |
| --- | --- | --- | --- | --- | --- |
| `dentor` (Clinic + Consultant apps) | 24 | 52 | 32 | 270 | 65 |
| `patient-app` | 4 | 23 | 9 | 6 | 2 |
| `CMS` (web) | 0 | 12 | 19 | 4 | 8 |
| **All** | 28 | 87 | 60 | 280 | 75 |

- **Close**: layout, content and look follow the frame; small differences are named.
- **Partial**: same brand, header, wording and content, but a simpler layout or a missing visual element.
- **Differs**: the screen's layout or presentation is clearly not the frame's.
- **Not compared**: built, but no screenshot was put beside this frame in this pass (mostly near-copies
  of a compared frame, form steps and pop-ups). Patient frames marked "compared 14 Oct" carry that
  day's verdict; the patient screens were not restyled since.

### Responsive

| File | Swept | Suite | Not checked | n/a |
| --- | --- | --- | --- | --- |
| `dentor` (Clinic + Consultant apps) | 370 | 0 | 8 | 65 |
| `patient-app` | 13 | 27 | 2 | 2 |
| `CMS` (web) | 0 | 35 | 0 | 8 |
| **All** | 383 | 62 | 10 | 75 |

- **Swept**: the frame's screen was opened at 320, 360, 390, 430, 768 and 1024 px in the browser build
  and passed the suites' layout rule: no sideways scroll, no clipped control, and on tablets every
  control inside the centred content column. A screen was swept in the state it opens in; later
  steps of a form, pop-ups and sheets inside it were covered only where the browser suites open them.
  125 screens were swept in the second pass (121 in the first); 124 passed. The one
  flag is the Clinic side menu, whose full-width dimmed backdrop and edge panel are deliberate (the
  Clinic suite already checks the menu by page overflow only).
- **Suite**: checked by a browser suite at those widths (patient suite: signed-in and signed-out
  screens; web suite: every sidebar page and its dialogs).
- **Not checked**: needs a real device (the fingerprint prompt), or was not opened at several widths.

Phones were also exercised on the Android emulator and the iPhone simulator with the Maestro flows (see
"Tests"). No tablet-size device run was repeated in this pass, and nothing was checked on physical
devices. The designs themselves have no tablet or phone-width web frames: every mobile frame is 360 pt
wide and every web frame 1280–2157 pt.

## How this review was done

| Step | Detail |
| --- | --- |
| Designs | The PDF exports in `docs/design/` (449, 57 and 43 pages), one page per frame; frames without a page are near-copies of a neighbour or loose panels. The `.fig` copies were read for exact values in the earlier passes (read-only). |
| Mobile screenshots | The three apps' browser builds against a freshly seeded local API, at 360 × 800 (the designs' size): 77 Clinic, 32 Consultant and 12 patient screens in the first pass, 125 in the second (adding Settings and Re-Visit). 115 of them were put beside a frame's PDF page (29 contact sheets, and 4 more for the screens changed in the second pass); the rest (overview, team, clinic rules, operations and similar) have no frame. |
| Web screenshots | The reception web app's production build at 1440 px: 18 views (dashboard, the five appointment views, booking dialog, patients, add patient, profile, case sheet, virtual card, clinical chart, accounts, expenses, consultants, treatment fees, FRS) beside their CMS pages. |
| Mismatched pairs | Where a frame has no PDF page the nearest neighbour was shown; those comparisons (monthly #224, re-schedule #226, time swap #228, lab profile #165, consultant forgot #337, help #434) were not used, and the frames stay "Not compared". |
| Functional status | From the implementation tracker, the code, and the tests listed below. |
| Responsive | The sweep and suites described above. |

## Found and fixed in this pass

| Where | Defect | Fix | Checked |
| --- | --- | --- | --- |
| Clinic app › Monthly (#224) | With no day chosen, the blank cells before the 1st and after the last day were drawn in solid red (`null === null` counted as the chosen day). | `apps/owner/src/app/(app)/appointments/month.tsx`: a blank cell is never the chosen day. | Screenshot after the fix; Clinic suite. |
| All apps › switches (browser builds) | Switch knobs were the browser default teal-green on the brand track. React Native Web reads the "on" knob from `activeThumbColor`. | `switchColors()` in `packages/shared/src/theme.ts`, used by the notification settings (both kits) and the fingerprint switch. Phone builds were already white. | Screenshot after the fix. |
| Clinic app › Home (#56) | The design's sample artwork was shown as real content: a "DENTAL DISCOUNT 50%" banner and four product cards priced in dollars ("$170 / $200 15% OFF"). | The banner is the clinic's own advertisement from the web app (hidden when none is active; home then opens on today's figures); the strip lists the store's real catalogue in rupees and is left out when the catalogue is empty. | Clinic suite (banner equals `/api/advertisement`, products equal `/api/engage/products`, no "$" on screen). |
| Web › Expenses (`362:3347`) | The Accounts dashboard said "Expenses this month ₹24,000 … All expenses →", but the Expenses page showed ₹0: it listed only hand-recorded expenses, not the lab payments and consultant visits that Accounts and the Clinic app count. | `frontend/src/pages/Expenses.tsx` now lists the accounts lines (`/api/clinic-app/accounts/expenses`) for a chosen period (this month by default), marks the automatic ones, and the web suite compares the page's total with the API. | Web suite. |

## What still differs visually, across the apps

1. **Promo banners are left out on purpose.** The "DENTAL DISCOUNT 50%" and "10% OFF" banners on inner
   screens are the designs' sample advertising; showing them would present invented offers. They need
   real advertising content (`BUSINESS_CONTENT.md`). The line-art pattern is now behind every Consultant
   screen and the Clinic screens whose frames draw it (labs, lab cases, complaints, offers, booking a
   consultant, forgot password), at 70 % strength so text on it stays legible.
2. **Cards are simpler in places**: list cards now carry the designs' coloured left edges (chats, lab
   cases, complaints, lab invoices, tickets, consultant bookings, Re-Visit, reviews); boxed counters,
   photo cards and illustrated tiles are still plain cards with initials, chips and key-value rows.
3. **Forms use chips** where the designs use drop-downs, and the label-above "pill" fields where the
   designs draw ticks beside each field.
4. **Letterhead previews** (invoice, receipt, certificate, prescription) are key-value cards: letterhead
   printing is an agreed exclusion, and the web app prints.
5. **Maps** (tracking) and **switches on the permissions screen** are replaced on purpose (sections 3 of
   the implementation plan).
6. **Empty states**: several screens were seen with no data (requests, complaints, reviews, chat), so
   their filled layout was not compared.

## Decisions and inputs still needed

- Final Privacy Policy and Terms text, help-centre contacts (website, WhatsApp, Instagram), store
  catalogue and prices, plan activation rules and the real lab directory: `docs/BUSINESS_CONTENT.md`.
- Whether to invest in the decorative layer (pattern backgrounds, banners, illustrated cards) to raise
  the visual match; it does not change what the apps do.

## `dentor` file: Clinic app (frames 0–324) and Consultant app (325–442)

File key `6BFopZGCdf45ZonsRY3xpR`. Ranges of near-copies share one finding ("As above").

| # | Frame | Name | App | Implemented counterpart | Functional | Visual | Responsive | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `4569:4239` | backup | Clinic | – | Not built | – | – | Back up and restore to Google Drive. Data already lives on the server; recorded in IMPLEMENTATION_PLAN section 3, not built. |
| 1 | `4415:2490` | restore | Clinic | – | Not built | – | – | As above. |
| 2 | `3879:2429` | RE- VISIT | Clinic | `/revisit` (menu › Re-Visit) | Built | Close | Swept | Patients whose treatment was completed, each once with the treatment, its date and the last visit; search; a card opens the patient to book (`GET /api/clinic-app/revisits`, built 15 Oct, second pass). **Look:** Green-edged cards with name, patient ID, date and time, last visit, treatment in red and "Completed" as designed; the sample promo banner is left out. |
| 3 | `4148:2447` | Book a service | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | Booking a lab service per kind; CBCT indications, region, field of view and consent. |
| 4 | `5556:3241` | blood | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 5 | `5556:6154` | xray | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 6 | `5556:7596` | cbct | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 7 | `5182:3281` | x ray labs | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 8 | `4052:4132` | Lab (profile) | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 9 | `4669:2761` | cbct form | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 10 | `4671:2857` | cbct form1 | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 11 | `4671:3049` | cbct form2 | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 12 | `4671:3131` | cbct form3 | Clinic | Labs › Book a Service (blood, X-ray, CBCT forms) | Built | Not compared | Swept | As above. |
| 13 | `4659:2721` | set availability | Clinic | Consultant app › Set Availability | Built | Not compared | Swept | Default weekly hours and custom days. |
| 14 | `4659:4153` | set availability custom | Clinic | Consultant app › Set Availability | Built | Not compared | Swept | As above. |
| 15 | `7977:4827` | splash screen | Clinic | – | Not a screen | – | – | Empty frame and file cover. |
| 16 | `7905:2991` | Cover | Clinic | – | Not a screen | – | – | As above. |
| 17 | `4151:3880` | PERMISSIONS | Clinic | `/welcome` (first launch) | Built | Differs | Swept | Permissions: the six rows with what each is for and its real state, then "Continue". The design's switches ask for everything up front; nothing is requested (agreed, IMPLEMENTATION_PLAN section 3). **Look:** Status text instead of switches (deliberate, see the functional note). |
| 18 | `2174:146` | Onboarding | Clinic | `/welcome` | Built | Close | Swept | Onboarding and the disclaimer with "Agree". **Look:** Illustration, title, text and buttons as designed. |
| 19 | `2682:940` | login | Clinic | `/welcome` | Built | Partial | Swept | As above. **Look:** Disclaimer text and veil as designed; no "I understand" tick box, the button takes the app red. |
| 20 | `2312:232` | Log In | Clinic | `/login` | Built | Close | Swept | Email or mobile, password, Remember me, Forget Password, Sign Up, fingerprint button (phone builds). **Look:** Folded header, logo, "Welcome", labels, Remember me, pill button, company line. The app adds a demo-login hint (development builds only) and leaves out "Select Clinic". |
| 21 | `3935:16549` | Log In | Clinic | `/login` | Built | Close | Swept | As above. **Look:** Folded header, logo, "Welcome", labels, Remember me, pill button, company line. The app adds a demo-login hint (development builds only) and leaves out "Select Clinic". |
| 22 | `2986:1033` | fingerprint login | Clinic | `/login` fingerprint | Built | Not compared | Not checked | Fingerprint or Face ID releases a per-device key. **The prompt itself was not seen:** it needs a phone with an enrolled fingerprint (docs/INTEGRATIONS.md). |
| 23 | `3935:23904` | Forget password | Clinic | `/forgot` | Built | Not compared | Swept | Reset by email with a 4-digit code, new password, success. |
| 24 | `2983:1511` | forget password | Clinic | `/forgot` | Built | Not compared | Swept | As above. |
| 25 | `2983:1548` | enter email | Clinic | `/forgot` | Built | Partial | Swept | As above. **Look:** Same brand and fields; the design shows the code step on the line-art background. |
| 26 | `2983:1567` | check ur email | Clinic | `/forgot` | Built | Partial | Swept | As above. **Look:** Same brand and fields; the design shows the code step on the line-art background. |
| 27 | `2983:1587` | enter 4 digit code | Clinic | `/forgot` | Built | Partial | Swept | As above. **Look:** Same brand and fields; the design shows the code step on the line-art background. |
| 28 | `2983:1629` | password reset | Clinic | `/forgot` | Built | Not compared | Swept | As above. |
| 29 | `2983:1608` | set new password | Clinic | `/forgot` | Built | Not compared | Swept | As above. |
| 30 | `2983:1691` | set new password | Clinic | `/forgot` | Built | Not compared | Swept | As above. |
| 31 | `2986:993` | sucessful pop | Clinic | `/forgot` | Built | Not compared | Swept | As above. |
| 32 | `3005:1004` | register popup | Clinic | `/signup` | Built | Not compared | Swept | Four steps with the email code, attachments, success pop-up; approval or rejection in the Super Admin console with an email to the applicant. |
| 33 | `6035:3433` | SIGNUP | Clinic | `/signup` | Built | Partial | Swept | As above. **Look:** The app starts with the email step; the design's stepper form comes after. |
| 34 | `6035:3501` | SIGNUP 2 | Clinic | `/signup` | Built | Partial | Swept | As above. **Look:** The app starts with the email step; the design's stepper form comes after. |
| 35 | `6035:3674` | SIGNUP 3 | Clinic | `/signup` | Built | Partial | Swept | As above. **Look:** The app starts with the email step; the design's stepper form comes after. |
| 36 | `6035:3736` | SIGNUP 4 | Clinic | `/signup` | Built | Partial | Swept | As above. **Look:** The app starts with the email step; the design's stepper form comes after. |
| 37 | `3932:10738` | sucessfully registered popup | Clinic | `/signup` | Built | Not compared | Swept | As above. |
| 38 | `6272:4866` | sucessfully registered popup 1 | Clinic | `/signup` | Built | Not compared | Swept | As above. |
| 39 | `4074:5194` | loading | Clinic | `/signup` | Built | Not compared | Swept | As above. |
| 40 | `7154:3177` | profile approval | Clinic | `/signup` | Built | Not compared | Swept | As above. |
| 41 | `7155:3198` | profile Rejection | Clinic | `/signup` | Built | Not compared | Swept | As above. |
| 42 | `3577:1580` | post a job | Clinic | `/jobs` | Built | Not compared | Swept | Job posts: hiring and looking for work, add, view, close, apply. |
| 43 | `3616:1845` | view  post | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 44 | `3579:1682` | My post | Clinic | `/jobs` | Built | Partial | Swept | As above. **Look:** Tabs and empty state; the design shows listing cards with Edit / Close. |
| 45 | `4522:2668` | Job post option | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 46 | `3579:1821` | Add post Job | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 47 | `5362:9787` | Add post Job seeking | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 48 | `3806:3663` | No post | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 49 | `6468:3615` | CANCEL THE POST | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 50 | `3596:1600` | Job post successfull | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 51 | `6468:3591` | Job applied successfull | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 52 | `3793:3622` | fix time notification | Clinic | – | Not built | – | – | Fix-time notification. |
| 53 | `6493:5834` | job view  hiring | Clinic | `/jobs` | Built | Not compared | Swept | Job views. |
| 54 | `6493:5919` | view Job seeking | Clinic | `/jobs` | Built | Not compared | Swept | As above. |
| 55 | `4537:2627` | Log In | Clinic | `/login` | Built | Not compared | Swept | As #20. |
| 56 | `37:626` | Home | Clinic | Home | Built | Partial | Swept | Greeting header, clinic location, the clinic's own advertisement as the banner (flips to today's figures), "Book appointment" specialities, the store's real products in rupees, reviews. Corrected 15 Oct: the design's sample banner and $-priced product cards had been shown as if real. **Look:** Header, location, specialities grid and reviews as designed; the banner is the clinic's text advertisement, not the sample artwork, and the product cards show the real catalogue; no "Post a Job" link or live-tracking strip. |
| 57 | `6763:4235` | timer in home screen | Clinic | – | Not built | – | – | Timer on home, advertisement pop-up, "today's appointment" overlay. |
| 58 | `6763:4402` | ads | Clinic | – | Not built | – | – | As above. |
| 59 | `6763:4481` | todays appointment  notification | Clinic | – | Not built | – | – | As above. |
| 60 | `6973:7983` | Home after flip | Clinic | Home (Flip) | Built | Partial | Swept | Today's figures in the design's tiles; money hidden from roles without it. **Look:** Count tiles as designed; the labels are the app's (Booked, Waiting, Completed, Collected). |
| 61 | `6973:7285` | floating page | Clinic | – | Not built | – | – | Floating appointment page with time stamps. |
| 62 | `6976:8275` | floating page timestamp | Clinic | – | Not built | – | – | As above. |
| 63 | `6983:8653` | floating page timestamp | Clinic | – | Not built | – | – | As above. |
| 64 | `3624:2263` | Home menu | Clinic | Home › menu | Built | Partial | Swept | Side menu with the appointment and clinical groups, filtered by role. **Look:** A full-height panel with outlined rows instead of the design's red-edged card. |
| 65 | `6800:6221` | Home menu options appointments | Clinic | Home › menu | Built | Not compared | Swept | As above. |
| 66 | `6800:9765` | Home menu options clinical | Clinic | Home › menu | Built | Not compared | Swept | As above. |
| 67 | `6994:6740` | Home header notification | Clinic | Bell › `/notifications` | Partial | Not compared | Swept | The bell opens the notifications screen; the design's drop-down from the header is not built. |
| 68 | `6983:8498` | Home header notification | Clinic | Bell › `/notifications` | Partial | Not compared | Swept | As above. |
| 69 | `3257:1322` | Consultant arrived | Clinic | Notifications, Live Tracking | Partial | Not compared | Swept | Consultant arrived / procedure completed arrive as notifications and tracking statuses, not as pop-ups. |
| 70 | `3300:998` | after consultant completes the case | Clinic | Notifications, Live Tracking | Partial | Not compared | Swept | As above. |
| 71 | `4408:2465` | procedure completed | Clinic | Notifications, Live Tracking | Partial | Not compared | Swept | As above. |
| 72 | `4659:2594` | procedure completed for multiple cases | Clinic | Notifications, Live Tracking | Partial | Not compared | Swept | As above. |
| 73 | `4476:2653` | icons | Clinic | – | Not a screen | – | – | Reference sheets: icons, tooth numbers, combos, variants, stamp, colour codes. |
| 74 | `4026:2549` | Tooth numbers for adult | Clinic | – | Not a screen | – | – | As above. |
| 75 | `4026:2628` | Tooth numbers for Pedo | Clinic | – | Not a screen | – | – | As above. |
| 76 | `4263:2591` | Combo treatment | Clinic | – | Not a screen | – | – | As above. |
| 77 | `4873:3230` | Variants | Clinic | – | Not a screen | – | – | As above. |
| 78 | `7001:4212` | stamp | Clinic | – | Not a screen | – | – | As above. |
| 79 | `5142:8652` | CONSULTANT APP | Clinic | – | Not built | – | – | App chooser. The Clinic and Consultant apps are installed separately. |
| 80 | `5142:8680` | CLINIC APP | Clinic | – | Not built | – | – | As above. |
| 81 | `5142:8707` | Log In | Clinic | `/login` | Built | Not compared | Swept | As #20. |
| 82 | `6470:3924` | new appointment | Clinic | `/consult/book` | Built | Partial | Swept | Book a consultant: case with quadrant, tooth, medical history, treatment, vitals, images, lab findings. **Look:** Patient, diagnosis, treatment chips and tooth grid; the design has drop-downs, upload rows and ticks. |
| 83 | `6778:6946` | own choice | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 84 | `6778:7115` | dentorchoice | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 85 | `2897:1108` | quadrant | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 86 | `4019:2334` | Tooth | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 87 | `4019:2434` | medical history | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 88 | `4904:3483` | treatment needed | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 89 | `6943:15589` | appointment notification popup | Clinic | – | Not built | – | – | Multi-patient appointment pop-up (one patient per request). |
| 90 | `7648:3664` | SELECT NEAR BY | Clinic | `/consult/book` › own choice | Built | Differs | Swept | Consultants near by, slots by morning / afternoon / evening, profile, confirmation. **Look:** Cards per consultant with fee and rating; the design has photo cards with "Profile" and "View Slots". |
| 91 | `7712:4441` | VIEW SLOT | Clinic | `/consult/book` › own choice | Built | Not compared | Swept | As above. |
| 92 | `2664:840` | consultant profile | Clinic | `/consult/book` › own choice | Built | Partial | Swept | As above. **Look:** Name, experience, fee, services, reviews; no photo or "Confirm Appointment" on the profile. |
| 93 | `3086:1102` | appointment confirmation  pop up | Clinic | `/consult/book` › own choice | Built | Not compared | Swept | As above. |
| 94 | `6959:6915` | bookin appointment multi patient if available own chpoice | Clinic | – | Not built | – | – | Booking several patients in one request. |
| 95 | `7772:7700` | bookin appointment multi patient if available for dentor | Clinic | – | Not built | – | – | As above. |
| 96 | `4151:4082` | for ROOT CANAL SELECTION | Clinic | `/consult/[id]` | Built | Not compared | Swept | Treatment selection and the consultant's answer (confirm or offered times). |
| 97 | `3093:1203` | appointment confirmation  from consultant 2 | Clinic | `/consult/[id]` | Built | Not compared | Swept | As above. |
| 98 | `3912:2633` | appointment confirmation  from consultant 3 | Clinic | `/consult/[id]` | Built | Not compared | Swept | As above. |
| 99 | `2380:372` | appointment confirmed and payment | Clinic | – | Excluded | – | – | "Pay Now", invoice after payment: online payments are excluded. Fees show "paid at the clinic". |
| 100 | `6478:4372` | view invoice | Clinic | – | Excluded | – | – | As above. |
| 101 | `4213:4857` | appointment confirmed After payment | Clinic | – | Excluded | – | – | As above. |
| 102 | `6349:3575` | dentor Appointment Type | Clinic | `/consult/book` › Dentor choice | Built | Close | Swept | Standard, peak hour and clinic preferred timing with their extra charges. **Look:** The three appointment types with their extra charges, declaration and Submit. |
| 103 | `7112:4277` | appointment confirmed After payment | Clinic | – | Excluded | – | – | Confirmation after payment (excluded). |
| 104 | `6349:3618` | time slot | Clinic | `/consult/book` | Built | Not compared | Swept | Time slots, confirmation, peak-hour slots. |
| 105 | `7067:4327` | dentor appointment confirm popup | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 106 | `7067:4212` | peak hour time slot | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 107 | `3500:1770` | timer for appointment | Clinic | Consult request timeline | Partial | Not compared | Swept | Timer: the request shows its timeline and statuses instead. |
| 108 | `6763:4010` | appointment confirmed and payment | Clinic | – | Excluded | – | – | Payment and invoice (excluded). |
| 109 | `6763:4040` | view invoice | Clinic | – | Excluded | – | – | As above. |
| 110 | `3508:2192` | select a choice drop down | Clinic | `/consult/book` | Built | Not compared | Swept | Choice drop-down. |
| 111 | `6468:3645` | select a choice drop down | Clinic | `/consult/book` | Built | Not compared | Swept | As above. |
| 112 | `4665:2559` | rate us | Clinic | `/consult/[id]` › rate | Built | Not compared | Not checked | Rate the consultant after a completed visit. |
| 113 | `6766:4734` | ratings and reviews | Clinic | `/consult/[id]` › rate | Built | Not compared | Not checked | As above. |
| 114 | `4742:3176` | ratings and reviews | Clinic | `/consult/[id]` › rate | Built | Not compared | Not checked | As above. |
| 115 | `6770:4826` | rate us | Clinic | `/consult/[id]` › rate | Built | Not compared | Not checked | As above. |
| 116 | `6225:3859` | reviews / pending | Clinic | Web › Reviews | Partial | – | – | Pending / approved review moderation is in the reception web app, not in the Clinic app. |
| 117 | `6225:3964` | reviews / approved | Clinic | Web › Reviews | Partial | – | – | As above. |
| 118 | `3132:1037` | Case Profile | Clinic | `/consult/[id]` case | Partial | Not compared | Swept | Case profile: the request shows the case sent; multi-visit is shown as the next sitting. |
| 119 | `5144:12799` | Case Profile for multi visit | Clinic | `/consult/[id]` case | Partial | Not compared | Swept | As above. |
| 120 | `3643:1928` | RE - SCHEDULE APPOINMENT | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | Re-schedule with reason (first date kept), time swap. |
| 121 | `2766:1051` | RE - SCHEDULE APPOINMENT time date select | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 122 | `2768:1201` | reschedule confirmation | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 123 | `2892:1358` | TIME SWAP | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 124 | `3487:2972` | timer | Clinic | – | Not built | – | – | Timer (covered by the consultant's start / end procedure). |
| 125 | `7977:3719` | PATIENTS | Clinic | `/patients`, `/patients/new` | Built | Differs | Swept | Figures, search, list; add patient with the design's sections and the duplicate warning. **Look:** Figure tiles and a list; the design has summary cards with avatars and "Quick Actions". |
| 126 | `7977:4638` | Add patient | Clinic | `/patients`, `/patients/new` | Built | Partial | Swept | As above. **Look:** Sections and fields follow the design; chips instead of drop-downs. |
| 127 | `7977:4759` | sucessfully added | Clinic | `/patients/new` | Built | Not compared | Swept | Added: a toast, not a pop-up. |
| 128 | `7977:3136` | PATIENTS | Clinic | `/patients/[id]` | Built | Not compared | Swept | Dashboard tiles, appointments, clinical (single and multi-visit), accounts with breakdown (money roles only), profile. |
| 129 | `7977:3276` | PATIENTS individual dashboard | Clinic | `/patients/[id]` | Built | Partial | Swept | As above. **Look:** Count tiles like the design's; the photo card is an initials banner. |
| 130 | `7977:4354` | PATIENT APPOINTMENT  SCHEDULED | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 131 | `7977:4430` | rescheduled | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 132 | `7977:4506` | prevoious | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 133 | `7977:3785` | Clinical profile | Clinic | `/patients/[id]` | Built | Differs | Swept | As above. **Look:** Tiles and a multi-visit list; the design repeats the case summary with vitals. |
| 134 | `7977:3955` | patient Clinical profile  for musti visit | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 135 | `7977:4153` | patient Clinical profile  for musti visit | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 136 | `7977:3370` | patient Accounts | Clinic | `/patients/[id]` | Built | Differs | Swept | As above. **Look:** Billed / paid / balance and invoices; the design has big boxed totals. |
| 137 | `7977:3423` | patient Accounts / payments | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 138 | `7977:3522` | view break down | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 139 | `7977:3610` | View all | Clinic | `/patients/[id]` | Built | Not compared | Swept | As above. |
| 140 | `7977:4201` | Patient profile | Clinic | `/patients/[id]` | Built | Differs | Swept | As above. **Look:** Key-value list; the design has sectioned cards. |
| 141 | `7977:4277` | Consent form | Clinic | Web › consents | Partial | – | – | Consent form signing stays at the reception web app; the dashboard lists consents. |
| 142 | `2072:413` | Existing APPOINTMENT | Clinic | – | Not built | – | – | Existing appointment, fix timing, minutes select. Consultant visit timing is handled by the request and the start / end procedure flow. |
| 143 | `3705:4648` | Fix timing | Clinic | – | Not built | – | – | As above. |
| 144 | `5311:3164` | Time fixed | Clinic | – | Not built | – | – | As above. |
| 145 | `3705:4730` | fix timing time /date selector | Clinic | – | Not built | – | – | As above. |
| 146 | `5307:7347` | minutes select | Clinic | – | Not built | – | – | As above. |
| 147 | `5307:7469` | Time fixed | Clinic | – | Not built | – | – | As above. |
| 148 | `3643:1858` | View Appointment for order id more than 1 patients | Clinic | – | Not built | – | – | Order with several patients, switch. |
| 149 | `2766:866` | switch to | Clinic | – | Not built | – | – | As above. |
| 150 | `2243:1096` | switch to otp | Clinic | – | Excluded | – | – | Switch to OTP payment, payment confirmation (online payments excluded). |
| 151 | `2161:9079` | payment confirmation | Clinic | – | Excluded | – | – | As above. |
| 152 | `7973:5399` | Select template | Clinic | `/recall` | Built | Not compared | Swept | Templates (select, edit, create), message, due date, result. **Delivered in the patient app only**: SMS / WhatsApp sending is excluded; patients without the app are listed back for a call. |
| 153 | `4900:2933` | recall notes | Clinic | `/recall` | Built | Partial | Swept | As above. **Look:** Patient, templates, message, due; the design adds the delivery channel (excluded) and a recipient card. |
| 154 | `6484:4633` | DAte select | Clinic | `/recall` | Built | Not compared | Swept | As above. |
| 155 | `4656:2499` | recall popup | Clinic | `/recall` | Built | Not compared | Swept | As above. |
| 156 | `7976:3297` | edit template | Clinic | `/recall` | Built | Not compared | Swept | As above. |
| 157 | `7979:5152` | Create template | Clinic | `/recall` | Built | Not compared | Swept | As above. |
| 158 | `7979:5101` | recall popup | Clinic | `/recall` | Built | Not compared | Swept | As above. |
| 159 | `5676:10822` | LAB | Clinic | `/labs` | Built | Partial | Swept | Diagnostic labs by kind, lab lists and profiles, request forms. **Look:** Line-art background as designed; lab kinds as tiles with counts where the design has a striped list; the sample "10% OFF" promo banner is left out. |
| 160 | `5676:12243` | diagnostic labs | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 161 | `5676:13658` | Blood  Investigation Labs | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 162 | `5676:16512` | x-ray labs | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 163 | `5676:17939` | DENTAL LABS | Clinic | `/labs` | Built | Partial | Swept | As above. **Look:** List with turnaround and services; no banner or tick boxes. |
| 164 | `5676:19366` | CBCT LABS | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 165 | `5676:9362` | Lab (profile) | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 166 | `5857:14292` | Blood  Investigation Labs FORM | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 167 | `5676:15085` | Blood  Investigation Labs FORM | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 168 | `5676:20793` | dental labs | Clinic | `/labs` | Built | Partial | Swept | As above. **Look:** Work, tooth and material chips; the design has boxed sections and tick boxes. |
| 169 | `5676:22262` | dental labs | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 170 | `5676:23724` | dental labs | Clinic | `/labs` | Built | Not compared | Swept | As above. |
| 171 | `5676:25245` | dental labs | Clinic | `/labs/book` | Partial | Not compared | Swept | Dental lab form; "Download" as PDF is not built (share and the lab board instead). |
| 172 | `5676:9078` | cbct form | Clinic | `/labs/book` | Built | Not compared | Swept | CBCT and X-ray forms, sent pop-up. |
| 173 | `5676:9146` | cbct form1 | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 174 | `5676:9209` | cbct form2 | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 175 | `5676:9310` | cbct form3 | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 176 | `5868:17943` | X RAY LAB | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 177 | `5868:16450` | X RAY LAB DROPDOWN | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 178 | `5868:19468` | sent sucessfully popup to labs | Clinic | `/labs/book` | Built | Not compared | Swept | As above. |
| 179 | `7123:12209` | complaints / new | Clinic | `/labs/complaints` | Built | Partial | Swept | New / on going / completed, create, resolve. **Look:** Line-art background and tabs; seen as the empty state; filled rows carry the red / orange / green edge; the design shows counter boxes. |
| 180 | `7123:16548` | view | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 181 | `7123:13652` | on going | Clinic | `/labs/complaints` | Built | Close | Swept | As above. **Look:** Line-art background, cards with the status-coloured left edge (orange in progress, green ready, red delayed); the counter boxes are tabs. |
| 182 | `7123:15100` | completed | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 183 | `7123:19386` | view/ completed | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 184 | `7123:17959` | Create complaints | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 185 | `7123:21045` | Create complaints epand | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 186 | `7123:20803` | complaints marked resoved popup | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 187 | `7123:20832` | complaints submitted | Clinic | `/labs/complaints` | Built | Not compared | Swept | As above. |
| 188 | `7123:20873` | invoice lab | Clinic | `/labs/invoices`, `/labs/orders` | Built | Close | Swept | Lab invoices and lab cases. **Look:** Search, edge-coloured cards with order, date, patient and the Receipt / Invoice buttons (second pass); totals card added; no date-range filter or microphone; sample promo banner left out. |
| 189 | `5852:12767` | dental labs | Clinic | `/labs/invoices`, `/labs/orders` | Built | Not compared | Swept | As above. |
| 190 | `5852:12794` | dental labs | Clinic | `/labs/invoices`, `/labs/orders` | Built | Not compared | Swept | As above. |
| 191 | `5852:12822` | dental labs | Clinic | `/labs/invoices`, `/labs/orders` | Built | Not compared | Swept | As above. |
| 192 | `3188:1068` | draft | Clinic | `/appointments` › Drafts | Built | Differs | Swept | Drafts hold no slot; delete. **Look:** Drafts as a filter of My Appointments; the design has a separate draft list with a banner. |
| 193 | `3604:2252` | Delete draft | Clinic | `/appointments` › Drafts | Built | Not compared | Swept | As above. |
| 194 | `7772:7393` | Accounts | Clinic | `/accounts`, `/accounts/invoices` | Built | Differs | Swept | In-house and Dentor accounts, revenue, expenses, invoices and receipts. **Look:** Period chips and figure tiles; the design has revenue / expense cards and category rows. |
| 195 | `7772:7583` | in -house selection | Clinic | `/accounts`, `/accounts/invoices` | Built | Not compared | Swept | As above. |
| 196 | `7772:7541` | dentor selection | Clinic | `/accounts`, `/accounts/invoices` | Built | Not compared | Swept | As above. |
| 197 | `7772:7499` | in-house selection | Clinic | `/accounts`, `/accounts/invoices` | Built | Not compared | Swept | As above. |
| 198 | `7772:6370` | Invoice | Clinic | `/accounts`, `/accounts/invoices` | Built | Differs | Swept | As above. **Look:** A filtered list; the design has a menu of Invoices, Receipts and Statement. |
| 199 | `7772:6243` | reciept selection | Clinic | `/accounts`, `/accounts/invoices` | Built | Differs | Swept | As above. **Look:** Receipts list; the design shows a receipt preview on letterhead (excluded). |
| 200 | `7772:7365` | reciept view | Clinic | `/accounts/invoices` | Partial | Not compared | Swept | Receipt view; "Download" as PDF is shared as text (letterhead printing is in the web app). |
| 201 | `7772:7212` | invoice selection | Clinic | `/accounts/invoices` | Built | Not compared | Swept | Invoice selection. |
| 202 | `7772:7342` | invoice view | Clinic | `/accounts/invoice/[id]` | Partial | Differs | Swept | Invoice view with share; no letterhead PDF. **Look:** Key-value invoice; the design is a letterhead invoice with QR. |
| 203 | `7772:6134` | In house selection | Clinic | `/accounts/expenses` | Built | Differs | Swept | Expenses by the seven categories, add expense; lab payments and consultant visits are added automatically. **Look:** Category chips and a list; the design has a total card and category tiles. |
| 204 | `7772:6497` | consultant / expenses | Clinic | `/accounts/expenses` | Built | Partial | Swept | As above. **Look:** Red total card and green-edged lines with the amount on the right (third pass); compared on an empty month, filled lines checked by the Clinic suite; the design adds an outstanding figure per line and a sample promo banner. |
| 205 | `7772:6609` | Duty doctors/ expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 206 | `7772:6721` | staff/ expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 207 | `7772:6816` | Purchases/ expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 208 | `7772:6915` | Domestic/ expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 209 | `7772:7014` | Misc/ expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 210 | `7772:7113` | Lab expenses | Clinic | `/accounts/expenses` | Built | Not compared | Swept | As above. |
| 211 | `7772:7617` | Statement | Clinic | `/accounts/statement` | Built | Partial | Swept | Statement with a running balance and share. **Look:** From / to, generate, totals, lines. |
| 212 | `7772:7640` | Satement view | Clinic | `/accounts/statement` | Built | Not compared | Swept | As above. |
| 213 | `7970:4256` | MY APPOINTMENT | Clinic | `/appointments`, `/appointments/[id]` | Built | Differs | Swept | In-house / Dentor, Today / Upcoming / Previous / Cancelled / Drafts, actions menu, case summary. **Look:** Counts, scope chips and list; the design has In-House / Dentor cards with artwork. |
| 214 | `7970:4322` | In-house | Clinic | `/appointments`, `/appointments/[id]` | Built | Not compared | Swept | As above. |
| 215 | `7970:3530` | schedule appointment | Clinic | `/appointments`, `/appointments/[id]` | Built | Differs | Swept | As above. **Look:** Cards with actions; the design has a date strip and treatment-progress cards. |
| 216 | `7970:3817` | re-schedule appointment | Clinic | `/appointments`, `/appointments/[id]` | Built | Not compared | Swept | As above. |
| 217 | `7970:3935` | cancelled appointment | Clinic | `/appointments`, `/appointments/[id]` | Built | Differs | Swept | As above. **Look:** Cancel is a bottom sheet with reasons; the design shows the cancelled card. |
| 218 | `7970:3688` | menu expand | Clinic | `/appointments`, `/appointments/[id]` | Built | Not compared | Swept | As above. |
| 219 | `7970:4013` | case summary view | Clinic | `/appointments`, `/appointments/[id]` | Built | Differs | Swept | As above. **Look:** Details card with actions; the design opens straight to the case summary. |
| 220 | `7970:4378` | Consent form | Clinic | Web › consents | Partial | – | – | Consent form: signed at the reception web app. |
| 221 | `7970:4184` | cancelled Popup | Clinic | `/appointments/[id]` › Cancel | Built | Not compared | Swept | Cancel with reason. |
| 222 | `7970:4210` | Popup | Clinic | `/appointments/[id]` › Cancel | Built | Not compared | Swept | As above. |
| 223 | `7970:4228` | Popup for refund | Clinic | `/appointments/[id]` › Cancel | Excluded | Not compared | Swept | Refund "processed in 2–5 days": no payment is taken or refunded; an optional refund note for the desk is recorded. |
| 224 | `7970:4247` | monthly | Clinic | `/appointments/month` | Built | Not compared | Swept | Monthly view with counts per day; a day opens its list. |
| 225 | `7970:4747` | RE - SCHEDULE APPOINMENT | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As #120–123. |
| 226 | `7970:4831` | RE - SCHEDULE APPOINMENT time date select | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 227 | `7970:4803` | reschedule confirmation | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 228 | `7970:4892` | TIME SWAP | Clinic | `/appointments/reschedule`, `/swap` | Built | Not compared | Swept | As above. |
| 229 | `5445:20329` | Chat | Clinic | `/chat` | Built | Close | Swept | Chat list, thread, new message to a consultant. **Look:** Cards with the design's cycle of coloured left edges, search, time; "+" is the pinned "New message" button. |
| 230 | `5445:20384` | chat view | Clinic | `/chat` | Built | Partial | Swept | As above. **Look:** Thread and send; the design has a framed panel and an upload action. |
| 231 | `5445:20426` | message | Clinic | `/chat` | Built | Not compared | Swept | As above. |
| 232 | `5445:26160` | create message | Clinic | `/chat` | Built | Not compared | Swept | As above. |
| 233 | `12:5` | Profile | Clinic | More tab | Built | Partial | Swept | Rows in the design's order: Profile, Post A Offer, Settings, Help; then clinic rules, notifications, tickets, sign out. "Status" waits for decision D8. **Look:** Name centred above round-icon rows in the design's order (Profile, Post A Offer, Settings, Help); initials instead of a photo, no Status or Ratings rows, extra app rows below. |
| 234 | `4635:2541` | Profile | Clinic | – | Not built | – | – | Active / Inactive status switch on the profile. |
| 235 | `2945:1345` | profile | Clinic | `/clinic-profile` | Partial | Differs | Swept | Clinic contact details are editable; the design's doctor profile with completion and KYC sections is not built (name, plan and status are managed by Dentor). **Look:** Contact form; the design is the doctor's profile with completion and sections. |
| 236 | `5499:29060` | update profile | Clinic | `/clinic-profile` | Partial | Not compared | Swept | As above. |
| 237 | `5823:12570` | update profile options | Clinic | `/clinic-profile` | Partial | Not compared | Swept | As above. |
| 238 | `4629:2487` | profile update popup | Clinic | – | Not built | – | – | Profile update confirmed with a 4-digit code (staff SMS codes are not configured). |
| 239 | `4629:3897` | profile update popup | Clinic | – | Not built | – | – | As above. |
| 240 | `4635:2604` | Add clinic | Clinic | – | Not built | – | – | Add a second clinic under one owner (a new clinic is a new application). |
| 241 | `4635:5466` | profile update popup | Clinic | – | Not built | – | – | As above. |
| 242 | `4635:6871` | add clinic | Clinic | – | Not built | – | – | As above. |
| 243 | `4635:8274` | post a offer | Clinic | `/offers/new` | Built | Partial | Swept | Create an offer: treatment-specific or general, percentage or amount, validity, patients. **Look:** Same fields as chips; the design has a framed form over a banner. |
| 244 | `6822:5668` | post a offer select a tratment | Clinic | `/offers/new` | Built | Not compared | Swept | As above. |
| 245 | `6820:3986` | post a offer | Clinic | `/offers/new` | Built | Not compared | Swept | As above. |
| 246 | `4635:11199` | Sending option | Clinic | `/offers/new` | Excluded | Not compared | Swept | Sending option by SMS / WhatsApp / email: excluded; offers reach the patient app only. |
| 247 | `6820:5460` | date time selector send later | Clinic | `/offers` | Built | Not compared | Swept | Send later, posted pop-up, My Posts with views and bookings. |
| 248 | `6822:7297` | post a offer poopup | Clinic | `/offers` | Built | Not compared | Swept | As above. |
| 249 | `6951:3980` | post a offer view my post | Clinic | `/offers` | Built | Partial | Swept | As above. **Look:** Red discount block with treatment, discount, valid-till and EDIT as designed (second pass); the offer title and view counts are added; the "My Post / Viewed" tabs are not built (who viewed opens in a sheet); the sample promo banner is left out. |
| 250 | `6951:5404` | post a offer view | Clinic | `/offers` | Built | Not compared | Swept | As above. |
| 251 | `6824:8707` | user pic change | Clinic | – | Not built | – | – | Change picture with the camera (no camera permission is used). |
| 252 | `3034:989` | my history | Clinic | `/accounts` › Dentor | Partial | Not compared | Swept | History and payments to Dentor as consultant visits by fee status; no purchase history. |
| 253 | `3602:1774` | Payments | Clinic | `/accounts` › Dentor | Partial | Partial | Swept | As above. **Look:** Tabs, period chips, totals; the design has a profile banner and refund cards. |
| 254 | `3602:1563` | Filter | Clinic | `/accounts` › Dentor | Partial | Not compared | Swept | As above. |
| 255 | `3602:1897` | refund | Clinic | `/accounts` › Dentor | Excluded | Not compared | Swept | Refunds: nothing is paid or refunded in the app; cancelled visits show "no charge". |
| 256 | `5145:3343` | Pending | Clinic | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Swept | Pending and lab payments. |
| 257 | `4061:4904` | labs | Clinic | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Swept | As above. |
| 258 | `5027:3524` | labs | Clinic | `/accounts` › Dentor, `/labs/invoices` | Partial | Not compared | Swept | As above. |
| 259 | `5027:6089` | e-com | Clinic | `/store` | Partial | Differs | Swept | E-com: a catalogue with an enquiry ticket. Checkout and purchase history are excluded (online payments). **Look:** Catalogue; the design frame is the purchase history (checkout excluded). |
| 260 | `5027:6503` | e-com | Clinic | `/store` | Partial | Not compared | Swept | As above. |
| 261 | `7636:3212` | e prescription | Clinic | `/rx/new` | Built | Partial | Swept | E-prescription: drugs by category and type, combos, copy & paste, dose, add new medicine, submit. **Look:** Chips for categories and types; the design has a drop-down and a list box. |
| 262 | `7646:3333` | copy paste | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 263 | `7646:3411` | copy paste | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 264 | `6534:6373` | e prescription | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 265 | `6534:5661` | e prescription | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 266 | `6534:5734` | drugs type | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 267 | `6534:5889` | drugs type | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 268 | `6546:4097` | e prescription | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 269 | `6534:5965` | combo drugs | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 270 | `6534:6041` | combo drugs selection | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 271 | `6534:6189` | SUCCEDDFULLY ADDED | Clinic | `/rx/new` | Built | Not compared | Swept | As above. |
| 272 | `6534:6091` | PREVIEW | Clinic | `/rx/new` › Preview | Partial | Not compared | Swept | Preview and share; the letterhead PDF is the agreed Phase-2 exclusion. |
| 273 | `14:299` | Notification | Clinic | `/notifications` | Built | Partial | Swept | Grouped by day. **Look:** Grouped by day; seen only as the empty state in this pass. |
| 274 | `2405:1094` | TRACKING clinic | Clinic | `/tracking` | Partial | Differs | Swept | Live tracking without the map: today's visits with their statuses (on the way, running late, arrived, started, finished). The map needs a maps key and device location. **Look:** Request details and timeline; the design is the map tracking screen. |
| 275 | `2466:422` | TRACKING multiple cases | Clinic | `/tracking` | Partial | Differs | Swept | As above. **Look:** Empty state without a map; the design has visit cards with a progress line. |
| 276 | `2711:627` | raise a ticket | Clinic | `/support` | Built | Partial | Swept | Raise a ticket, recent / previous, details with Dentor's answers. **Look:** FAQ / Contact, recent / previous tickets; the design's card layout differs. |
| 277 | `2717:586` | create a ticket | Clinic | `/support` | Built | Partial | Swept | As above. **Look:** Complaint type chips, subject, description; the design has a framed form over a banner. |
| 278 | `3720:1767` | ticket popup | Clinic | `/support` | Built | Not compared | Swept | As above. |
| 279 | `2785:3190` | ticket details view | Clinic | `/support` | Built | Not compared | Swept | As above. |
| 280 | `5070:8757` | ticket details view | Clinic | `/support` | Built | Not compared | Swept | As above. |
| 281 | `22:675` | Settings | Clinic | `/settings` (More › Settings) | Partial | Partial | Swept | Settings screen in the design's order: Notification Setting, Password Manager, Finger Print, Privacy Policy, Terms And Conditions, Help. The "Uploads" row waits for decision D4 (letterhead). **Look:** Same rows in the same order; round brand icons instead of outline icons, the fingerprint switch inline; no Uploads row (D4). |
| 282 | `5534:3415` | finger print | Clinic | More › Fingerprint sign-in | Built | Not compared | Not checked | Switch in each app; the device prompt needs a real phone. |
| 283 | `6710:7909` | finger print enable | Clinic | More › Fingerprint sign-in | Built | Not compared | Not checked | As above. |
| 284 | `23:781` | password manager | Clinic | `/change-password` | Built | Close | Swept | Password manager; other devices are signed out. **Look:** Three fields with eye icons and the button. |
| 285 | `6710:7871` | password manager | Clinic | `/change-password` | Built | Not compared | Swept | As above. |
| 286 | `6710:7399` | notification setting main | Clinic | `/notification-settings` | Built | Partial | Swept | Mute, sound, vibrate, silence 30 / 60 / 90 minutes, sleep mode. Phone alerts start once a push service is connected. **Look:** Same switches and silence chips; laid out as a plain list. |
| 287 | `23:753` | notification setting | Clinic | `/notification-settings` | Built | Not compared | Swept | As above. |
| 288 | `6710:7151` | sleep mode | Clinic | `/notification-settings` | Built | Not compared | Swept | As above. |
| 289 | `6710:7741` | text | Clinic | `/notification-settings` | Built | Not compared | Swept | The frame is the message text for the mute switch: "Notification Muted Successfully" / "Notification Unmuted Successfully" are shown (not a text-size setting, as first read). |
| 290 | `27:216` | Privacy Policy | Clinic | `/privacy`, `/terms` | Partial | Differs | Swept | Screens built with **placeholder text marked as such**; the final text must come from Dentor (docs/BUSINESS_CONTENT.md). **Look:** Placeholder text; the design carries the full policy text. |
| 291 | `2085:751` | terms and conditions1 | Clinic | `/privacy`, `/terms` | Partial | Differs | Swept | As above. **Look:** As above. |
| 292 | `6478:4233` | terms and conditions 2 | Clinic | `/privacy`, `/terms` | Partial | Not compared | Swept | As above. |
| 293 | `6478:4267` | terms and conditions 3 | Clinic | `/privacy`, `/terms` | Partial | Not compared | Swept | As above. |
| 294 | `31:289` | Help center - FAQ | Clinic | `/help` | Partial | Partial | Swept | FAQ with search; "Contact us" raises a ticket. The design's website, WhatsApp and Instagram links need Dentor's real contacts. **Look:** FAQ with search; the design has a red header band. |
| 295 | `31:331` | Help center - contact us | Clinic | `/help` | Partial | Differs | Swept | As above. **Look:** Contact is a ticket button; the design lists website, WhatsApp, Instagram (contacts not provided). |
| 296 | `4873:3144` | Upload | Clinic | – | Not built | – | – | Upload letterhead, signature and seal: only used for letterhead printing (agreed exclusion). |
| 297 | `6719:4675` | upload | Clinic | – | Not built | – | – | As above. |
| 298 | `6713:4096` | Upload documets | Clinic | – | Not built | – | – | As above. |
| 299 | `6713:4264` | Upload documents | Clinic | – | Not built | – | – | As above. |
| 300 | `6713:4343` | Delete | Clinic | – | Not built | – | – | As above. |
| 301 | `6713:4522` | Upload empty | Clinic | – | Not built | – | – | As above. |
| 302 | `2929:3976` | faq text | Clinic | `/help` | Built | Not compared | Swept | FAQ text. |
| 303 | `6534:6121` | add new medicine | Clinic | `/rx/new` › Add medicine | Built | Not compared | Swept | New medicine. |
| 304 | `6534:6154` | add new medicine  select | Clinic | `/rx/new` › Add medicine | Built | Not compared | Swept | As above. |
| 305 | `2470:672` | treatement tariff | Clinic | `/tariff` | Built | Not compared | Swept | Treatment tariff by speciality with prices. |
| 306 | `2470:775` | treatement tariff 1 | Clinic | `/tariff` | Built | Close | Swept | As above. **Look:** Folding sections per speciality with mono headers and "• Treatment — ₹price" lines (second pass); the sample promo banner and product strip are left out. |
| 307 | `2922:1156` | refer n earn | Clinic | `/wallet` | Built | Differs | Swept | Refer 'n' earn: code, invite, 150 points when an invited clinic or consultant is approved. **Look:** Points card, code and invite; the design has an illustration and steps. |
| 308 | `2925:967` | invite | Clinic | `/wallet` | Built | Not compared | Swept | As above. |
| 309 | `4213:4674` | offers | Clinic | `/offers` | Built | Not compared | Swept | Offers. |
| 310 | `6970:7196` | offers | Clinic | `/offers` | Built | Not compared | Swept | As above. |
| 311 | `2995:1017` | wallet | Clinic | `/wallet` | Excluded | Not compared | Swept | Wallet top-up and money balance: excluded; points only. |
| 312 | `6719:6100` | elite | Clinic | `/plans` | Partial | Close | Swept | Elite plans shown; "Begin Journey" files a request with Dentor. Purchase is excluded (online payments). **Look:** One dark plan card at a time with arrows, the plan's coloured tag (green, blue, pink), price, ticked benefits, BEGIN JOURNEY and the two notes (second pass). The design's discount percentage is not shown: the files contradict each other and it waits for D19. |
| 313 | `5348:3770` | elite | Clinic | `/plans` | Partial | Close | Swept | As above. **Look:** One dark plan card at a time with arrows, the plan's coloured tag (green, blue, pink), price, ticked benefits, BEGIN JOURNEY and the two notes (second pass). The design's discount percentage is not shown: the files contradict each other and it waits for D19. |
| 314 | `5348:3831` | elite pro | Clinic | `/plans` | Partial | Close | Swept | As above. **Look:** One dark plan card at a time with arrows, the plan's coloured tag (green, blue, pink), price, ticked benefits, BEGIN JOURNEY and the two notes (second pass). The design's discount percentage is not shown: the files contradict each other and it waits for D19. |
| 315 | `5348:3896` | elite PREMIUM | Clinic | `/plans` | Partial | Close | Swept | As above. **Look:** One dark plan card at a time with arrows, the plan's coloured tag (green, blue, pink), price, ticked benefits, BEGIN JOURNEY and the two notes (second pass). The design's discount percentage is not shown: the files contradict each other and it waits for D19. |
| 316 | `3043:999` | logout | Clinic | More › Sign out | Built | Close | Swept | The design's "Oh no! You're Leaving…" dialog. **Look:** The sad-tooth dialog with "Yes, Log Me Out" and "Nah, Still here". |
| 317 | `4893:3908` | certificate options | Clinic | `/certificates` | Built | Not compared | Swept | Fitness and referral certificates. |
| 318 | `4893:3708` | certificate | Clinic | `/certificates` | Built | Partial | Swept | As above. **Look:** Tabs, search and list; the design has outlined cards with View. |
| 319 | `4893:3764` | certificate | Clinic | `/certificates` | Built | Not compared | Swept | As above. |
| 320 | `4893:3925` | fitness certicate | Clinic | `/certificates` | Built | Partial | Swept | As above. **Look:** Chips and the findings field; the design has drop-downs. |
| 321 | `4893:3991` | preview certificate | Clinic | `/certificates/[id]` | Partial | Differs | Swept | Preview and share; letterhead PDF excluded. **Look:** Key-value certificate; the design is the letterhead certificate (excluded). |
| 322 | `4893:3809` | referal certificate | Clinic | `/certificates/new?type=Referral` | Built | Close | Swept | Referral certificate. **Look:** Fields and order as designed. |
| 323 | `4893:3858` | referal certificate | Clinic | `/certificates/new?type=Referral` | Built | Not compared | Swept | As above. |
| 324 | `4893:4031` | referel certificate | Clinic | `/certificates/[id]` | Partial | Not compared | Swept | As #321. |
| 325 | `3973:42507` | First Screen | Consultant | – | Not a screen | – | – | First screen (logo on blue): the native launch screen. |
| 326 | `6218:3647` | PERMISSIONS | Consultant | `/welcome` | Built | Differs | Swept | As #17. **Look:** As #17. |
| 327 | `3973:46118` | Onboarding | Consultant | `/welcome` | Built | Close | Swept | Onboarding. **Look:** As #18. |
| 328 | `5142:10254` | post a job | Consultant | `/jobs` | Built | Not compared | Swept | Job posts. |
| 329 | `5142:10321` | view  post | Consultant | `/jobs` | Built | Not compared | Swept | As above. |
| 330 | `5142:10349` | My post | Consultant | `/jobs` | Built | Partial | Swept | As above. **Look:** Tabs and empty state. |
| 331 | `4522:2601` | Add post Job seeking | Consultant | `/jobs` | Built | Not compared | Swept | As above. |
| 332 | `5362:9872` | No post | Consultant | `/jobs` | Built | Not compared | Swept | As above. |
| 333 | `3973:46397` | Login agree | Consultant | `/welcome` | Built | Not compared | Swept | Disclaimer before login. |
| 334 | `3973:6122` | Log In | Consultant | `/login` | Built | Close | Swept | As #20. **Look:** As #20, in navy and gold. |
| 335 | `3973:55798` | forget password | Consultant | `/forgot` | Built | Not compared | Swept | Forgot password by email with a 4-digit code. |
| 336 | `3973:57213` | forget password | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 337 | `3973:58613` | enter email | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 338 | `3973:60013` | check ur email | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 339 | `3973:61415` | enter 4 digit code | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 340 | `3973:61436` | password reset | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 341 | `3973:61498` | set new password | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 342 | `3973:61524` | set new password | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 343 | `3973:61467` | sucessful pop | Consultant | `/forgot` | Built | Not compared | Swept | As above. |
| 344 | `3973:17640` | Chat | Consultant | `/chat` | Built | Partial | Swept | Chat with clinics. **Look:** Line-art background; seen as the empty state (rows carry the coloured edges as in the Clinic app). |
| 345 | `3973:14835` | view | Consultant | `/chat` | Built | Not compared | Swept | As above. |
| 346 | `3973:12027` | message | Consultant | `/chat` | Built | Not compared | Swept | As above. |
| 347 | `5445:23346` | new message | Consultant | `/chat` | Built | Not compared | Swept | As above. |
| 348 | `3973:46678` | signup agree | Consultant | `/signup` | Built | Not compared | Swept | Consultant sign-up in four steps with the email code; approved into a clinic by the Super Admin. |
| 349 | `6278:3459` | SIGNUP | Consultant | `/signup` | Built | Partial | Swept | As above. **Look:** As #33. |
| 350 | `6278:3644` | SIGNUP CON 1 | Consultant | `/signup` | Built | Not compared | Swept | As above. |
| 351 | `6278:3825` | SIGNUP CON 2 | Consultant | `/signup` | Built | Not compared | Swept | As above. |
| 352 | `6278:4014` | SIGNUP CON 3 | Consultant | `/signup` | Built | Not compared | Swept | As above. |
| 353 | `3973:51335` | otp | Consultant | `/signup` | Built | Not compared | Swept | As above. |
| 354 | `3973:46966` | sucessfully registered popup | Consultant | `/signup` | Built | Not compared | Swept | As above. |
| 355 | `6933:11981` | Home | Consultant | Today tab | Built | Partial | Swept | Greeting header, today's tiles, next up, pending requests. **Look:** Line-art background and tiles in the design's navy and gold; no promo banner, Flip or product strip. |
| 356 | `6933:10521` | home after flip | Consultant | Today tab | Partial | Not compared | Swept | The flip side: today's appointments are listed below the tiles. |
| 357 | `6992:4101` | Pending appointments | Consultant | `/requests` | Built | Partial | Swept | Clinic requests: pending, upcoming, previous. **Look:** Tabs and empty state; the design shows request cards. |
| 358 | `6992:5694` | floating page timestamp | Consultant | – | Not built | – | – | Floating page with time stamps. |
| 359 | `6992:5766` | floating page timestamp | Consultant | – | Not built | – | – | As above. |
| 360 | `3973:45856` | menu | Consultant | Profile tab | Partial | Not compared | Swept | Side menu: its entries are rows on the Profile tab. |
| 361 | `3973:46041` | appointment notification | Consultant | `/notifications` | Partial | Not compared | Swept | Appointment notification and reminders: in-app notifications; phone alerts need the push service. |
| 362 | `3973:48406` | reminder 1 | Consultant | `/notifications` | Partial | Not compared | Swept | As above. |
| 363 | `3973:48423` | reminder 2 | Consultant | `/notifications` | Partial | Not compared | Swept | As above. |
| 364 | `3973:48456` | set availability | Consultant | `/availability` | Built | Partial | Swept | Set availability, default and custom, confirmation. **Look:** Default / custom and the times per day; the design uses day chips and time pickers in a gold frame. |
| 365 | `5792:7761` | set availability custom | Consultant | `/availability` | Built | Not compared | Swept | As above. |
| 366 | `3973:48440` | set availability pop up | Consultant | `/availability` | Built | Not compared | Swept | As above. |
| 367 | `3973:7686` | appointment pop up | Consultant | Today › pending requests | Partial | Not compared | Swept | Appointment pop-up: a pending count on home and the requests list. |
| 368 | `6772:5500` | ratings from clinic | Consultant | `/reviews` | Built | Not compared | Swept | Ratings from clinics. |
| 369 | `6994:6984` | Home floating notification | Consultant | – | Not built | – | – | Floating notification on home. |
| 370 | `3973:38065` | complete procedure | Consultant | `/requests/[id]` | Built | Not compared | Swept | Start procedure with the clinic's 4-digit code, vitals, end procedure with the next sitting, complete. |
| 371 | `3973:41000` | Vitals update | Consultant | `/requests/[id]` | Built | Not compared | Swept | As above. |
| 372 | `3973:42694` | end Procedure | Consultant | `/requests/[id]` | Built | Not compared | Swept | As above. |
| 373 | `3973:42719` | end Procedure | Consultant | `/requests/[id]` | Built | Not compared | Swept | As above. |
| 374 | `3973:42644` | start procedure | Consultant | `/requests/[id]` | Built | Not compared | Swept | As above. |
| 375 | `3973:42804` | start procedure | Consultant | `/requests/[id]` | Built | Not compared | Swept | As above. |
| 376 | `3973:52803` | MY APPOINTMENT | Consultant | Schedule tab | Built | Partial | Swept | Appointments by day, upcoming and previous, referral bookings. **Look:** Week strip and cards with the gold stripe; no totals band or drop-down per card. |
| 377 | `5142:3776` | action | Consultant | Schedule tab | Built | Not compared | Swept | As above. |
| 378 | `6907:5456` | Upcoming appointments | Consultant | Schedule tab | Built | Not compared | Swept | As above. |
| 379 | `5142:5289` | previous appointments | Consultant | Schedule tab | Built | Not compared | Swept | As above. |
| 380 | `3973:33724` | case summary view | Consultant | `/appointments/[id]` | Built | Partial | Swept | Case summary and appointment summary. **Look:** Time, patient card with the allergy alert, actions; the design is the full case summary with images. |
| 381 | `3973:32234` | Appointment summary | Consultant | `/appointments/[id]` | Built | Not compared | Swept | As above. |
| 382 | `3973:62953` | date time selector | Consultant | `/requests/[id]` › offer times | Built | Not compared | Swept | Date and time selector to propose up to three times. |
| 383 | `3973:33693` | add notes | Consultant | `/appointments/[id]` | Built | Not compared | Swept | Visit notes. |
| 384 | `3973:35191` | re - SCHEDULE APPOINMENT | Consultant | `/requests/[id]` › offer times | Partial | Not compared | Swept | Re-schedule: the consultant proposes new times and the clinic confirms. |
| 385 | `6501:6841` | RE - SCHEDULE APPOINMENT time date select | Consultant | `/requests/[id]` › offer times | Partial | Not compared | Swept | As above. |
| 386 | `6501:6951` | reschedule confirmation | Consultant | `/requests/[id]` › offer times | Partial | Not compared | Swept | As above. |
| 387 | `3973:36639` | cancel APPOINMENT | Consultant | `/requests/[id]` › Cancel | Built | Not compared | Swept | Cancel with reason. |
| 388 | `3973:46073` | appointment notification | Consultant | `/notifications`, toast | Partial | Not compared | Swept | Notification and cancelled pop-ups: in-app notification and a toast. |
| 389 | `3973:4512` | cancelled Popup | Consultant | `/notifications`, toast | Partial | Not compared | Swept | As above. |
| 390 | `3973:39536` | View completed profile | Consultant | `/patients/[id]`, Today tab | Built | Differs | Swept | Completed profile, today's appointments. **Look:** Patient record with tabs; the design is the case summary. |
| 391 | `5371:3464` | Todays appoinment | Consultant | `/patients/[id]`, Today tab | Built | Not compared | Swept | As above. |
| 392 | `3973:1647` | treatement tariff | Consultant | – | Not built | – | – | Treatment tariff in the Consultant app (the clinic's tariff is in the Clinic app). |
| 393 | `3973:3082` | treatement tariff 2 | Consultant | – | Not built | – | – | As above. |
| 394 | `3973:42897` | TRACKING | Consultant | `/requests/[id]` statuses | Partial | Not compared | Swept | Tracking from the consultant's side: on the way / running late / arrived. No map. |
| 395 | `5027:3904` | my history | Consultant | – | Not built | – | – | My history (purchases). |
| 396 | `5408:4993` | e-com | Consultant | `/store` | Partial | Differs | Swept | E-com: catalogue with enquiry; checkout excluded. **Look:** As #259. |
| 397 | `5408:5129` | e-com | Consultant | `/store` | Partial | Not compared | Swept | As above. |
| 398 | `3973:4566` | refer n earn | Consultant | `/wallet` | Built | Differs | Swept | Refer 'n' earn and invite. **Look:** As #307. |
| 399 | `3973:5449` | invite | Consultant | `/wallet` | Built | Not compared | Swept | As above. |
| 400 | `3973:24937` | wallet | Consultant | `/wallet` | Excluded | Not compared | Swept | Wallet money balance excluded; points only. |
| 401 | `6513:3943` | inventory | Consultant | `/inventory` | Built | Partial | Swept | Inventory: items, low stock, adjust, history, usage per case. **Look:** Totals and tabs; the design adds a membership banner and per-item cards. |
| 402 | `6513:4036` | adjust | Consultant | `/inventory` | Built | Not compared | Swept | As above. |
| 403 | `6513:4113` | history | Consultant | `/inventory` | Built | Not compared | Swept | As above. |
| 404 | `6513:4177` | usage | Consultant | `/inventory` | Built | Not compared | Swept | As above. |
| 405 | `7131:25854` | Update pop up | Consultant | `/inventory` | Built | Not compared | Swept | As above. |
| 406 | `5422:5649` | elite | Consultant | `/plans` | Partial | Close | Swept | Elite plans; request instead of purchase. **Look:** As #312–315, in the Consultant colours. |
| 407 | `5422:5710` | elite pro | Consultant | `/plans` | Partial | Close | Swept | As above. **Look:** As #312–315, in the Consultant colours. |
| 408 | `5422:5775` | elite PREMIUM | Consultant | `/plans` | Partial | Close | Swept | As above. **Look:** As #312–315, in the Consultant colours. |
| 409 | `3973:9101` | raise a ticket | Consultant | `/support` | Built | Partial | Swept | Tickets. **Look:** As #276. |
| 410 | `3973:19076` | create a ticket | Consultant | `/support` | Built | Not compared | Swept | As above. |
| 411 | `3973:12012` | ticket popup | Consultant | `/support` | Built | Not compared | Swept | As above. |
| 412 | `3973:10569` | ticket details view | Consultant | `/support` | Built | Not compared | Swept | As above. |
| 413 | `5144:10796` | COMPLETED TICKET | Consultant | `/support` | Built | Not compared | Swept | As above. |
| 414 | `3973:20519` | EARNINGS | Consultant | Earnings tab | Built | Partial | Swept | Earnings by period, clinic visits by status. **Look:** Period chips and tiles; the design has a profile banner and visit cards. |
| 415 | `5142:7076` | date select | Consultant | Earnings tab | Built | Not compared | Swept | As above. |
| 416 | `3973:22010` | Completed | Consultant | Earnings tab | Built | Not compared | Swept | As above. |
| 417 | `3973:23488` | Refunded | Consultant | Earnings tab | Excluded | Not compared | Swept | Refunded list: nothing is refunded in the app; cancelled visits show "no charge". |
| 418 | `6501:6675` | Notification | Consultant | `/notifications` | Built | Partial | Swept | Notifications. **Look:** As #273. |
| 419 | `5422:5948` | Profile | Consultant | Profile tab | Built | Partial | Swept | Profile card, then Settings, Ratings & Reviews, Help (the design's rows), then the work rows. "Status" waits for decision D8. **Look:** Profile card and practice details first, then Settings, Ratings & Reviews, Help; the design shows the photo and five rows only. |
| 420 | `5806:12428` | Profile | Consultant | Profile tab | Built | Not compared | Swept | As above. |
| 421 | `5422:6080` | update profile | Consultant | `/edit-profile` | Partial | Not compared | Swept | Availability, location, phone, about. The design's full profile with completion and KYC sections is not built. |
| 422 | `5792:9220` | Edit profile | Consultant | `/edit-profile` | Partial | Differs | Swept | As above. **Look:** Short edit form; the design has the full profile sections. |
| 423 | `5792:9330` | selection | Consultant | `/edit-profile` | Partial | Not compared | Swept | As above. |
| 424 | `5792:9552` | profile update popup | Consultant | – | Not built | – | – | Profile update confirmed with a code. |
| 425 | `5792:10957` | profile update popup | Consultant | – | Not built | – | – | As above. |
| 426 | `6501:6068` | Settings | Consultant | `/settings` (Profile › Settings) | Partial | Partial | Swept | As #281 (shared screen); Uploads waits for D4. **Look:** Judged against #281 (#426 has no PDF page): same rows and order; line-art background as the Consultant design. |
| 427 | `6501:6106` | finger print enable | Consultant | Profile › Fingerprint sign-in | Built | Not compared | Not checked | As #282. |
| 428 | `6501:6372` | password manager | Consultant | `/change-password` | Built | Close | Swept | Password manager. **Look:** As #284. |
| 429 | `6501:6272` | notification setting | Consultant | `/notification-settings` | Built | Partial | Swept | As #286. **Look:** As #286. |
| 430 | `6501:6198` | Privacy Policy | Consultant | `/privacy`, `/terms` | Partial | Differs | Swept | Placeholder text, as #290. **Look:** As #290. |
| 431 | `6501:6216` | terms and conditions1 | Consultant | `/privacy`, `/terms` | Partial | Differs | Swept | As above. **Look:** As #290. |
| 432 | `6501:6235` | terms and conditions 2 | Consultant | `/privacy`, `/terms` | Partial | Not compared | Swept | As above. |
| 433 | `6501:6254` | terms and conditions 3 | Consultant | `/privacy`, `/terms` | Partial | Not compared | Swept | As above. |
| 434 | `6501:6407` | Help center - FAQ | Consultant | `/help` | Partial | Not compared | Swept | As #294. |
| 435 | `6501:6458` | Help center - contact us | Consultant | `/help` | Partial | Not compared | Swept | As above. |
| 436 | `6501:6498` | faq text | Consultant | `/help` | Partial | Not compared | Swept | As above. |
| 437 | `6991:8957` | rate us1 | Consultant | `/reviews`, rate the clinic | Built | Not compared | Swept | Ratings and reviews, rate the clinic after a visit. |
| 438 | `6520:4728` | ratings and reviews 1 | Consultant | `/reviews`, rate the clinic | Built | Not compared | Swept | As above. |
| 439 | `6991:8985` | ratings and reviews | Consultant | `/reviews`, rate the clinic | Built | Not compared | Swept | As above. |
| 440 | `6520:4937` | reviews | Consultant | `/reviews`, rate the clinic | Built | Close | Swept | As above. **Look:** Search and green-edged review cards (second pass); average added; no date filter; "Rate Us" is reached from the completed visit instead. |
| 441 | `6991:8973` | rate us | Consultant | `/reviews`, rate the clinic | Built | Not compared | Swept | As above. |
| 442 | `3973:30719` | logout | Consultant | Profile › Sign out | Built | Close | Swept | The designed logout dialog. **Look:** Same dialog as #316. |

## `patient-app` file: patient app

File key `ua53Gkn05YXHtUlYjbcdlT`, 44 frames of 360 pt. The patient app was restyled on 14 October and not since; frames marked "compared 14 Oct" keep that verdict, the others were compared again on 15 October.

| Frame | Name | Implemented counterpart | Functional | Visual | Responsive | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| `2:434` | PERMISSIONS | first launch | Built | Differs | Swept | Six rows with what each is for and its state, "Continue" (nothing requested up front; agreed). |
| `2:648` | First Screen | splash | Built | Close | Not checked | Logo on #1d8992 (compared 14 Oct). |
| `1:8853` | login (disclaimer) | welcome + disclaimer | Built | Partial | Suite | Disclaimer text, "I understand", "Agree" (compared 14 Oct). |
| `1:7323` | Log In | `/login` | Built | Close | Swept | Folded header, the card with email or mobile and password, Remember me, Login, Sign Up. The app adds "Log in with a code". |
| `108:3353` | fingerprint login | `/login` fingerprint | Built | Not compared | Not checked | Built; **the device prompt needs a real phone** to verify. |
| `108:3392` | forget password | `/forgot` | Built | Partial | Swept | Mobile first with "Use my email instead"; the design asks for email. |
| `108:4792` | enter email | `/forgot-email` | Built | Partial | Swept | Email and "Send Code". |
| `108:6193` | enter 4 digit code | `/forgot-email` | Built | Not compared | Suite | Four-digit email code. |
| `108:7595` | password reset | `/forgot-email` | Partial | Not compared | Suite | The pop-up between code and new password is skipped. |
| `108:9036` | set new password | reset, last step | Built | Partial | Suite | Compared 14 Oct. |
| `108:9061` | set new password (filled) | reset, last step | Built | Partial | Suite |  |
| `108:9006` | sucessful pop | reset done | Built | Partial | Suite | Full screen with the mascot. |
| `3:2185` | signup | `/signup` | Partial | Differs | Suite | The design asks date of birth, alternate number and an eight-part address; the app asks gender and age. |
| `215:400` | signup (short) | `/signup` | Partial | Differs | Suite |  |
| `89:265` | Signup POP | `/signup` code | Built | Partial | Suite | Six-digit SMS code (the design shows four). |
| `4:5421` | sucessfully registered popup | `/signup` done | Built | Partial | Suite | Mascot as designed. |
| `6:1887` | Home | Home tab | Built | Partial | Swept | Header band, tip banner, tile illustrations, five-icon bar. FETCH and OFFERS tiles added in phase 8; PHARMACY is not built. |
| `98:1076` | Home (Fetch) | FETCH › `/fetch` | Built | Partial | Swept | Fetch is its own screen with a code to the record's mobile; the design overlays home. |
| `18:163` | SCHEDULER | `/book` | Partial | Differs | Swept | A four-step wizard; "Request Callback" added in phase 8; "Start Video Consultation" is **excluded** (not shown). |
| `90:281` | slot | `/book` step 2 | Built | Differs | Suite |  |
| `90:359` | date | `/book` step 2 | Built | Differs | Suite |  |
| `98:4010` | sucessfully Booked popup | `/book` done | Built | Partial | Suite |  |
| `135:293` | pop up for no slot | `/book` step 2 | Partial | Partial | Suite | An inline notice instead of the pop-up. |
| `136:1692` | appointment rejected request | – | Not built | – | – | Bookings are confirmed at once; nothing to reject. |
| `76:2423` | upcoming | Visits tab | Built | Partial | Swept | Compared 14 Oct. |
| `76:2531` | upcoming (Previous) | Visits tab | Built | Partial | Swept |  |
| `27:70` | recall popup from clinic | notification | Partial | Not compared | Suite | The clinic's recall arrives as a notification. |
| `31:55` | video call consent | – | Excluded | – | – | Video consultation is excluded. |
| `76:2621` | Case Profile | `/appointment/[id]` case summary | Built | Not compared | Suite | Case summary on a past visit (phase 8). |
| `46:470` | xray & records | X-Ray & Reports | Built | Partial | Swept | Compared 14 Oct. |
| `51:776` | xray & records (viewer) | `/reports/[id]` | Partial | Not compared | Swept | "Share records" built; "Download records" is not (needs a file-system library). |
| `49:664` | Lab record | Records › Lab work | Built | Partial | Suite | No report file on lab orders. |
| `92:312` | CBCT | X-Ray & Reports, CBCT | Built | Partial | Suite |  |
| `92:405` | Payments | Payments | Built | Partial | Suite | No online payment (excluded); no download. |
| `74:447` | ratings and reviews | `/reviews/new` | Built | Partial | Suite |  |
| `74:518` | ratings and reviews (1 star) | `/reviews/new` | Built | Partial | Suite |  |
| `74:586` | ratings and reviews (2 stars) | `/reviews/new` | Built | Partial | Suite |  |
| `95:299` | Notification | Notifications tab | Built | Partial | Suite |  |
| `95:430` | Profile | Profile tab | Built | Partial | Suite |  |
| `215:306` | update profile | `/account/edit` | Partial | Differs | Suite | The frame shows a doctor's profile, not a patient's. |
| `96:532` | settings | `/account/settings` | Built | Close | Swept | Fingerprint sign-in, Notification Setting, Privacy Policy, Terms in the design's rows. |
| `96:803` | Notification settings | `/account/notification-settings` | Built | Close | Swept | The six switches; phone alerts start with the push service. |
| `96:984` | Terms and Conditions | `/account/terms` | Partial | Differs | Suite | Placeholder text marked as such. |
| `97:1035` | Privacy policy | `/account/privacy` | Partial | Differs | Suite | As above. |

## `CMS` file: reception web app

File key `tiEh9EfrMjTwyF53NB9nV8`, 43 frames, desktop only. The file has no frame for the Super Admin console, the login page, or tablet and phone widths.

| Frame | Name | Implemented counterpart | Functional | Visual | Responsive | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| `247:4787` | cms (home) | `/` Dashboard | Built | Differs | Suite | Shell as designed (teal band, sidebar groups); page: quick actions, advertisement, figure tiles, today, notes, activity. Not built: 12-tile grid, staff on duty, weather. |
| `155:7575` | cms / nav bar transform | Sidebar › collapse (desktop) | Built | Partial | Suite | Collapses to an icon rail from the header button, remembered per browser; links keep their names and tooltips. The rail is 68 px (the design ~35 px) and the logo is not moved into the header. |
| `291:11615` | cms / appointments | `/appointments` | Partial | Differs | Suite | Five tiles, views and the day list; the queue table and revenue tiles are not built. |
| `313:14323` | appointments / daily view | `/appointments` By doctor | Built | Partial | Suite | One column per doctor; no mini calendar or provider filters. |
| `334:3694` | appointments / weekly view | `/appointments` Week | Built | Partial | Suite | Seven day columns with appointments. |
| `320:140` | appointments monthly view | `/appointments` Month | Built | Partial | Suite | Month grid with counts per day. |
| `322:765` | appointments booking form | New Appointment dialog | Partial | Differs | Suite | A dialog; no specialities, residents / visiting tabs or projected invoice. |
| `420:1929` | appointments booking form (service chosen) | New Appointment dialog | Partial | Differs | Suite |  |
| `411:944` | group appointment | – | Not built | – | – | One patient per booking. |
| `413:1845` | confirm appointment panel | – | Not a screen | – | – | Loose panel. |
| `306:13494` | Rescheduled appointments | `/appointments` Rescheduled | Built | Partial | Suite | Each move with its first date and time; seen as the empty state in this pass. |
| `291:12260` | cancelled appointments | `/appointments` status filter | Built | Partial | Suite | No reason cards. |
| `293:12811` | completed appointments | `/appointments` status filter | Built | Partial | Suite | No revenue or duration figures. |
| `328:2428` | add procedure form | Masters › Treatment fees | Built | Differs | Suite | Fee, GST, duration, unit and doctor's share in a dialog beside the fee table. |
| `183:1439` | cms / patients | `/patients` | Built | Partial | Suite | Card grid, totals, "+ Add Patient". |
| `210:12426` | patients / add patient | Register New Patient dialog | Partial | Differs | Suite | One dialog; no address parts, insurance or "Save as Draft". |
| `215:2053` | add patient / otp verification | – | Not built | – | – | SMS to staff-entered numbers is not configured. |
| `216:2638` | add patient / success | Register dialog | Built | Partial | Suite |  |
| `183:2491` | patients PROFILE / list view | `/patients/:id` | Built | Differs | Suite | Banner and tabs; the design has totals and a procedures table. |
| `198:7311` | patients PROFILE / grid view | `/patients/:id` | Built | Differs | Suite |  |
| `382:190` | patient dash board | `/patients/:id` | Built | Differs | Suite |  |
| `199:7976` | virtual card | `/patients/:id` › Virtual card | Built | Differs | Suite | Card with print, copy and WhatsApp share; no QR code. |
| `202:9390` | patients / case summary | Case sheet | Built | Partial | Suite |  |
| `223:4621` | patients / case sheet | `/patients/:id` › Case sheet | Built | Partial | Suite | Printable: patient, plan, procedures, prescriptions, visits. No odontogram or AI findings. |
| `287:10971` | Clinical Chart | `/clinical` | Partial | Differs | Suite | Periodontal and orthodontic charts; the 2D / 3D tooth chart and AI insight are not built. |
| `343:6528` | Clinical Chart (2) | `/clinical` | Partial | Differs | Suite |  |
| `165:15803` | cms / 3D dental chart | – | Not built | – | – | Needs a 3D model. |
| `337:6115` | Clinical Notes panel | – | Not a screen | – | – | Loose panel. |
| `338:6439` | history chip | – | Not a screen | – | – | Loose panel. |
| `346:178` | ACCOUNTS (dashboard) | `/accounts` dashboard | Built | Differs | Suite | Income, expenses, net this month, where it went; no chart, GST status or health meter. |
| `351:1801` | ACCOUNTS (invoice table) | `/accounts` Invoices | Built | Differs | Suite |  |
| `382:694` | ACCOUNTS / invoices | `/accounts` Invoices | Built | Partial | Suite |  |
| `362:3347` | ACCOUNTS / expenses / professional | `/expenses` | Built | Differs | Suite | Table with period and category filters (fixed this pass to list the same lines as Accounts). |
| `364:4244` | ACCOUNTS / expenses / non-professional | `/expenses` | Built | Differs | Suite |  |
| `383:1566` | cms / consultant | `/consultants` | Built | Differs | Suite | Cards with this month's load, hours and completion; no efficiency score or charts. |
| `423:1389` | Future Revenue & Care Planning Dashboard | `/frs` | Built | Differs | Suite | Pipeline board; the file's FRS style differs from the Dentor shell. |
| `423:1098` | Revenue Forecasting - FRS | `/frs` | Built | Differs | Suite |  |
| `423:1682` | Create New Care Plan - FRS | – | Not built | – | – |  |
| `423:837` | Care Plan Review - FRS | – | Not built | – | – |  |
| `435:697` | Create New Invoice - FRS | New Invoice dialog | Built | Not compared | Suite |  |
| `435:979` | Record Partial Payment - FRS | Record Payment dialog | Built | Not compared | Suite | Records a payment taken at the desk; no online payment. |
| `435:1348` | Invoice Preview - FRS | Invoice view dialog | Built | Not compared | Suite |  |
| `435:1217` | Invoice Issued - Success | toast | Partial | Not compared | Suite | A confirmation message instead of the screen. |

## Implemented screens with no designed counterpart

| App | Screens |
| --- | --- |
| Patient | Log in with a code, choose your clinic, family members, clinic information, change password, delete account, appointment and bill detail, prescriptions, chat, consent forms, my reviews, dental chart, offers |
| Clinic | Overview (owner analytics), team and logins, clinic rules, callback requests |
| Consultant | Patients list, write prescription, add treatment, file viewer, my prescriptions |
| Web | Login, book a consultant, schedule notes, prescriptions, certificates, pharmacy, lab board, inventory, staff, reports, reviews, omnichannel, leads, masters, settings, Super Admin console (clinics, applications, tickets) |

## Tests

See `docs/IMPLEMENTATION_PLAN.md` section 7 and `docs/RELEASE_CHECKLIST.md` for the full results of
15 October 2026, including what was not repeated.


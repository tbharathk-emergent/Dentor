# Business content Dentor must provide before release

For Dentor's management and whoever loads content into the production system. The apps are built so
that none of this is invented: where the real content is missing, the apps show a marked
placeholder, an empty list, or nothing. Each item says where it is used, what the apps show today,
and what is needed.

Status on 15 October 2026: **none of these items has been provided.**

## 1. Legal text

| Item | Where it appears | Today | Needed |
| --- | --- | --- | --- |
| Privacy Policy | Clinic and Consultant apps (Privacy Policy), patient app (Settings › Privacy Policy); the app-store listings need it at a public web address | A plain description of what the apps keep, under a yellow "Placeholder for Dentor's approved text" banner (`mobile/packages/shared/src/screens/engage/Legal.tsx`, `mobile/apps/patient/src/content/legal.ts`, with a notice that each clinic's approved text replaces it) | The approved policy text, its effective date, and the public URL; and whether the patient app shows Dentor's policy or each clinic's own |
| Terms and Conditions | same places | Placeholder, marked the same way (same files) | The approved terms and effective date |
| Medical disclaimer | First-launch disclaimer in all three apps | The designs' wording: "This app is not intended to supplement or be a substitute for the expertise and judgement of your dentist/doctor or any other healthcare professional." | Confirmation, or the approved wording |
| Company line | Login and help screens: "A Unit Of IQDS DENTAL INDIA Pvt. Ltd." (from the designs) | Shown as designed | Confirmation of the legal entity name |
| Record keeping | A deleted patient account leaves the clinic's medical record in place; notifications are deleted after 180 days | As described | Confirmation that both match the privacy policy and Indian record-keeping duties |

## 2. Help centre and support

| Item | Where | Today | Needed |
| --- | --- | --- | --- |
| Contact links | Help center › Contact us (designs: Customer Service, Website, WhatsApp, Instagram) | No links; "Raise a Ticket" only (`HelpScreen` takes them as `contacts`) | The phone number, website URL, WhatsApp number and Instagram handle, and the hours each is answered |
| FAQ answers | Help center › FAQ | Answers written from how the apps work (`mobile/packages/shared/src/screens/engage/Help.tsx`) | Review and approval, or Dentor's own FAQ |
| Ticket handling | Raise a Ticket (Clinic and Consultant apps), answered in the Super Admin console | Works; nobody is assigned | Who answers tickets and the promised response time |
| Support email | App-store listings | None | An address that is read |

## 3. Store catalogue (Dentor Store / E-Com)

The store is a catalogue with an enquiry ticket: purchases and payments are excluded.

| Item | Today | Needed |
| --- | --- | --- |
| Products | **Production has none.** Development shows six products with fictional brand names (`seed_products` in `backend/app/seed.py`, only with `SEED_DEMO=1`) | For each product: name, brand, category (Endodontics, Orthodontics, Preventive, Prosthodontics, Restorative, Sterilisation, or others), price, MRP, short description, and whether it is active |
| Member prices | The plans promise store discounts ("15% off on the store", "Best store prices") | Which discount each plan gives on which products |
| Enquiries | An enquiry opens a ticket to Dentor | Who answers, how orders and payment are handled outside the app, delivery areas |

## 4. Subscription plans

| Item | Today | Needed |
| --- | --- | --- |
| Plans and prices | ELITE ₹1,999 (60 days, 30 cases), ELITE PRO ₹3,999 (90 days, 50 cases), ELITE PREMIUM ₹9,999 (120 days, 100 cases), with the benefits listed in the designs; all values **taken from the designs** (`PLANS` in `backend/app/routers/engagement.py`) | Confirmation that these are the real prices and terms, GST treatment, and what "cases applicable" counts |
| Activation | "Begin Journey" files a Subscription ticket with Dentor; nothing is charged | The activation rule: who approves, how and where payment is taken (outside the app), how long activation takes, and who sets the clinic's plan in the Super Admin console |
| Current plan | Each clinic has a plan name set by the Super Admin (Standard in the demo) | The plan each existing clinic is on |

## 5. Refer 'n' earn and points

| Item | Today | Needed |
| --- | --- | --- |
| Points per referral | **150 points** when an invited clinic or consultant is approved (`REFERRAL_POINTS`). This value is **not from the designs**: the designs say "Earn 20 Gold Pts" when the friend's first booking is completed, and "1 gold pt = 1 Rupee" | The rule: how many points, for what event (approval or first completed booking) |
| Tiers | Silver from 0, Gold from 300, Platinum from 1,000 points (`TIERS`). **Not from the designs** | The tier names and thresholds, or no tiers |
| Redemption | "Points will be redeemable at the Dentor store"; nothing can be redeemed yet, and there is no money balance (wallet top-up is excluded) | How and where points are redeemed, and their value |

Until these are confirmed, consider hiding the numbers or treating the current values as provisional.

## 6. Lab directory

| Item | Today | Needed |
| --- | --- | --- |
| Labs | **Production has none.** Development shows five fictional labs (Smile Dental Lab, ZIREX Dental Lab, CityCare Diagnostics, ClearView X-ray Centre, 3D Scan CBCT Centre; `seed_labs`, only with `SEED_DEMO=1`). A clinic's owner or administrator can add labs (`/api/labs`) | For each real lab: name, kind (Dental, Blood Investigation, X-ray, CBCT), city, phone, services, turnaround days; whether Dentor maintains one directory for all clinics or each clinic keeps its own |
| Lab promotions | The designs' "10% OFF" lab banner | Real offers, if any, or none |

## 7. Booking a consultant: charges and rules

| Item | Today | Needed |
| --- | --- | --- |
| Peak-hour and clinic-preferred charges | +₹200 (peak, 5–9 PM) and +₹300 (clinic preferred), shown as paid at the clinic. **Taken from the designs** (`backend/app/consult.py`) | Confirmation |
| Standard appointment promise | "Assigned by Dentor within 48 hours, between 9 AM and 5 PM" (from the designs) | Confirmation, and who at Dentor assigns Dentor-choice requests |
| Consultant fees | Each consultant's fee is set on their profile | Real fees for each visiting consultant |

## 8. Messages the clinics send

| Item | Today | Needed |
| --- | --- | --- |
| Recall templates | **Production has none.** Development has three (Post-Surgical Care, Routine Hygiene Recall, Treatment Follow-up). Clinics can write their own (160 characters) | Approved standard templates, if Dentor wants to provide them |
| SMS text for codes | `<code> is your Dentor verification code. It expires in 5 minutes. Do not share it.` | The DLT-registered sender id and template (`docs/INTEGRATIONS.md`) |
| Email sender | none | The sender name and address for code and application emails |

## 9. App-store listings

| Item | Needed |
| --- | --- |
| Names and descriptions | Store names and texts for Dentor (patient), Dentor Consultant, Dentor Clinic |
| Screenshots | From release builds with demo data on a test server, never real patients |
| Privacy answers | Google Play data-safety form and Apple privacy labels: the apps collect name, phone, email, health records and photos the patient uploads |
| Review logins | One demo login per app that works against production for Apple and Google reviewers, and a plan for keeping them away from real clinics' data |
| Content rating, category, support URL | per store |

## Decisions needed

Each question below blocks only the frames that name it in [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md);
all other work continues. The recommended option is listed first.

| # | Question | Options (recommended first) | Blocks |
| --- | --- | --- | --- |
| D1 | **Referral points and tiers.** How many points does a referral earn, and when? Are there tiers, at what thresholds? | (a) The designs' rule: 20 points when the invited clinic or consultant completes its first booking, 1 point = ₹1, no tiers until redemption exists; (b) keep today's provisional 150 points on approval with Silver 0 / Gold 300 / Platinum 1,000; (c) hide points until Dentor decides | Wallet, Refer 'n' earn (#307–308, #398–399) |
| D2 | **Plan activation.** When a clinic taps "Begin Journey", who approves, how is the fee collected outside the app, and who changes the clinic's plan? | (a) Dentor's team answers the Subscription ticket, takes payment offline (bank transfer / invoice), and the Super Admin sets the plan and its end date in the console; (b) plans are informational only for now | #312–315, #406–408 |
| D3 | **Live map tracking.** Show the consultant's live position on a map? | (a) Not in this release: status tracking (on the way, running late, arrived) stays; (b) yes: needs a Google Maps key, location permission in the Consultant app while a visit is active, and a privacy-policy update | #274–275, #394 |
| D4 | **Letterhead, signature and seal uploads.** Prescription letterhead is a documented later-phase item. Should certificates and invoices get letterhead in this release? | (a) No: all letterhead in the later phase, with the uploads screen (#296–301); (b) certificates only now; (c) everything now (moves prescription letterhead forward) | #272, #296–301, #321, #324 |
| D5 | **Confirming profile changes with a code** (#238–239, #424–425). | (a) Send the 4-digit code by email (already built for password reset); (b) SMS, once a gateway exists; (c) no code: the signed-in session is enough | #235–239, #421–425 |
| D6 | **Several patients in one consultant order** (multi-patient request, "fix timing" with start, end, interval and patients per slot). | (a) Not in this release: one patient per request, book again for the next; (b) build it: one order, several cases, the clinic fixes a time per case | #52, #89, #94–95, #142–149, CMS `411:944` |
| D7 | **Timers** on home (#57), on a booking (#107) and on a visit (#124): what do they count? | (a) Time until the next confirmed consultant visit, shown only within the last hour; (b) leave out | #57, #107, #124 |
| D8 | **Active / Inactive status on the profile.** What does Inactive do? | (a) For a consultant: hides them from new clinic bookings (existing visits stay); for a clinic: nothing (remove the row); (b) pauses all bookings | #234, consultant Profile "Status" |
| D9 | **Back up and restore to Google Drive** (#0–1). | (a) Not needed: the data is on the server; offer a downloadable export later; (b) build Google Drive backup (needs a Google OAuth client) | #0–1 |
| D10 | **Consent forms in the Clinic app.** | (a) Show each patient's consents and their state in the Clinic app; signing stays in the patient app and the web app; (b) sign on the clinic phone | #141, #220 |
| D11 | **Additional clinic locations** (#240–242: second address with geo-tag, "set as primary"). | (a) Not in this release: one address per clinic; (b) branches with their own address only (same data); (c) branches as separate clinics | #240–242 |
| D12 | **Sending offers by email** (SMS and WhatsApp are excluded). | (a) In-app only, as today; (b) email to patients who agreed to marketing email (needs a consent field and the email service) | #246 |
| D13 | **Camera use.** "Take photo" for the profile picture needs the camera permission, which the apps do not request today. | (a) Gallery and remove only; (b) add the camera | #251 |
| D14 | **Re-scheduling a confirmed consultant visit.** Who may move it, and must the other side accept? | (a) Either side proposes a new time and the other accepts, as for new requests (built today for the consultant); (b) the clinic moves it directly | #384–386 |
| D15 | **Treatment tariff in the Consultant app.** Whose tariff? | (a) The consultant's own fees per treatment, shown to clinics when booking; (b) the tariff of each clinic they visit; (c) leave out | #392–393 |
| D16 | **Patient sign-up and profile fields.** The design asks date of birth, alternate number and an eight-part address; the app asks age and gender. | (a) Add date of birth (age computed) and an optional address; (b) all designed fields, some mandatory; (c) keep as is | `3:2185`, `215:400`, `215:306` |
| D17 | **Approving patient bookings.** Should the clinic accept or reject bookings made in the patient app? | (a) No: bookings are confirmed at once from the clinic's free slots (today); (b) yes, per-clinic setting | `136:1692` |
| D18 | **3D tooth chart and AI insight** (CMS clinical chart). | (a) Later phase: needs a licensed 3D tooth model and an AI service with clinical validation; (b) a 2D chart only now | CMS `287:10971`, `343:6528`, `165:15803` |
| D19 | **Store prices for members and the plans' discounts.** Which discount does each plan give, on which products? The designs contradict each other: ELITE is "15% off" in the Clinic frames (#313) but "10% off" in the Consultant frame (#406); ELITE PREMIUM is ₹9,999 (#315) and ₹3,999 (#408); ELITE validity is 60 days (#313) and 40 days (#406). The apps show the API's price, days and cases and no percentage until this is decided. | (a) One percentage per plan, on all products (ELITE PRO 15% as designed; the others to be stated); (b) per-product member prices | Store, plans |
| D20 | **Whose legal text the patient app shows.** | (a) Dentor's platform policy and terms, with each clinic's own terms linked where they exist; (b) each clinic's own text | Patient legal screens |

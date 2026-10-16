# Consistency audit: web app, mobile apps and API

Audited on 13 October 2026, with the reception web app as the reference. Ten areas were
compared: status words and colours, colour tokens, formats, roles, validation, clinic rules,
booking rules, the same record seen in two apps, wording, and tablet layout.

## What was found and fixed

Seven of the ten areas differed in the mobile apps. All of those were fixed in `mobile/`, and
`cd mobile && npm test` now fails if the web app's status colours, lead stage colours,
Settings switch names or palette change without the matching mobile change.

| Area | Result |
| --- | --- |
| Status words | Already the same in all four apps. |
| Status colours | Six differed in mobile (for example "Confirmed" was blue, green on the web). Fixed. |
| Colour tokens | Brand colours matched; text, border and semantic colours were older shades. Now the web's values. |
| Formats | Money matched. Relative time, file size and date-with-time differed in mobile. Fixed. |
| Roles | The same everywhere: one list in the API, used by the web and the Owner app. |
| Validation | Three mobile mismatches with the API (a pasted "+91 …" number was cut wrongly; a password rule the API does not have; a different email rule in the Owner app). Fixed. |
| Clinic rules | Owner app names and descriptions differed from the web Settings page, and "round off" was missing. Fixed. |
| Booking rules | The patient app takes slots, cut-offs and double booking from the API. Differences are in the web booking screens (below). |
| Same record in two apps | Statuses and totals agreed; some labels differed. Fixed. |
| Tablet layout | Checked up to 1024×1366. Three alignment defects fixed; no overflow or clipping at any width. |

Also fixed in the API: messages now print rupees with Indian grouping (₹1,50,000), as all
four apps do; they printed ₹150,000.

## Not fixed: the web app (the reference) disagrees with the API

These are in the existing web app. They were left alone because changing how the live
reception app behaves is a product decision. Each is a real inconsistency a user can meet.

1. **Double booking.** The web booking form never reads "Allow double booking": it refuses a
   double booking the API would allow, and counts Completed appointments as clashes (the API
   counts only Scheduled and Waiting). `frontend/src/pages/Appointments.tsx`.
2. **Doctors.** The web offers a fixed list of three doctors in Appointments, Prescriptions,
   Patients and Lab. The patient app offers the clinic's consultants (nine in the demo).
3. **Past dates.** The web blocks them only in the date field; the API accepts a past date
   from the front desk. The patient API refuses it.
4. **Book a Consultant.** The booking is saved before its appointment. If the appointment is
   refused, a Confirmed booking is left without one. Taken slots are read from consultant
   bookings only, so a slot booked in the patient app is still offered.
5. **Cancelling a consultant booking** does not cancel its appointment, so the Consultant app
   still shows it as Scheduled.
6. **Book a Consultant slots.** No 13:00 or 13:30, and a "once per calendar month" rule that
   the API and the patient app do not have.
7. **Badges.** Signed, Declined, Ready, Delayed, Planned, Flagged and Available have no colour
   of their own on the web, so the same word is grey on one page and coloured on another.
8. **Settings switch that is not stored shows Off.** "Round off" is not stored for existing
   clinics and shows Off, while the server rounds.
9. **Three Settings descriptions** do not say what the server does (cancelling in the patient
   app is not tied to online booking; double booking covers doctor or chair; the timeout is 30
   minutes after sign-in, not "of inactivity").
10. **Change password on the web** asks for three of four character types whatever the
    clinic's rule is.
11. **Reset password is offered on your own login**, which signs you out.
12. **New patient form.** Refuses age 0, accepts a one-letter name and any ten digits. The
    patient API needs two letters and a number starting 6 to 9.
13. **Leads "Pipeline value"** sums every lead; the Owner app's figure excludes Converted and
    Lost.
14. **Ledger "Paid"** sums payments; everywhere else Paid is the amount paid on invoices. They
    differ when there is an on-account payment.

## Not fixed: the API

1. **Clinic contact details live in two places.** The Owner app saves them to the clinic
   record; the patient app reads Settings first and the Consultant app reads Settings only.
   A phone number changed in the Owner app does not reach patients.
2. **Appointment notes are one field** shared by the patient's "notes for the clinic", the
   front desk's notes and the consultant's visit notes. The consultant's notes overwrite the
   patient's and are shown to the patient.
3. **"Collected" means two things** under one label: payments dated in the period (Owner
   overview and finance) and amount paid on invoices raised in the period (Owner team,
   Consultant earnings, web accounts).
4. **The Owner finance outstanding total** sums the first 100 invoices only; the overview's
   figure sums all.
5. **Reschedule is offered when online booking is off.** The server then refuses, and the
   app shows its message.
6. **No server-side validation** where only the clients validate: front-desk patient
   records, the clinic phone and email, the consultant phone, follow-up dates in the past.
7. **A consultant's availability is free text** that nothing enforces: a consultant who
   visits on Sunday mornings can be booked any day from the patient app.
8. **Dates in notifications** read "03 Sep 2026" and "9:30 AM"; the web prints "03 Sept 2026"
   and "9:30 am". The mobile apps match the API.
9. **A file uploaded by a patient has no date**, so the web's file list shows a dash.

## Decisions for the product owner

1. Delayed and Ready lab orders, Planned treatments and Declined consents are grey on the web,
   so they are now grey in the mobile apps too. If they should be coloured, colour them in
   both places together.
2. Signed consents are green in the mobile apps (as signed prescriptions are on the web) and
   grey on the web's consent tab.
3. The patient app offers appointments 14 days ahead; the server allows 90.
4. The patient app says "Still to pay" in amber; the web says "Balance" in red.
5. Wording differs by app for the same action: "Sign in" (web heading, Owner, Consultant),
   "Login to Dashboard" (web button), "Log in" (patient app); "Invoice" and "Bill";
   "Appointment" and "Visit".
6. Typeface: the web uses Inter, the mobile apps the system font. Left for the design review,
   because the Figma files will say which is intended.

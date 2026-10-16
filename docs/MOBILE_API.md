# Dentor mobile apps — API reference

Base URL: each app's `env.json` (`devApiUrl` for debug builds, `http://localhost:8000`;
`apiUrl` for release builds, `https://dentorapi.localappstore.in`). All bodies are JSON. Errors are
`{"detail": "human readable message"}` with a meaningful status (400 validation, 401 session
over, 403 not allowed, 404 not found, 409 conflict, 429 slow down, 503 not configured).
The shared client (`@dentor/shared` `api`) turns these into `ApiError` with `.message` = detail.

Dates are `YYYY-MM-DD`, times `HH:MM` (24 h). Responses for appointments also carry
`date_label` ("13 Oct 2026") and `time_label` ("10:30 AM"). Money is plain rupees (numbers).

## Sessions (all three apps)

| Call | Body | Notes |
|---|---|---|
| `POST /api/auth/login` | `{email, password, app}` | `app` = `"owner"` or `"consultant"`; the wrong role gets 403 with an explanation. Returns `access_token`, `refresh_token`, `user`. |
| `POST /api/auth/refresh` | `{refresh_token}` | Rotating, single use. Same response shape as the login of that account type. Handled automatically by the shared client. |
| `POST /api/auth/logout` | `{refresh_token}` and/or the bearer token | Ends this device's session on the server: its refresh token is retired and its access token gets 401 from then on. Other devices stay signed in. Always 200. Handled by `useSession().signOut()`; the web app sends only its bearer token. |
| `POST /api/auth/change-password` | `{current_password, new_password}` | Staff logins. Returns a fresh session; other devices are signed out. |
| `POST /api/auth/forgot` | `{email}` | Staff password reset: emails a 4-digit code. Same answer for an unknown email. `{sent, expires_in, resend_in, length}` (+ `dev_code` only when `EMAIL_PROVIDER=console`). 429 within 30 s of the last code or after 5 an hour. |
| `POST /api/auth/forgot/verify` | `{email, code}` | `{ticket}` (15 minutes). 400 for a wrong or expired code; 5 tries per code. |
| `POST /api/auth/forgot/reset` | `{ticket, new_password}` | Strong password unless the clinic turned the rule off. Ends every session and fingerprint sign-in of the login. |
| `POST /api/auth/signup/email`, `/signup/verify` | `{email}`, `{email, code}` | Sign-up step 1: verify the applicant's email. 409 if the email already has a login or a pending application. |
| `POST /api/auth/signup` | `{ticket, kind: "clinic" \| "consultant", password, aadhaar, profile, agreed}` | 201 `{id, status: "Pending"}`. `profile`: name, dob, mobile, alternate_mobile, gst, institution, graduation_year, dci_number, specialisation, door, street, area, landmark, pincode, city, state, country, clinic_name (clinic), experience, facebook, instagram, and the files dci_certificate / clinic_image as data URLs of up to 2 MB. Only the last four Aadhaar digits are kept. Signing in before approval answers 403 "being reviewed"; after a rejection, 403 with the reason. |
| `POST /api/auth/signup/status` | `{email}` | `{status: None \| Pending \| Approved \| Rejected, reason}` |
| `POST /api/auth/device/enroll` | `{device_name}` (bearer) | Turns fingerprint sign-in on: `{device_id, secret}`. The app keeps the secret in the Keychain / Keystore behind the biometric check; the API stores only its hash. Up to 5 devices per login. |
| `POST /api/auth/device/login` | `{device_id, secret, app, device}` | A normal new session, with the same app, status and clinic checks as `/login`. 401 once the password has changed or the credential was revoked. |
| `POST /api/auth/device/revoke` | `{device_id}` (bearer) | Turns it off for that device. |
| `GET /api/notifications` | | `{items:[{id,title,body,kind,data,read,created_at}], unread}` |
| `POST /api/notifications/read` | `{ids?: string[]}` | Omit `ids` to mark everything read. |
| `POST /api/devices` | `{token, platform}` | Push token registration (see `registerForPush`). |

Every sign-in is one session. Its access tokens carry the session id (`sid`) and keep it
across refreshes. Three things end sessions, and in each case the access token stops working
at once rather than when it would have expired:

- **Sign-out** ends that one session.
- **Presenting a refresh token a second time** ends that session (it means the token was copied).
- **A password change or reset, or deactivating a login,** ends every earlier session of that
  login, on staff, owner, consultant and patient logins alike. The device that changed the
  password carries on with the fresh pair in the response.

The Owner app saves clinic rules with `PATCH /api/settings` and body `{"values": {"name": value}}`,
which changes only the named settings (`PUT /api/settings` replaces the whole map).

## Patient app — `/api/patient/*`

Sign-in state is in the auth response: `profile` is the active clinic profile or `null`
(account exists but has not joined a clinic yet → show the clinic chooser).

### Account (no session needed)

Also: `POST /api/patient/auth/email/forgot` `{email}`, `/auth/email/verify` `{email, code}` → `{ticket}`,
`/auth/email/reset` `{ticket, new_password}` (password reset by email for accounts that have one), and
fingerprint sign-in `POST /api/patient/auth/device/enroll` (bearer), `/auth/device/login`
`{device_id, secret, device}`, `/auth/device/revoke` (bearer) — the same rules as the staff calls above.

| Call | Body | Result |
|---|---|---|
| `POST /auth/otp/request` | `{mobile, purpose}` purpose = `signup` \| `login` \| `reset` | `{sent, expires_in, resend_in, dev_otp?}`. `dev_otp` exists only in development (no SMS gateway) — show it as a hint when present. 409 if signing up a registered number; 429 if asked again within `resend_in` seconds; 503 if the server has no SMS provider. For `login`/`reset` an unknown number still answers `{sent:true}` (no hint that it is unregistered). |
| `POST /auth/otp/verify` | `{mobile, purpose, code}` | `{ticket}` (valid 10 min). 400 wrong/expired code, 429 after 5 wrong tries. |
| `POST /auth/signup` | `{ticket, name, password, email?, gender?, age?}` | 201 auth response. Password: ≥ 8 chars with a letter and a number. |
| `POST /auth/login` | `{identifier, password}` | identifier = mobile or email. 401 on bad credentials. |
| `POST /auth/login-otp` | `{ticket}` | ticket from purpose `login`. |
| `POST /auth/reset-password` | `{ticket, new_password}` | ticket from purpose `reset`. |

### Profiles (needs a session; works before a profile is chosen)

Also: `POST /api/patient/profiles/fetch` `{clinic_id, patient_code}` sends a 6-digit code to the mobile number
registered with that record (answer `{sent_to: "******1223", …}`; 409 if the record is already yours, 404 if no such ID),
and `POST /api/patient/profiles/fetch/verify` `{clinic_id, patient_code, code}` links it and answers with a session on it.

| Call | Body | Result |
|---|---|---|
| `GET /profiles` | | `{items:[Profile], active}` — every clinic record on this mobile number |
| `POST /profiles/select` | `{patient_id, clinic_id}` | auth response pinned to that profile → pass to `signIn()` |
| `GET /clinics?q=` | | `{items:[{id,name,city,code,address}]}` clinics accepting app registrations |
| `POST /profiles/join` | `{clinic_id, name?, age?, gender?}` | 201 auth response → `signIn()`. Reuses an existing record with this mobile. |
| `POST /profiles/family` | `{name, age?, gender?, relation?}` | 201 `{profile}`; then refresh `GET /profiles`. Needs an active profile. |
| `POST /devices` | `{token, platform}` | push token |

### Data (needs an active profile; always the signed-in patient's own records)

Also: `GET/PUT /api/patient/account/prefs` `{general, sound, vibrate, appointment_reminders, medicine_alerts, lab_alerts}`
(phone alerts only; notifications are always stored), `POST /api/patient/callback` `{when, note}` (409 while one is open),
`GET /api/patient/offers`, `POST /api/patient/offers/{id}/view`, booking body `offer_id`, and `case` on
`GET /api/patient/appointments/{id}` for a visit that has happened (`diagnosis, procedure, medicines, advice, vitals, files, notes`).

| Call | Notes |
|---|---|
| `GET /me`, `PATCH /me` | PATCH accepts any of `name,email,address,city,age,gender,blood,dob,emergencyName,emergencyMobile,photo,allergy,history`; returns the profile. `photo` is a `data:image/...` URL under 1.5 MB. |
| `GET /home` | one call for the home screen |
| `GET /doctors` | bookable doctors |
| `GET /slots?date=&doctor=` | `{slots:[{time,label,available}]}` |
| `GET /appointments?scope=upcoming\|past\|all` | items carry `can_cancel`, `can_reschedule`, `upcoming` |
| `POST /appointments` | `{date,time,doctor,reason?,notes?}` → 201 appointment. 403 if the clinic turned online booking off, 409 if the slot was taken. |
| `GET /appointments/{id}` | |
| `POST /appointments/{id}/cancel` | `{reason?}`; 400 once it can no longer be cancelled in the app |
| `POST /appointments/{id}/reschedule` | `{date,time}` |
| `GET /records` | `{treatments, procedures, timeline, teeth, lab_orders}`; `teeth` maps FDI tooth number → `{condition,note}` |
| `GET /prescriptions`, `GET /prescriptions/{id}` | meds rows: `{drug,dose,freq,days,unit,instruction}`; detail adds `clinic` |
| `GET /reports` | list without file content: `{id,name,category,size,created_at,mime,is_image,mine}` |
| `GET /reports/{id}` | includes `dataUrl` |
| `POST /reports` | `{name, dataUrl}` — PNG/JPG/WEBP/HEIC image or PDF as a data URL, ≤ 5 MB |
| `DELETE /reports/{id}` | only files the patient uploaded (`mine`) |
| `GET /consents`, `POST /consents/{id}/sign` | sign only when `status === "Pending"` |
| `GET /invoices` | `{items, payments, summary:{billed,paid,outstanding}}` |
| `GET /invoices/{id}` | adds `payments[]`, `clinic`. No online payment: bills are paid at the clinic. |
| `GET /chat`, `POST /chat` | POST `{text}` (≤ 1000 chars). Messages: `{mine,text,time,at}`. Poll GET every ~15 s while the screen is open. |
| `GET /reviews`, `POST /reviews` | POST `{subject, rating 1–5, text, visit?, tags?, recommend?}`; `subject` is `"clinic"` or a doctor's name; `tags` are the form's quick tags (others are dropped) and `recommend` is true or false. New reviews are `Pending` until the clinic approves. |
| `GET /notifications`, `POST /notifications/read` | as above |
| `POST /account/change-password` | `{current_password,new_password}` → fresh session |
| `POST /account/delete` | `{password}` — removes the app login only; then `signOut()` |

## Consultant app — `/api/consultant/*`

Everything is limited to the signed-in consultant's own appointments and patients.

| Call | Notes |
|---|---|
| `GET /me`, `PATCH /me` | PATCH `{availability?,location?,about?,phone?}` |
| `GET /dashboard?date=` | today's list + counts + next + upcoming |
| `GET /appointments?date=` or `?date_from=&date_to=` (`&status=`) | |
| `GET /appointments/{id}` | adds `patient_record` (summary) |
| `POST /appointments/{id}/status` | `{status, notes?}`. Allowed: Scheduled → Waiting/Completed/Cancelled; Waiting → Completed/Scheduled/Cancelled. Otherwise 400. |
| `GET /patients?q=` | my patients |
| `GET /patients/{id}` | `{patient, appointments, treatments, procedures, prescriptions, consents, files, teeth}` |
| `GET /patients/{id}/files/{fileId}` | file with `dataUrl` |
| `POST /patients/{id}/prescriptions` | `{diagnosis, complaint?, note?, meds:[{drug,dose?,freq?,days?,unit?,instruction?}], advice?, followUp?}` → 201 |
| `POST /patients/{id}/treatments` | `{name, tooth?, date?, status?, cost?, notes?}`; status Planned / In Progress / Completed. 400 if the clinic requires a signed consent and the patient has none. |
| `GET /prescriptions` | written by me |
| `GET /bookings` | referral bookings made for me |
| `GET /earnings?date_from=&date_to=` | billed / collected / outstanding + invoices |
| `GET /catalog` | `{medicines:[{name,form,in_stock}], treatments:[{name,category,price,duration}]}` for pickers |

## Dentor Clinic app (was Owner) — `/api/owner/*` and `/api/clinic/users`

Open to Clinic Owner, Administrator, Dentist/Doctor, Receptionist and Accountant (other roles get
403 "This login cannot use the Dentor Clinic app"). Money (`/finance`, rupee figures in `/overview`)
is for owners, administrators and accountants: for the others `/overview` answers `money: false`
with those figures as null. `/team` and `PATCH /clinic` are for owners and administrators.

| Call | Notes |
|---|---|
| `GET /api/owner/overview?date_from=&date_to=` | KPIs + daily `series` (≤ 62 days) + `today_summary` |
| `GET /api/owner/finance?date_from=&date_to=` | by mode / doctor / treatment, outstanding invoices, recent payments |
| `GET /api/owner/operations` | today's appointments, lab attention list, low stock, leads, reviews |
| `GET /api/owner/team?date_from=&date_to=` | doctor performance + staff directory |
| `GET /api/owner/clinic`, `PATCH /api/owner/clinic` | PATCH `{phone?,email?,address?,city?}` |
| `GET /api/settings`, `PATCH /api/settings` | PATCH `{values:{name: value}}` changes only the named settings and answers `{ok, values}` (PUT replaces the whole map; do not use it from the apps). Enforced by the API: `onlineBooking`, `doubleBooking`, `partialPayments`, `consentRequired`, `financialLock`, `sessionTimeout`, `strongPassword`, `roundOff`. |
| `GET /api/clinic/users` | `{items:[{id,name,email,role,status,consultant_id,consultant_name,created_at}], roles:[...]}` |
| `POST /api/clinic/users` | `{name,email,password,role,consultant_id?}` — `consultant_id` required for role `Consultant` (ids from `GET /api/consultants`, which an owner may call). 409 if the email or the consultant already has a login. |
| `PATCH /api/clinic/users/{id}` | `{name?,role?,status?,consultant_id?}`; status `Active`/`Inactive`. You cannot deactivate or change the role of your own login. |
| `POST /api/clinic/users/{id}/reset-password` | `{new_password}` |
| `GET /api/consultants` | consultant profiles (owner has full staff access to the generic clinic resources) |

### Appointments and patients — `/api/clinic-app/*`

Reading: every Clinic app role. Booking, moving, cancelling and adding patients: owner, administrator,
dentist and receptionist (an accountant gets 403 "Your role can see appointments and patients but not
change them."). The same collections as the reception web app, so changes show up there at once.

| Call | Notes |
|---|---|
| `GET /appointments?scope=&kind=&q=&date=` | scope `today` \| `upcoming` \| `past` \| `drafts` \| `cancelled` \| `all`; kind `in-house` \| `consultant` (a Visiting consultant's appointments, the design's "Dentor"); `date` = one day. `{today, items[], counts:{today, upcoming, drafts}}`. Each item: `id, code, patient, patient_code, date, time, *_label, treatment, doctor, chair, status, kind, source, cancel_reason, refund_note, reschedule_reason, rescheduled_from, changeable`. |
| `GET /appointments/month?month=yyyy-mm` | `{days: {date: count}}` without drafts and cancellations. |
| `GET /appointments/{id}` | The item plus the case summary: `patient_record, treatments, prescriptions, visits, can_change`. |
| `GET /doctors`, `GET /slots?date=&doctor=&ignore=` | Doctors with `kind`; the day's half-hour slots 09:00–17:30 with `available` (double-booking rule, chairs, past times). |
| `POST /appointments` | `{patient_id, doctor, date, time, treatment?, notes?, draft?}`. 409 if the slot is not free. `draft: true` keeps it without a slot (status `Draft`). |
| `POST /appointments/{id}/reschedule` | `{date, time, reason, doctor?}`; the reason is required except to book a draft. Keeps `rescheduled_from`. The patient is notified. |
| `POST /appointments/{id}/swap` | `{other_id}`: two booked appointments of the same day exchange times and chairs (409 if a doctor would clash). |
| `POST /appointments/{id}/cancel` | `{reason, refund_note?}`. A draft is deleted. The refund is only a note: no payment is made (online payments are excluded). |
| `POST /appointments/{id}/status` | `{status}`: Scheduled → Waiting (check-in) → Completed. |
| `GET /patients?q=` | `{items[], figures:{total, new_this_month, seen_today}}` |
| `POST /patients` | `{name, mobile, dob?, gender?, blood?, email?, address?, city?, allergy?, history?, visit_reason?, bp?, glucose?, insurance_company?, insurance_policy?, emergencyName?, emergencyMobile?, allow_duplicate?}` → 201. 409 when the same name and mobile exist, unless `allow_duplicate`. |
| `GET /patients/{id}` | Dashboard: `profile` (with vitals and insurance), `tiles`, `appointments {counts, items}`, `clinical {treatments, procedures, multi_visit}`, `consents`, `money`, `can_change`, and `accounts {billed, paid, balance, invoices, payments}` for roles that may see money (null otherwise). |

### Booking a visiting consultant — clinic `/api/clinic-app/consult/*`, consultant `/api/consultant/requests*`

One record in `consultant_bookings` (the web app's "Book a Consultant" collection). Statuses:
Requested → Viewed → (Proposed) → Confirmed → On the way / Running late / Arrived → Started → Completed;
Declined and Cancelled end it. A confirmed booking has a mirror appointment (chair "Consultation Room").
Fees are shown; nothing is charged (online payments are excluded).

| Call | Notes |
|---|---|
| `GET /api/clinic-app/consult/consultants?specialty=` | Visiting consultants (`fee, rating, experience, location, cases`) and the Dentor appointment `types` (standard, peak +₹200, clinic preferred +₹300). |
| `GET /api/clinic-app/consult/consultants/{id}`, `/{id}/slots?date=` | Profile with services and approved reviews; the consultant's free half-hours from their availability (`part`: Morning / Afternoon / Evening). |
| `POST /api/clinic-app/consult/requests` | `{patient_id, choice: own \| dentor, consultant_id?, date?, time?, dentor_type?, diagnosis, treatment, teeth[] (FDI), quadrants[] (1–4, full), history[], history_note, lab_findings, bp, glucose, notes, images[] (≤ 4 data URLs, 2 MB each), declaration: true}`. Own choice needs a free slot (409 otherwise); peak hours are 17:00–21:00. |
| `GET /api/clinic-app/consult/requests?scope=active\|past`, `/{id}` | The clinic's view includes `start_code` while the visit is confirmed and not started: the clinic reads it to the consultant at the chair. |
| `POST .../requests/{id}/accept-proposal` `{index}`, `.../cancel` `{reason}` | Take one of the consultant's offered times; cancel (also cancels the mirror appointment). |
| `GET /api/consultant/requests?scope=pending\|upcoming\|previous` | Bookings addressed to me plus the clinic's open Dentor-choice requests; `counts`. Opening one (`GET /{id}`) marks it Viewed and returns `image_data`. Never returns the start code. |
| `POST /api/consultant/requests/{id}/accept` `{date?, time?}` | Confirms; a Dentor standard request needs my date and time. The first consultant to accept an open request gets it (409 for the others). |
| `POST .../propose` `{slots: [{date, time}] (1–3), note}`, `.../decline` `{reason}` | Offer other times (from my availability); decline. |
| `POST .../track` `{status: On the way \| Running late \| Arrived, minutes}` | Shown to the clinic with a notification. |
| `POST .../start` `{code}` | The clinic's 4-digit code; 5 wrong tries lock it. The mirror appointment becomes Waiting. |
| `POST .../vitals` `{bp, glucose}`, `.../complete` `{treatment_provided, notes, next_date?, next_time?}`, `.../cancel` `{reason}` | Complete marks the appointment Completed; a next sitting is booked as a new confirmed visit. |
| `GET/PUT /api/consultant/availability` | `{weekly: {mon: {morning: [from, to], evening: [from, to]}, …}, custom: {date: [[from, to], …]}, agreed: true}`; a day in `custom` replaces the weekly hours ([] = not available). Default until set: Mon–Sat 09:00–12:00 and 14:00–18:00. `GET /api/consultant/my-slots?date=` gives my free half-hours. |

### Clinical work — `/api/clinic-app/*`

Labs and recall: front-desk roles write, everyone reads. Prescriptions, certificates and new medicines:
owner, administrator and dentist only.

| Call | Notes |
|---|---|
| `GET /labs?type=Blood\|X-ray\|Dental\|CBCT`, `GET /labs/{id}` | The clinic's labs with `counts` per kind and the form `options` (blood tests, X-ray types, dental work, CBCT indications, fields of view, complaint types). The directory itself is `/api/labs` (owner and administrators write). |
| `POST /lab-orders` | `{patient_id, lab_id, details, date?, notes?, attachments?, declaration: true}`; `details` by the lab's kind: Blood `{tests[], collection: Home Visit\|Lab}`, X-ray `{xray_type, teeth[], reason}`, Dental `{work, teeth[], material, shade_guide, primary_shade, stump_shade, cervical_shade, pontic_design, margin_design, implant_system, abutment}`, CBCT `{indications[], region, fov, consent: true}`. Creates a `lab_orders` record at stage "Order Received", due after the lab's turnaround. |
| `GET /lab-orders?scope=ongoing\|completed&q=`, `GET /lab-invoices` | Cases; invoices with `totals` and receipts. |
| `GET /lab-complaints?status=New\|In progress\|Resolved`, `POST /lab-complaints` `{order_id, type, description}`, `POST /lab-complaints/{id}/status` `{status}` | New → In progress → Resolved, never back. |
| `GET/POST /recall/templates`, `PATCH /recall/templates/{id}` | `{name, text}` (text ≤ 160 characters; `[Patient Name]`, `[Clinic Name]` are filled in). |
| `POST /recall` `{patient_id, message, due?, template_id?}`, `GET /recall?patient_id=` | Delivered as a patient-app notification; `delivered: false` and `channel: "Not sent: no patient app"` when the patient has no app account (no SMS / WhatsApp). |
| `GET /rx/catalog`, `POST /rx/drugs` | Drugs (category, type), combos, recent prescriptions to copy; add a medicine (409 if it exists). |
| `POST /prescriptions` `{patient_id, complaint, diagnosis, meds[{drug, dose, freq, days, unit, instruction}], advice, followUp?, note}`, `GET /prescriptions?patient_id=&q=` | Signed at once; the patient is notified. |
| `POST /certificates` `{patient_id, type: Fitness\|Referral, …}`, `GET /certificates?type=&q=`, `GET /certificates/{id}` | Fitness needs `findings` and `fitness`; referral needs `specialist` and `reason`. The single view adds the clinic's name and address. |
| `GET /tariff` | `{groups: [{category, items: [{name, code, price, duration, unit, description}]}]}` |

### Accounts — `/api/clinic-app/accounts/*` (owner, administrators, accountants)

| Call | Notes |
|---|---|
| `GET /summary?date_from=&date_to=` | `billed, collected, collected_change, expenses, expenses_change, net, categories[{category, amount, entries}], dentor{completed, pending, cancelled}`; changes are percentages against the same length of time before (null when there is nothing to compare). |
| `GET /expenses?category=&date_from=&date_to=` | Lines with `source`: Recorded (from `/api/expenses`), Lab order (paid lab work), Consultant visit (completed bookings' fees). Categories: Consultant, Duty Doctors, Purchase, Lab Orders, Miscellaneous, Staff, Domestic. |
| `POST /api/expenses` | `{category, amount, payee, description?, mode? (Cash, UPI, Card, Bank Transfer, Cheque), reference?, date?}` → `EXP-` code. Finance roles only (others 403). |
| `GET /invoices?…&q=`, `GET /invoices/{id}`, `GET /receipts?…` | The single invoice adds its receipts and the clinic's name and address. |
| `GET /statement?date_from=&date_to=` | Receipts in, expenses out, in date order with a running `balance`; `billed, received, paid_out, net`. |
| `GET /dentor?status=completed\|pending\|cancelled` | Consultant visits with their fee. |
| `GET /api/consultant/earnings/visits?status=all\|completed\|pending\|cancelled` | The consultant's visits booked by clinics, with `totals{completed, pending}`. |

The period of every call is at most about a year (400 days); a longer one is refused with 400.

### Engagement and support — `/api/engage/*` (Clinic app roles and consultants)

| Call | Notes |
|---|---|
| `GET /tickets?scope=open\|closed`, `POST /tickets` `{type, subject, description, attachment?}`, `GET /tickets/{id}`, `POST /tickets/{id}/reply` `{text}` | Tickets go to Dentor support (`GET /api/platform/tickets`, `POST /api/platform/tickets/{id}/answer` `{text, status: In progress\|Resolved}` for the Super Admin, which notifies the person). Codes `DT-1001…`. |
| `GET /chats`, `POST /chats` `{consultant_id?, subject, text}`, `GET /chats/{id}`, `POST /chats/{id}/messages` `{text}` | Clinic ↔ consultant threads; `side` says which side the caller is; opening marks it read; the other side is notified. |
| `GET/POST /offers`, `PATCH /offers/{id}`, `GET /offers/{id}` (owner, administrators) | `{title, kind: treatment\|general, treatment, category, discount_type: percentage\|amount, value, valid_till, send: now\|later, send_at}`; patients with the app are notified. Patients: `GET /api/patient/offers`, `POST /api/patient/offers/{id}/view`; booking with `offer_id` counts a booking. |
| `POST /ratings` `{booking_id, stars, recommend, aspects[], text}`, `GET /reviews/mine` | After a completed consultant visit; once per side. |
| `GET/PUT /prefs` | `{mute, sound, vibrate, muted_minutes, sleep{enabled, start, end}}`; phone alerts are held back while quiet (in-app notifications are always kept). |
| `GET /wallet` | `{code, points, tier, per_referral, transactions[]}`; sign-up's `profile.referral_code` credits the referrer on approval. |
| `GET /plans`, `POST /plans/request` `{plan}` | Plans are requested from Dentor (a Subscription ticket), not bought. |
| `GET /products?q=&category=`, `POST /products/{id}/enquire` `{quantity, note}` | Store catalogue; an enquiry is a Store enquiry ticket. |
| `GET/POST /inventory`, `POST /inventory/{id}/adjust` `{change, reason, case}` | Consultants only: their kit, low stock, cases today, history. |
| `GET /jobs?kind=hiring\|seeking&mine=`, `POST /jobs`, `POST /jobs/{id}/close` | Across Dentor; hiring posts by clinic owners and administrators. |

## Demo logins (development database only)

| App | Login |
|---|---|
| Patient | mobile `9876543210`, password `Patient@2026` (Ravi Kumar, DEN-1001). New sign-ups get the OTP back as `dev_otp`. |
| Consultant | `kumar@dentor.in` / `Consultant@2026` (Dr. Kumar) |
| Clinic Owner | `owner@dentor.in` / `Owner@2026` |

## Real response samples

Captured from the development server (lists trimmed to their first item).

### Patient app samples (demo patient 9876543210 / Patient@2026)

#### `POST /api/patient/auth/login` — every auth response has this shape
```json
{
 "access_token": "<jwt>",
 "refresh_token": "<opaque>",
 "token_type": "bearer",
 "account": {
  "id": "6acdb6e62f13b19fd1aab942",
  "name": "Ravi Kumar",
  "mobile": "9876543210",
  "email": ""
 },
 "profiles": [
  {
   "patient_id": "6acdb6e52f13b19fd1aab88a",
   "clinic_id": "6acdb6e22f13b19fd1aab887",
   "name": "Ravi Kumar",
   "code": "DEN-1001",
   "age": 36,
   "gender": "Male",
   "photo": "",
   "clinic_name": "DENTOR Dental Clinic",
   "clinic_city": "Manaparai"
  }
 ],
 "profile": {
  "patient_id": "6acdb6e52f13b19fd1aab88a",
  "clinic_id": "6acdb6e22f13b19fd1aab887",
  "name": "Ravi Kumar",
  "code": "DEN-1001",
  "age": 36,
  "gender": "Male",
  "photo": "",
  "clinic_name": "DENTOR Dental Clinic",
  "clinic_city": "Manaparai"
 }
}
```

#### `GET /api/patient/me`
```json
{
 "account": {
  "id": "6acdb6e62f13b19fd1aab942",
  "name": "Ravi Kumar",
  "mobile": "9876543210",
  "email": ""
 },
 "profile": {
  "id": "6acdb6e52f13b19fd1aab88a",
  "code": "DEN-1001",
  "mobile": "9876543210",
  "status": "Active",
  "risk": "Low",
  "doctor": "Dr. Kumar",
  "treatment": "Root Canal",
  "lastVisit": "2026-09-08",
  "relation": "",
  "name": "Ravi Kumar",
  "email": "",
  "address": "",
  "city": "Manaparai",
  "age": 36,
  "gender": "Male",
  "blood": "B+",
  "emergencyName": "",
  "emergencyMobile": "",
  "photo": "",
  "allergy": "Penicillin",
  "history": "Diabetes Mellitus",
  "dob": ""
 },
 "clinic": {
  "id": "6acdb6e22f13b19fd1aab887",
  "name": "DENTOR Dental Clinic",
  "code": "CL-001",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "city": "Manaparai",
  "online_booking": true
 },
 "profiles": [
  {
   "patient_id": "6acdb6e52f13b19fd1aab88a",
   "clinic_id": "6acdb6e22f13b19fd1aab887",
   "name": "Ravi Kumar",
   "code": "DEN-1001",
   "age": 36,
   "gender": "Male",
   "photo": "",
   "clinic_name": "DENTOR Dental Clinic",
   "clinic_city": "Manaparai"
  }
 ]
}
```

#### `GET /api/patient/home`
```json
{
 "profile": {
  "id": "6acdb6e52f13b19fd1aab88a",
  "code": "DEN-1001",
  "mobile": "9876543210",
  "status": "Active",
  "risk": "Low",
  "doctor": "Dr. Kumar",
  "treatment": "Root Canal",
  "lastVisit": "2026-09-08",
  "relation": "",
  "name": "Ravi Kumar",
  "email": "",
  "address": "",
  "city": "Manaparai",
  "age": 36,
  "gender": "Male",
  "blood": "B+",
  "emergencyName": "",
  "emergencyMobile": "",
  "photo": "",
  "allergy": "Penicillin",
  "history": "Diabetes Mellitus",
  "dob": ""
 },
 "clinic": {
  "id": "6acdb6e22f13b19fd1aab887",
  "name": "DENTOR Dental Clinic",
  "code": "CL-001",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "city": "Manaparai",
  "online_booking": true
 },
 "next_appointment": {
  "id": "6acdb6e52f13b19fd1aab89b",
  "code": "APT-4101",
  "patientCode": "DEN-1001",
  "patient": "Ravi Kumar",
  "date": "2026-10-13",
  "time": "09:30",
  "treatment": "Root Canal",
  "doctor": "Dr. Kumar",
  "chair": "Chair 01",
  "duration": "30 min",
  "status": "Scheduled",
  "notes": "",
  "created_at": "2026-10-13T04:43:17.386310+00:00",
  "updated_at": "2026-10-13T04:43:17.386312+00:00",
  "date_label": "13 Oct 2026",
  "time_label": "9:30 AM",
  "can_cancel": false,
  "can_reschedule": false,
  "upcoming": true
 },
 "upcoming_count": 1,
 "outstanding": 0.0,
 "unread_notifications": 0,
 "unread_chat": 0,
 "pending_consents": 1,
 "prescriptions": 1,
 "last_prescription": {
  "id": "6acdb6e52f13b19fd1aab930",
  "doctor": "Dr. Kumar",
  "date": "2026-10-06"
 },
 "banner": null
}
```

#### `GET /api/patient/doctors`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab893",
   "name": "Dr. Anitha",
   "specialty": "Prosthodontics & Periodontics",
   "type": "In-house",
   "credentials": "BDS, MDS",
   "experience": 9,
   "availability": "Mon–Sat · 9 AM–5 PM",
   "fee": 500,
   "rating": 4.8
  },
  "… 8 more"
 ]
}
```

#### `GET /api/patient/slots?date=2026-10-16&doctor=Dr.%20Kumar` — 18 half-hour slots 09:00–17:30
```json
{
 "date": "2026-10-16",
 "doctor": "Dr. Kumar",
 "slots": [
  {
   "time": "09:00",
   "available": true,
   "label": "9:00 AM"
  },
  "… 17 more"
 ]
}
```

#### `GET /api/patient/appointments?scope=all` — scope=upcoming|past|all
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab89b",
   "code": "APT-4101",
   "patientCode": "DEN-1001",
   "patient": "Ravi Kumar",
   "date": "2026-10-13",
   "time": "09:30",
   "treatment": "Root Canal",
   "doctor": "Dr. Kumar",
   "chair": "Chair 01",
   "duration": "30 min",
   "status": "Scheduled",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.386310+00:00",
   "updated_at": "2026-10-13T04:43:17.386312+00:00",
   "date_label": "13 Oct 2026",
   "time_label": "9:30 AM",
   "can_cancel": false,
   "can_reschedule": false,
   "upcoming": true
  }
 ],
 "today": "2026-10-13"
}
```

#### `GET /api/patient/records`
```json
{
 "treatments": [
  {
   "id": "6acdb6e52f13b19fd1aab934",
   "patientId": "DEN-1001",
   "name": "Zirconia Crown",
   "tooth": "46",
   "doctor": "Dr. Kumar",
   "date": "2026-10-27",
   "status": "Planned",
   "cost": 8500,
   "notes": "After root canal completion.",
   "created_at": "2026-10-13T04:43:17.413604+00:00",
   "updated_at": "2026-10-13T04:43:17.413606+00:00"
  },
  "… 2 more"
 ],
 "procedures": [
  {
   "id": "6acdb6e52f13b19fd1aab936",
   "patientId": "DEN-1001",
   "name": "Access opening & BMP",
   "tooth": "46",
   "doctor": "Dr. Kumar",
   "date": "2026-10-06",
   "status": "Completed",
   "cost": 0,
   "notes": "Working length determined.",
   "created_at": "2026-10-13T04:43:17.414832+00:00",
   "updated_at": "2026-10-13T04:43:17.414834+00:00"
  },
  "… 1 more"
 ],
 "timeline": [
  {
   "id": "6acdb6e52f13b19fd1aab93d",
   "patientId": "DEN-1001",
   "period": "upcoming",
   "name": "Zirconia Crown",
   "date": "2026-10-27",
   "tooth": "46",
   "doctor": "Dr. Kumar",
   "status": "Planned",
   "price": 8500,
   "duration": "45 min",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.417234+00:00",
   "updated_at": "2026-10-13T04:43:17.417235+00:00"
  },
  "… 2 more"
 ],
 "teeth": {
  "46": {
   "condition": "Root Canal",
   "note": "RCT in progress"
  },
  "16": {
   "condition": "Filled",
   "note": "Composite"
  },
  "38": {
   "condition": "Missing",
   "note": "Extracted 2023"
  }
 },
 "lab_orders": [
  {
   "id": "6acdb6e52f13b19fd1aab8f0",
   "code": "LAB-2680",
   "caseType": "Zirconia Crown",
   "teeth": "46",
   "stage": "Quality Check",
   "status": "In Progress",
   "due": "2026-10-14"
  }
 ]
}
```

#### `GET /api/patient/prescriptions`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab930",
   "code": "RX-0901",
   "patient": "Ravi Kumar",
   "patientCode": "DEN-1001",
   "age": 36,
   "gender": "Male",
   "allergy": "Penicillin",
   "date": "2026-10-06",
   "doctor": "Dr. Kumar",
   "complaint": "Pain in lower right molar",
   "diagnosis": "Irreversible pulpitis · 46",
   "note": "Root canal treatment started.",
   "meds": [
    {
     "drug": "Azithromycin 500mg",
     "dose": "1 tablet",
     "freq": "OD",
     "days": "3",
     "unit": "Days",
     "instruction": "After food"
    },
    "… 2 more"
   ],
   "advice": "Avoid chewing on the right side. Warm saline rinses twice a day.",
   "followUp": "2026-10-20",
   "status": "Signed",
   "created_at": "2026-10-13T04:43:17.412345+00:00",
   "updated_at": "2026-10-13T04:43:17.412346+00:00"
  }
 ]
}
```

#### `GET /api/patient/reports`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab93f",
   "name": "IOPA 46 (sample)",
   "category": "X-ray",
   "size": 95,
   "created_at": "2026-10-13T04:43:17.419620+00:00",
   "mime": "image/png",
   "is_image": true,
   "mine": false
  }
 ]
}
```

#### `GET /api/patient/consents`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab939",
   "patientId": "DEN-1001",
   "title": "Anaesthesia Consent",
   "date": "2026-10-13",
   "status": "Pending",
   "notes": "Required before the next root canal sitting.",
   "created_at": "2026-10-13T04:43:17.416046+00:00",
   "updated_at": "2026-10-13T04:43:17.416047+00:00"
  },
  "… 1 more"
 ]
}
```

#### `GET /api/patient/invoices`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab8a3",
   "number": "CLN-INV-2848",
   "source": "Clinic",
   "date": "2026-10-11",
   "patientCode": "DEN-1001",
   "patient": "Ravi Kumar",
   "treatment": "Root Canal Treatment",
   "doctor": "Dr. Kumar",
   "items": [
    {
     "name": "Root Canal Treatment",
     "qty": 1,
     "price": 12500,
     "tax": 0
    }
   ],
   "subtotal": 12500,
   "discount": 0,
   "tax": 0,
   "total": 12500,
   "paid": 12500,
   "balance": 0,
   "status": "Paid",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.388052+00:00",
   "updated_at": "2026-10-13T04:43:17.388056+00:00"
  }
 ],
 "payments": [
  {
   "id": "6acdb6e52f13b19fd1aab8ab",
   "receipt": "DEN-RCP-1900",
   "invoice": "CLN-INV-2848",
   "invoice_id": null,
   "patient": "Ravi Kumar",
   "patientCode": "DEN-1001",
   "amount": 12500,
   "mode": "UPI",
   "reference": "RCT-100200",
   "date": "2026-10-11",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.388063+00:00"
  }
 ],
 "summary": {
  "billed": 12500.0,
  "paid": 12500.0,
  "outstanding": 0.0
 }
}
```

#### `GET /api/patient/invoices/6acdb6e52f13b19fd1aab8a3` — detail adds payments[] and clinic
```json
{
 "id": "6acdb6e52f13b19fd1aab8a3",
 "number": "CLN-INV-2848",
 "source": "Clinic",
 "date": "2026-10-11",
 "patientCode": "DEN-1001",
 "patient": "Ravi Kumar",
 "treatment": "Root Canal Treatment",
 "doctor": "Dr. Kumar",
 "items": [
  {
   "name": "Root Canal Treatment",
   "qty": 1,
   "price": 12500,
   "tax": 0
  }
 ],
 "subtotal": 12500,
 "discount": 0,
 "tax": 0,
 "total": 12500,
 "paid": 12500,
 "balance": 0,
 "status": "Paid",
 "notes": "",
 "created_at": "2026-10-13T04:43:17.388052+00:00",
 "updated_at": "2026-10-13T04:43:17.388056+00:00",
 "payments": [
  {
   "id": "6acdb6e52f13b19fd1aab8ab",
   "receipt": "DEN-RCP-1900",
   "invoice": "CLN-INV-2848",
   "invoice_id": null,
   "patient": "Ravi Kumar",
   "patientCode": "DEN-1001",
   "amount": 12500,
   "mode": "UPI",
   "reference": "RCT-100200",
   "date": "2026-10-11",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.388063+00:00"
  }
 ],
 "clinic": {
  "id": "6acdb6e22f13b19fd1aab887",
  "name": "DENTOR Dental Clinic",
  "code": "CL-001",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "city": "Manaparai",
  "online_booking": true
 }
}
```

#### `GET /api/patient/chat`
```json
{
 "messages": [],
 "clinic": {
  "id": "6acdb6e22f13b19fd1aab887",
  "name": "DENTOR Dental Clinic",
  "code": "CL-001",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "city": "Manaparai",
  "online_booking": true
 },
 "status": "Open"
}
```

#### `GET /api/patient/reviews`
```json
{
 "items": []
}
```

#### `GET /api/patient/notifications`
```json
{
 "items": [],
 "unread": 0
}
```

#### `GET /api/patient/profiles`
```json
{
 "items": [
  {
   "patient_id": "6acdb6e52f13b19fd1aab88a",
   "clinic_id": "6acdb6e22f13b19fd1aab887",
   "name": "Ravi Kumar",
   "code": "DEN-1001",
   "age": 36,
   "gender": "Male",
   "photo": "",
   "clinic_name": "DENTOR Dental Clinic",
   "clinic_city": "Manaparai"
  }
 ],
 "active": {
  "pid": "6acdb6e52f13b19fd1aab88a",
  "cid": "6acdb6e22f13b19fd1aab887"
 }
}
```

#### `GET /api/patient/clinics`
```json
{
 "items": [
  {
   "id": "6acdb6e22f13b19fd1aab887",
   "name": "DENTOR Dental Clinic",
   "city": "Manaparai",
   "code": "CL-001",
   "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306"
  }
 ]
}
```

### Consultant app samples (kumar@dentor.in / Consultant@2026)

#### `POST /api/auth/login` with `app: "consultant"` (owner app sends `app: "owner"`)
```json
{
 "access_token": "<jwt>",
 "refresh_token": "<opaque>",
 "token_type": "bearer",
 "user": {
  "id": "6acdb6e62f13b19fd1aab941",
  "name": "Dr. Kumar",
  "email": "kumar@dentor.in",
  "role": "Consultant",
  "department": "Clinical",
  "consultant_id": "6acdb6e52f13b19fd1aab892",
  "status": "Active",
  "created_at": "2026-10-13T04:43:18.019571+00:00",
  "updated_at": "2026-10-13T04:43:18.019584+00:00",
  "created_by": "seed",
  "clinic_id": "6acdb6e22f13b19fd1aab887",
  "clinic": {
   "id": "6acdb6e22f13b19fd1aab887",
   "name": "DENTOR Dental Clinic",
   "code": "CL-001"
  }
 }
}
```

#### `GET /api/consultant/me`
```json
{
 "profile": {
  "id": "6acdb6e52f13b19fd1aab892",
  "code": "DOC-101",
  "name": "Dr. Kumar",
  "specialty": "General & Restorative Dentistry",
  "type": "In-house",
  "credentials": "BDS, MDS",
  "experience": 12,
  "availability": "Mon–Sat · 9 AM–5 PM",
  "location": "Manaparai",
  "fee": 500,
  "rating": 4.8,
  "about": "",
  "phone": "",
  "email": "kumar@dentor.in",
  "login_name": "Dr. Kumar"
 },
 "clinic": {
  "name": "DENTOR Dental Clinic",
  "phone": "+91 73392 99339",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306"
 }
}
```

#### `GET /api/consultant/dashboard` — date defaults to today
```json
{
 "date": "2026-10-13",
 "date_label": "13 Oct 2026",
 "profile": {
  "id": "6acdb6e52f13b19fd1aab892",
  "code": "DOC-101",
  "name": "Dr. Kumar",
  "specialty": "General & Restorative Dentistry",
  "type": "In-house",
  "credentials": "BDS, MDS",
  "experience": 12,
  "availability": "Mon–Sat · 9 AM–5 PM",
  "location": "Manaparai",
  "fee": 500,
  "rating": 4.8,
  "about": "",
  "phone": "",
  "email": "kumar@dentor.in",
  "login_name": "Dr. Kumar"
 },
 "total": 2,
 "by_status": {
  "Scheduled": 1,
  "Waiting": 0,
  "Completed": 1,
  "Cancelled": 0
 },
 "next": {
  "id": "6acdb6e52f13b19fd1aab89b",
  "code": "APT-4101",
  "patientCode": "DEN-1001",
  "patient": "Ravi Kumar",
  "date": "2026-10-13",
  "time": "09:30",
  "treatment": "Root Canal",
  "doctor": "Dr. Kumar",
  "chair": "Chair 01",
  "duration": "30 min",
  "status": "Scheduled",
  "notes": "",
  "created_at": "2026-10-13T04:43:17.386310+00:00",
  "updated_at": "2026-10-13T04:43:17.386312+00:00",
  "date_label": "13 Oct 2026",
  "time_label": "9:30 AM"
 },
 "today": [
  {
   "id": "6acdb6e52f13b19fd1aab89b",
   "code": "APT-4101",
   "patientCode": "DEN-1001",
   "patient": "Ravi Kumar",
   "date": "2026-10-13",
   "time": "09:30",
   "treatment": "Root Canal",
   "doctor": "Dr. Kumar",
   "chair": "Chair 01",
   "duration": "30 min",
   "status": "Scheduled",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.386310+00:00",
   "updated_at": "2026-10-13T04:43:17.386312+00:00",
   "date_label": "13 Oct 2026",
   "time_label": "9:30 AM"
  },
  "… 1 more"
 ],
 "upcoming": [
  {
   "id": "6acdb6e52f13b19fd1aab8a0",
   "code": "APT-4106",
   "patientCode": "DEN-1006",
   "patient": "Joseph Antony",
   "date": "2026-10-14",
   "time": "10:00",
   "treatment": "Extraction Review",
   "doctor": "Dr. Kumar",
   "chair": "Chair 02",
   "duration": "30 min",
   "status": "Scheduled",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.386332+00:00",
   "updated_at": "2026-10-13T04:43:17.386333+00:00",
   "date_label": "14 Oct 2026",
   "time_label": "10:00 AM"
  }
 ],
 "patients": 3
}
```

#### `GET /api/consultant/appointments?date=2026-10-13` — filters: date | date_from+date_to | status
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab89b",
   "code": "APT-4101",
   "patientCode": "DEN-1001",
   "patient": "Ravi Kumar",
   "date": "2026-10-13",
   "time": "09:30",
   "treatment": "Root Canal",
   "doctor": "Dr. Kumar",
   "chair": "Chair 01",
   "duration": "30 min",
   "status": "Scheduled",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.386310+00:00",
   "updated_at": "2026-10-13T04:43:17.386312+00:00",
   "date_label": "13 Oct 2026",
   "time_label": "9:30 AM"
  },
  "… 1 more"
 ]
}
```

#### `GET /api/consultant/patients` — q searches name/code/mobile
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab88c",
   "code": "DEN-1003",
   "name": "Anjali Devi",
   "age": 29,
   "gender": "Female",
   "mobile": "9876543212",
   "blood": "A+",
   "allergy": "",
   "history": "",
   "risk": "Low",
   "treatment": "Orthodontics",
   "status": "Active",
   "lastVisit": "2026-09-07",
   "photo": ""
  },
  "… 2 more"
 ],
 "total": 3
}
```

#### `GET /api/consultant/patients/6acdb6e52f13b19fd1aab88c`
```json
{
 "patient": {
  "id": "6acdb6e52f13b19fd1aab88c",
  "code": "DEN-1003",
  "name": "Anjali Devi",
  "age": 29,
  "gender": "Female",
  "mobile": "9876543212",
  "blood": "A+",
  "allergy": "",
  "history": "",
  "risk": "Low",
  "treatment": "Orthodontics",
  "status": "Active",
  "lastVisit": "2026-09-07",
  "photo": ""
 },
 "appointments": [
  {
   "id": "6acdb6e52f13b19fd1aab89e",
   "code": "APT-4104",
   "patientCode": "DEN-1003",
   "patient": "Anjali Devi",
   "date": "2026-10-13",
   "time": "12:30",
   "treatment": "Ortho Adjustment",
   "doctor": "Dr. Kumar",
   "chair": "Chair 01",
   "duration": "30 min",
   "status": "Completed",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.386324+00:00",
   "updated_at": "2026-10-13T04:43:17.386325+00:00",
   "date_label": "13 Oct 2026",
   "time_label": "12:30 PM"
  }
 ],
 "treatments": [
  {
   "id": "6acdb6e52f13b19fd1aab935",
   "patientId": "DEN-1003",
   "name": "Orthodontic Treatment",
   "tooth": "Both arches",
   "doctor": "Dr. Kumar",
   "date": "2026-06-15",
   "status": "In Progress",
   "cost": 45000,
   "notes": "Monthly adjustments.",
   "created_at": "2026-10-13T04:43:17.413609+00:00",
   "updated_at": "2026-10-13T04:43:17.413610+00:00"
  }
 ],
 "procedures": [],
 "prescriptions": [
  {
   "id": "6acdb6e52f13b19fd1aab931",
   "code": "RX-0902",
   "patient": "Anjali Devi",
   "patientCode": "DEN-1003",
   "age": 29,
   "gender": "Female",
   "allergy": "",
   "date": "2026-10-10",
   "doctor": "Dr. Kumar",
   "complaint": "Soreness after wire adjustment",
   "diagnosis": "Orthodontic adjustment discomfort",
   "note": "",
   "meds": [
    {
     "drug": "Ketorol DT",
     "dose": "1 tablet",
     "freq": "SOS",
     "days": "3",
     "unit": "Days",
     "instruction": "After food"
    }
   ],
   "advice": "Use orthodontic wax over the bracket if it rubs.",
   "followUp": "2026-11-09",
   "status": "Signed",
   "created_at": "2026-10-13T04:43:17.412351+00:00",
   "updated_at": "2026-10-13T04:43:17.412352+00:00"
  }
 ],
 "consents": [
  {
   "id": "6acdb6e52f13b19fd1aab93a",
   "patientId": "DEN-1003",
   "title": "Orthodontic Consent",
   "date": "2026-06-15",
   "status": "Signed",
   "notes": "",
   "created_at": "2026-10-13T04:43:17.416049+00:00",
   "updated_at": "2026-10-13T04:43:17.416051+00:00"
  }
 ],
 "files": [],
 "teeth": {}
}
```

#### `GET /api/consultant/prescriptions`
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab931",
   "code": "RX-0902",
   "patient": "Anjali Devi",
   "patientCode": "DEN-1003",
   "age": 29,
   "gender": "Female",
   "allergy": "",
   "date": "2026-10-10",
   "doctor": "Dr. Kumar",
   "complaint": "Soreness after wire adjustment",
   "diagnosis": "Orthodontic adjustment discomfort",
   "note": "",
   "meds": [
    {
     "drug": "Ketorol DT",
     "dose": "1 tablet",
     "freq": "SOS",
     "days": "3",
     "unit": "Days",
     "instruction": "After food"
    }
   ],
   "advice": "Use orthodontic wax over the bracket if it rubs.",
   "followUp": "2026-11-09",
   "status": "Signed",
   "created_at": "2026-10-13T04:43:17.412351+00:00",
   "updated_at": "2026-10-13T04:43:17.412352+00:00"
  },
  "… 1 more"
 ]
}
```

#### `GET /api/consultant/bookings`
```json
{
 "items": []
}
```

#### `GET /api/consultant/earnings` — defaults to this month
```json
{
 "from": "2026-10-01",
 "to": "2026-10-13",
 "billed": 22475.0,
 "collected": 12500.0,
 "outstanding": 9975.0,
 "invoices": 2,
 "completed_visits": 1,
 "by_treatment": [
  {
   "treatment": "Root Canal Treatment",
   "amount": 12500.0
  },
  "… 1 more"
 ],
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab8a3",
   "number": "CLN-INV-2848",
   "date": "2026-10-11",
   "date_label": "11 Oct 2026",
   "patient": "Ravi Kumar",
   "treatment": "Root Canal Treatment",
   "total": 12500,
   "paid": 12500,
   "balance": 0,
   "status": "Paid"
  },
  "… 1 more"
 ]
}
```

#### `GET /api/consultant/catalog`
```json
{
 "medicines": [
  {
   "name": "Amoxicillin 500mg",
   "form": "Tablet",
   "in_stock": true
  },
  "… 9 more"
 ],
 "treatments": [
  {
   "name": "Dental Consultation",
   "category": "Consultation",
   "price": 500,
   "duration": 20
  },
  "… 7 more"
 ]
}
```

#### `GET /api/notifications` — same shape for owner/consultant
```json
{
 "items": [],
 "unread": 0
}
```

### Clinic Owner app samples (owner@dentor.in / Owner@2026)

#### `GET /api/owner/overview` — date_from/date_to optional (default: this month to date)
```json
{
 "from": "2026-10-01",
 "to": "2026-10-13",
 "today": "2026-10-13",
 "billed": 88450.0,
 "collected": 54925.0,
 "outstanding": 33525.0,
 "invoices": 8,
 "average_invoice": 11056,
 "appointments": 6,
 "appointments_by_status": {
  "Scheduled": 3,
  "Waiting": 1,
  "Completed": 2
 },
 "patients_total": 8,
 "patients_new": 8,
 "series": [
  {
   "date": "2026-10-01",
   "label": "01 Oct",
   "collected": 0.0,
   "appointments": 0
  },
  "… 12 more"
 ],
 "today_summary": {
  "appointments": 5,
  "waiting": 1,
  "completed": 1,
  "collected": 0
 }
}
```

#### `GET /api/owner/finance`
```json
{
 "from": "2026-10-01",
 "to": "2026-10-13",
 "billed": 88450.0,
 "collected": 54925.0,
 "by_mode": [
  {
   "name": "Card",
   "amount": 29925.0,
   "count": 2
  },
  "… 2 more"
 ],
 "by_doctor": [
  {
   "name": "Dr. Anitha",
   "amount": 35210.0,
   "count": 3
  },
  "… 2 more"
 ],
 "by_treatment": [
  {
   "name": "Zirconia Crown",
   "amount": 23100.0,
   "count": 1
  },
  "… 7 more"
 ],
 "outstanding_total": 33525.0,
 "outstanding": [
  {
   "id": "6acdb6e52f13b19fd1aab8a8",
   "number": "DEN-INV-2843",
   "date": "2026-10-08",
   "date_label": "08 Oct 2026",
   "patient": "Joseph Antony",
   "doctor": "Dr. Kumar",
   "total": 9975,
   "balance": 9975,
   "status": "Pending"
  },
  "… 3 more"
 ],
 "recent_payments": [
  {
   "id": "6acdb6e52f13b19fd1aab8ab",
   "receipt": "DEN-RCP-1900",
   "date": "2026-10-11",
   "date_label": "11 Oct 2026",
   "patient": "Ravi Kumar",
   "mode": "UPI",
   "amount": 12500,
   "invoice": "CLN-INV-2848"
  },
  "… 5 more"
 ]
}
```

#### `GET /api/owner/operations`
```json
{
 "today": "2026-10-13",
 "appointments": [
  {
   "id": "6acdb6e52f13b19fd1aab89b",
   "time": "09:30",
   "time_label": "9:30 AM",
   "patient": "Ravi Kumar",
   "treatment": "Root Canal",
   "doctor": "Dr. Kumar",
   "chair": "Chair 01",
   "status": "Scheduled",
   "source": ""
  },
  "… 4 more"
 ],
 "lab": {
  "by_status": {
   "In Progress": 2,
   "Ready": 1,
   "Delayed": 1,
   "Delivered": 1
  },
  "attention": [
   {
    "id": "6acdb6e52f13b19fd1aab8f2",
    "code": "LAB-2682",
    "patient": "Anjali Devi",
    "caseType": "Clear Retainer",
    "lab": "OrthoFab",
    "due": "2026-10-13",
    "due_label": "13 Oct 2026",
    "status": "Ready",
    "stage": "Dispatch"
   },
   "… 1 more"
  ]
 },
 "pharmacy_low": [
  {
   "id": "6acdb6e52f13b19fd1aab8ef",
   "name": "Ibugesic Plus Syrup",
   "code": "MED-1010",
   "stock": 8,
   "reorder": 12,
   "out": false
  },
  "… 2 more"
 ],
 "inventory_low": [
  {
   "id": "6acdb6e52f13b19fd1aab8f9",
   "name": "Face Masks 3-Ply",
   "code": "INV-105",
   "stock": 0,
   "reorder": 20,
   "out": true
  },
  "… 1 more"
 ],
 "leads": {
  "total": 7,
  "by_stage": {
   "New": 2,
   "Contacted": 2,
   "Qualified": 1,
   "Consultation": 1,
   "Converted": 1
  },
  "pipeline_value": 604000.0
 },
 "reviews": {
  "total": 12,
  "pending": 5,
  "average": 4.2
 }
}
```

#### `GET /api/owner/team`
```json
{
 "from": "2026-10-01",
 "to": "2026-10-13",
 "doctors": [
  {
   "id": "6acdb6e52f13b19fd1aab893",
   "name": "Dr. Anitha",
   "code": "DOC-102",
   "specialty": "Prosthodontics & Periodontics",
   "type": "In-house",
   "status": "Active",
   "appointments": 2,
   "completed": 1,
   "billed": 35210.0,
   "collected": 31600.0
  },
  "… 8 more"
 ],
 "staff": [
  {
   "id": "6acdb6e52f13b19fd1aab923",
   "code": "EMP-101",
   "name": "Dr. Admin",
   "role": "Administrator",
   "department": "Administration",
   "mobile": "9733929933",
   "status": "Active",
   "employment": "Full Time"
  },
  "… 6 more"
 ]
}
```

#### `GET /api/owner/clinic`
```json
{
 "clinic": {
  "id": "6acdb6e22f13b19fd1aab887",
  "code": "CL-001",
  "name": "DENTOR Dental Clinic",
  "city": "Manaparai",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "plan": "Standard",
  "status": "Active",
  "is_demo": true,
  "created_at": "2026-10-13T04:43:14.779965+00:00",
  "updated_at": "2026-10-13T04:43:14.779965+00:00"
 },
 "settings": {
  "clinicName": "DENTOR Dental Clinic",
  "legalName": "Thiru.Pathy Dento Facial Centre",
  "phone": "+91 73392 99339",
  "email": "admin@dentor.in",
  "address": "No. 6, Ponnagar, Dindigul Road, Manaparai – 621306",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "dateFormat": "DD/MM/YYYY",
  "gstin": "33ABCDE1234F1Z5",
  "registration": "TNDC-TPDFC-2026",
  "invoicePrefix": "DEN-INV",
  "receiptPrefix": "DEN-RCP",
  "toothNumbering": "FDI",
  "apptDuration": "30",
  "financialLock": true,
  "apptReminder24": true,
  "lowStockAlert": true,
  "notifyWhatsApp": true,
  "notifySms": true,
  "partialPayments": true,
  "consentRequired": true,
  "allergyAlert": true,
  "smartQueue": true,
  "onlineBooking": true,
  "doubleBooking": false,
  "twoFactor": false,
  "sessionTimeout": true,
  "strongPassword": true
 }
}
```

#### `GET /api/clinic/users` — login accounts of the clinic
```json
{
 "items": [
  {
   "id": "6acdb6e52f13b19fd1aab889",
   "name": "Dr. Admin",
   "email": "admin@dentor.in",
   "role": "Administrator",
   "status": "Active",
   "consultant_id": "",
   "consultant_name": "",
   "created_at": "2026-10-13T04:43:17.380773+00:00"
  },
  "… 2 more"
 ],
 "roles": [
  "Clinic Owner",
  "… 6 more"
 ]
}
```

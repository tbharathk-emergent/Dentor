# External integrations: what to configure and how to test it

For the person who connects Dentor to its outside services and tests them on real phones. Status on
15 October 2026: **none of the four services below is connected yet.** The code for each is in
place and tested locally with stand-ins; what is missing is an account, credentials, and a small
adapter for three of them. Nothing here requires a payment service: online payments are excluded
from Dentor, and no test below may move real money.

| Service | Used for | Code side | Missing |
| --- | --- | --- | --- |
| Email | 4-digit codes for password reset (staff, patients) and staff sign-up; application approved / rejected | done | an email service and its adapter |
| SMS | 6-digit codes for patient sign-up, code login, password reset by mobile, "Fetch" a record | done | an SMS gateway with an Indian DLT template, and its adapter |
| Push | phone alerts for the notifications every app already shows | API done; apps need the Firebase SDK | Firebase project, APNs key, SDK in the apps, adapter |
| Fingerprint / Face ID | signing in again on the same phone | done | testing on physical phones |
| Android signing | Play Store releases | build set up to read an upload key | Play Console account, upload key (section 5) |
| Apple signing | App Store, TestFlight, physical iPhones | projects ready | the owning Apple team, its Team ID, distribution signing (section 6) |

All settings below go into the API's environment (`backend/.env` on the server, or the service's
environment), never into the repository. `backend/.env.example` lists them with empty values.

## Before you start

- Do every test on a **staging** API with its own database (`DB_NAME=dentor_staging`, a copy or a
  fresh install), not on production. Production changes need the owner's go-ahead.
- Use `DENTOR_ENV=production` on staging: it switches off development shortcuts (codes are then
  never shown in the app or the API's answers), so staging behaves like production.
- Use mailboxes and phone numbers that belong to the testers.
- The adapters below must answer within 10 seconds; the API gives up after that and tells the user
  the code could not be sent.

## 1. Email

### Settings

| Variable | Value |
| --- | --- |
| `EMAIL_PROVIDER` | `webhook` (production refuses `console`; empty refuses email codes) |
| `EMAIL_WEBHOOK_URL` | HTTPS address of your adapter |
| `EMAIL_WEBHOOK_TOKEN` | a long random string, also configured in the adapter |
| `OTP_TTL_SECONDS` | optional, default `300` (codes last 5 minutes) |

### What the API sends

`POST <EMAIL_WEBHOOK_URL>`, header `Authorization: Bearer <EMAIL_WEBHOOK_TOKEN>`,
`Content-Type: application/json`:

```json
{"to": "person@example.com", "subject": "Your Dentor password reset code", "text": "4821 is your Dentor code. It expires in 5 minutes. If you did not ask for it, ignore this email.", "purpose": "staff_reset"}
```

| `purpose` | Subject | When |
| --- | --- | --- |
| `staff_reset` | Your Dentor password reset code | Clinic or Consultant app, Forget Password |
| `patient_reset` | Your Dentor password reset code | patient app, "Use my email instead" |
| `staff_signup` | Verify your email for Dentor | Clinic or Consultant sign-up, first step |
| `application` | Your Dentor application is approved / Your Dentor application | Super Admin approves or rejects an application |

Any 2xx answer counts as sent. The adapter sends `text` as a plain-text email from a Dentor sender
address with SPF and DKIM set up for its domain. (Code: `backend/app/email_codes.py`,
`backend/app/routers/platform.py`.)

### Limits the API applies

Codes are stored hashed; 5 tries per code; 30 seconds between codes; 5 codes per address per hour.

### Test plan (staging)

1. Clinic app › Forget Password with a tester's staff email → the email arrives (check the inbox
   and spam), the code sets a new password, and the old password stops working.
2. The same in the Consultant app and with the patient app's "Use my email instead".
3. A wrong code five times → the code is refused afterwards.
4. Sign up as a new clinic → the verification email arrives; approve it in the Super Admin
   console → the "approved" email arrives and the login works; repeat with a rejection.

5. Super Admin console › overview: "Email" shows **Connected** (red **Not connected** when the
   settings are missing, **Test mode** with `EMAIL_PROVIDER=console`).

## 2. SMS

### Settings

| Variable | Value |
| --- | --- |
| `SMS_PROVIDER` | `webhook` (empty refuses code requests in production; password login keeps working) |
| `SMS_WEBHOOK_URL` | HTTPS address of your adapter |
| `SMS_WEBHOOK_TOKEN` | a long random string |
| `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR` | optional, defaults `300` and `5` |

### What the API sends

`POST <SMS_WEBHOOK_URL>`, header `Authorization: Bearer <SMS_WEBHOOK_TOKEN>`:

```json
{"to": "+919876543210", "message": "482193 is your Dentor verification code. It expires in 5 minutes. Do not share it.", "purpose": "signup"}
```

`purpose` is `signup`, `login`, `reset` or `link` (patient "Fetch": the code goes to the mobile
number registered on the record being linked). Numbers are Indian, ten digits, sent with `+91`.
(Code: `backend/app/otp.py`.)

### Testing aids: fixed code for test numbers, test patient logins

Both are off by default and independent of the SMS and email services, so the patient app can be tested
before the SMS gateway (Pingbix) is connected. Every other number and account is unchanged.

**Fixed code for test numbers.** When both settings are set, each listed number gets the fixed 6-digit
code instead of an SMS, for patient sign-up, code login and password reset.

| Variable | Value |
| --- | --- |
| `OTP_TEST_MOBILES` | up to 20 ten-digit Indian numbers, comma-separated, no `+91` (numbers no real patient has) |
| `OTP_TEST_CODE` | exactly 6 digits |

Set both or neither: the API refuses to start with only one, or with a badly formed value.

- No SMS is sent, and the code never appears in an answer or the log (the log shows `******1234` only).
- Never used for "Fetch" (`link`): that purpose always needs a real SMS to the record's number.
- Expiry, the 5 wrong-attempt lock, the 30-second resend wait and the 5-per-hour limit all still apply.
- Refused (a plain "could not send" error) if the number is on any patient record the test account
  did not create itself, or on a patient account that was not created as a test account.
- A listed number without an account: the first code login creates its test account ("Test Patient",
  code login only, no usable password) and signs in. Sign-up with the code works too. No account is made
  for a number that belongs to a real patient. Such an account is disabled at the next restart once its
  number is no longer listed, and enabled again when it is listed again.
- An account created with the fixed code is marked `test_account`. It only ever sees records it created
  in the app itself (marked `test_record`; staff cannot set that mark). This holds for password login
  too, and after the settings are removed.

**Test patient logins.** `PATIENT_TEST_ACCOUNTS` lists `email|mobile|password` entries separated by `;`
(up to 20; a password needs 8+ characters with a letter and a number, and cannot contain `|` or `;`):

```
PATIENT_TEST_ACCOUNTS=tester1@example.com|9000000001|<password>;tester2@example.com|9000000002|<password>
```

- At each start-up the API creates or updates one ordinary patient account per entry, with the email and
  the mobile on the same account and the password stored only as a hash. It signs in through the normal
  login with the email or the mobile and that password. Nothing bypasses the password check.
- Each is a test account: it only ever sees records it creates in the app (as above).
- An entry whose email or number belongs to a real patient (a real account, or a staff-registered record)
  is skipped, and the log says so with masked values.
- Changing an entry's password applies at the next restart and ends that account's sessions. Removing an
  entry (or the whole setting) disables its account and ends its sessions; adding it back enables it again.
- To also use code login on such an account, list its mobile in `OTP_TEST_MOBILES` as well.

**A clinic to join.** After signing in, a test account must choose a clinic. Only clinics with
**Settings → Appointments & Queue → Patient app booking** switched on (web app, or Clinic rules in the
Clinic Owner app) are listed. Production never lists the demo clinic to real patients, but test accounts
do see it, so testers can use the demo clinic (switch Patient app booking on there) without touching a
real clinic. Test patients a test account registers in a real clinic are visible to that clinic's staff.

While either is on, the Super Admin console (Connected services) and the upgrade check show an amber notice
with the masked numbers and the number of test logins.

Anyone who has a test number and the code, or a test email and its password, can sign in to that test
account. Switch them off when testing ends: remove the lines, restart the API, delete code-made test accounts
in the patient app, and have the front desk delete the test patients they registered (clinic records stay).
(Code: `backend/app/otp.py`, `backend/app/test_accounts.py`, `backend/app/patient_auth.py`; tests:
`backend/tests/test_otp_test_number.py`, `backend/tests/test_patient_test_accounts.py`.)

### India: DLT

Register the sender id and this exact template with the gateway's DLT portal:
`{#var#} is your Dentor verification code. It expires in 5 minutes. Do not share it.`
If the approved template must differ, change the text in `backend/app/otp.py` to match it exactly,
or the operators will drop the messages.

### Recall and offers are not sent by SMS or WhatsApp

Recall reminders and offers reach patients in the patient app only (an agreed exclusion). Do not
point these at the SMS adapter. The tests in `backend/tests/test_exclusions.py` fail if recall or
offers ever call the SMS or email webhooks.

### Test plan (staging)

1. Patient sign-up with a tester's number on each major network (Jio, Airtel, Vi, BSNL) → the
   code arrives, and on Android the keyboard offers it.
2. Code login and reset by mobile.
3. Fetch: in the patient app, enter the Patient ID of a record registered under a second tester's
   number → that phone receives the code; the record joins after the code is entered.
4. Six requests in an hour for one number → the sixth is refused with a clear message.

## 3. Push notifications

### API settings

| Variable | Value |
| --- | --- |
| `PUSH_PROVIDER` | `webhook` (empty keeps notifications in the apps only) |
| `PUSH_WEBHOOK_URL` | HTTPS address of your push adapter |
| `PUSH_WEBHOOK_TOKEN` | a long random string |

`POST <PUSH_WEBHOOK_URL>`, header `Authorization: Bearer <PUSH_WEBHOOK_TOKEN>`:

```json
{"devices": [{"token": "<FCM registration token>", "platform": "android"}], "title": "Appointment confirmed", "body": "Root canal on 20 Oct at 9:30 AM", "data": {"kind": "appointment", "id": "..."}}
```

The API leaves out devices of people who muted alerts, are in their silence or sleep hours
(Notification setting), or switched that kind of alert off (patient app: appointment reminders,
medicine alerts, lab result alerts). The notification is still kept in the app.
(Code: `backend/app/notify.py`.)

### What has to be added

1. **Firebase project** with six apps: Android `in.dentor.patient`, `in.dentor.consultant`,
   `in.dentor.owner`, and iOS with the same bundle ids. Put each `google-services.json` in
   `mobile/apps/<app>/android/app/` and each `GoogleService-Info.plist` in
   `mobile/apps/<app>/ios/<App>/`. Both are git-ignored; keep them out of commits.
2. **APNs**: in the Apple Developer account, create an APNs authentication key (`.p8`, with its
   key id and the team id), upload it to Firebase, and enable the Push Notifications capability on
   the three app ids.
3. **App code**: add `@react-native-firebase/app` and `@react-native-firebase/messaging`, run
   `pod install`, ask for notification permission (Android 13+, iOS), and pass the token getter to
   `setPushTokenProvider` in `mobile/packages/shared/src/push.ts`. The apps already send the token
   to `POST /api/devices` (staff) or `POST /api/patient/devices` (patients) after sign-in. This is
   development work, about a day, that needs the files from steps 1 and 2.
4. **Adapter**: receives the body above and calls the FCM HTTP v1 API with a Firebase
   service-account key (kept on the adapter's server). For every token FCM reports as unregistered,
   call `POST /api/devices/remove` with `{"token": "...", "platform": "..."}`.

### Test plan (staging, physical phones)

1. Sign in on an Android phone and an iPhone in each app → a row appears in the `devices`
   collection.
2. Book an appointment for a test patient from the web app → the patient's phone shows the alert
   with the app closed, in the background and open; tapping it opens the app.
3. Turn on Sleep mode / Mute in Notification setting → no phone alert, but the notification is in
   the app.
4. Uninstall the app → the adapter reports the token and it is removed.

Push does not reach the iOS simulator without extra set-up; use real iPhones.

## 4. Fingerprint and Face ID

### How it works

Turning on "Fingerprint sign-in" (Settings, More or Profile tab, per app) asks the API for a random
per-device secret (`POST /api/auth/device/enroll`, patients `/api/patient/auth/device/enroll`). The
app stores it in the iOS Keychain or Android Keystore with `BIOMETRY_CURRENT_SET` access control and
hardware security, so only the phone's own fingerprint or face check releases it. Signing in sends
it to `/api/auth/device/login` (patients `/api/patient/auth/device/login`). The API stores only its
hash, allows 5 devices per account, and refuses it after a password change or reset, deactivation,
or "turn off" (`/device/revoke`). No biometric data reaches the app or the API.

### Configuration

None on the API. In the apps: `NSFaceIDUsageDescription` is in each `Info.plist`; Android gets
`USE_BIOMETRIC` from react-native-keychain. Nothing else is needed.

### Test plan (physical phones; simulators and browsers cannot show the prompt)

For each app, on one Android phone with an enrolled fingerprint and one iPhone with Face ID:

1. Sign in with the password, turn on Fingerprint sign-in, sign out → the login screen offers the
   fingerprint button; it signs in after a successful check.
2. Cancel the prompt → "Use password" keeps the password form.
3. Enrol an extra fingerprint or face in the phone's settings → the stored secret is invalidated
   (`BIOMETRY_CURRENT_SET`); fingerprint sign-in must fail safely and leave the password form.
   Record exactly what the app shows: this case has not been seen on a real phone.
4. Change the password on another device → the fingerprint sign-in is refused and the app asks
   for the password.
5. Deactivate the staff login in the web app → refused.
6. Turn it off in Settings → the login screen no longer offers it.

## 5. Android signing (Google Play)

Nothing below exists yet; nothing here was created or changed.

| Needed | Who provides it | Notes |
| --- | --- | --- |
| A Google Play Console developer account | Dentor (the legal entity on the listing) | one-time fee; the account owner decides who else gets access |
| An **upload key** (`.jks` / PKCS12 keystore), its alias and both passwords | created once by Dentor or its developer: `keytool -genkeypair -v -storetype PKCS12 -keystore dentor-upload.keystore -alias dentor-upload -keyalg RSA -keysize 2048 -validity 10000` | keep it and its passwords in a password manager with a backup; never in the repository. Play App Signing holds the app-signing key, so a lost upload key can be reset through Google |
| The four Gradle properties on the build machine | the developer | `DENTOR_UPLOAD_STORE_FILE`, `DENTOR_UPLOAD_STORE_PASSWORD`, `DENTOR_UPLOAD_KEY_ALIAS`, `DENTOR_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties` (`mobile/apps/<app>/android/app/build.gradle` reads them) |
| Three app entries | Play Console | `in.dentor.patient`, `in.dentor.consultant`, `in.dentor.owner`; with Play App Signing enabled |
| Store listing, privacy-policy URL, data-safety answers, content rating | Dentor | see `BUSINESS_CONTENT.md` section 9 |

Build: `cd mobile/apps/<app>/android && ./gradlew bundleRelease` gives
`app/build/outputs/bundle/release/app-release.aab`, signed with the upload key when the properties are
set (otherwise with the public debug key, which Play refuses). Raise `versionCode` for every upload.
Needs about 5 GB of free disk space per build.

## 6. Apple signing (App Store, TestFlight, physical iPhones)

**Unknown and not assumed:** which Apple Developer team owns, or will own, the bundle ids
`in.dentor.patient`, `in.dentor.consultant`, `in.dentor.owner`. On 15 October the build Mac had only
personal "Apple Development" certificates (one revoked), no "Apple Distribution" certificate, no
provisioning profiles, and no team set in the Xcode projects. None of these were used or changed.

| Needed | Who provides it | Notes |
| --- | --- | --- |
| Apple Developer Program membership (organisation) and its **Team ID** | Dentor (needs a D-U-N-S number for an organisation account) | the Team ID goes into `DEVELOPMENT_TEAM` |
| A developer account on that team with the **App Manager** or **Admin** role for whoever archives | Dentor's account holder | invites the developer in App Store Connect › Users and Access |
| An **Apple Distribution** certificate (or automatic signing with the Admin role) | created in the team's account | lives in the build Mac's keychain; never in the repository |
| Three **App IDs** with the capabilities they use: Keychain sharing is not used; Push Notifications only once push is added | registered in the team's account | `in.dentor.patient`, `in.dentor.consultant`, `in.dentor.owner` |
| Three **App Store Connect** app records | Dentor | name, privacy-policy URL, privacy labels, age rating, review login |
| An **APNs key** (`.p8`, key id) | the team's account | only for push (section 3) |

Archive and export: the commands are in `MOBILE_BUILD.md` section 7
(`xcodebuild … DEVELOPMENT_TEAM=<TEAMID> -allowProvisioningUpdates archive`, then `-exportArchive`
with an `ExportOptions.plist`, which is git-ignored). Raise `CURRENT_PROJECT_VERSION` for every upload.

## 7. What not to do while testing

- Do not sign in to release builds of the apps during testing: they talk to the production API.
- Do not configure any payment provider; the apps record payments taken at the clinic and never
  charge or refund anyone.
- Do not point SMS, email or push at real patients' contacts from staging.

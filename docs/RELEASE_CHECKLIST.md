# Dentor release-readiness checklist

What stands between this repository and a release of the four apps. `[x]` means done and
checked locally; `[ ]` means still to do, with what it needs. Nothing here has been
committed, pushed or deployed.

How the scope grew and what deploying changes for existing clinics: [`SCOPE_CHANGE.md`](SCOPE_CHANGE.md).
How to build and run everything: [`MOBILE_BUILD.md`](MOBILE_BUILD.md).
Outside services and how to test them: [`INTEGRATIONS.md`](INTEGRATIONS.md).
The design comparison: [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md).

## 0. Blocking before anything is called finished

- [x] **Compare every screen with the Figma designs.** Refreshed on 15 October 2026 with
      separate functional, visual and responsive results per frame (`DESIGN_REVIEW.md`). Of 530
      frames: 362 built, 88 partly built, 15 excluded, 53 not built, 12 not screens. Visually only
      15 are a close match; most built screens keep the brand but use a simpler layout.
- [x] **Build the designed workflows** (phases 0–9 in `IMPLEMENTATION_PLAN.md`); what is not
      built is listed there and in `DESIGN_REVIEW.md`.
- [ ] **Decide whether the visual gap matters for release** (pattern backgrounds, banners,
      illustrated cards; `DESIGN_REVIEW.md`, "What still differs visually").
- [ ] **Business content** from Dentor: legal text, help contacts, store, plans, points, labs
      ([`BUSINESS_CONTENT.md`](BUSINESS_CONTENT.md)).
- [ ] **Outside services**: email, SMS, push and real-device fingerprint tests
      ([`INTEGRATIONS.md`](INTEGRATIONS.md)).
- [ ] **Decide to commit and to deploy.** Everything is uncommitted working-tree changes plus
      ZIP backups.

- [ ] **Decide the open items in [`CONSISTENCY_AUDIT.md`](CONSISTENCY_AUDIT.md)**: places where the
      existing web app and the API disagree (double booking, the doctor list, clinic contact
      details kept in two places, shared appointment notes).

## 1. Real-device testing

Checked on the Android emulator (API 36) and iOS simulators (iPhone 16 and an iPad, iOS 18.4),
with automated flows: sign-in and refusal of wrong credentials, every tab, pushed screens and
back, the session surviving a restart, sign-out, the Android back button guarding an unsaved
prescription, and (run once) picking a photo and a PDF and uploading them.

An emulator cannot show the following. Each needs a person with a phone.

- [ ] **Device spread.** At least: a small, older Android phone (Android 8 to 10; the minimum
      is Android 7.0), a current Android phone (14 or newer, where the app draws edge to
      edge), an Android tablet, an iPhone SE-size phone, a current iPhone, an iPad. Minimum
      iOS is 15.1.
- [ ] **Real photos and files.** Attach a camera photo (iPhones save HEIC), a large photo
      (the 5 MB limit message) and a PDF from Files, Google Drive and iCloud.
- [ ] **Keyboard.** Every form with the real keyboard: nothing important hidden, "next" and
      "done" behave, the pinned button stays reachable. Check with a large system font size.
- [ ] **Text size and display zoom.** Largest accessibility text size on both platforms.
- [ ] **Networks.** Slow mobile data, switching Wi-Fi to mobile data, airplane mode and back:
      screens say they could not load and recover; nothing is saved twice.
- [ ] **Long idle.** Leave an app in the background overnight and open it: still signed in
      (the session refreshes) or cleanly back at sign-in, never a blank screen.
- [ ] **Hand-offs.** "Call" and "Email" on the clinic contact open the phone and mail apps.
- [ ] **Install and update.** Install a build, sign in, install the next build over it: still
      signed in. Uninstall and reinstall on iOS: the app must not show another person's data.
- [ ] **Gestures.** iOS swipe-back on every pushed screen; Android back button and gesture.
- [ ] **Two devices, one login.** Change the password on one: the other is signed out.
- [ ] **Clinic time zone.** A phone set to another time zone still shows clinic times for
      appointments and slots.
- [ ] **Push notifications**, once section 3 is done: received when the app is closed, in the
      background and open; tapping one opens the right screen.
- [ ] **SMS codes**, once section 2 is done: the code arrives, and the keyboard offers it.

## 2. SMS gateway (patient sign-up, code login, password reset by code)

- [x] The API sends codes through a webhook and never shows a code in production. It limits
      requests (30 seconds between codes, 5 per number per hour) and stores codes hashed.
- [x] Without a gateway, production refuses code requests with a clear message; password
      login keeps working. The Super Admin console shows whether SMS is connected.
- [ ] **Choose an SMS provider** and write a small adapter (a web endpoint you host) that
      accepts the API's request and calls the provider:
      `POST <SMS_WEBHOOK_URL>` with header `Authorization: Bearer <SMS_WEBHOOK_TOKEN>` and
      body `{"to": "+91XXXXXXXXXX", "message": "<text>", "purpose": "signup" | "login" | "reset"}`.
      Any 2xx answer means sent; anything else makes the API report that the code could not
      be sent.
- [ ] **India: register the sender and the message template (DLT)** with the provider. The
      text the API sends is exactly:
      `<6 digits> is your Dentor verification code. It expires in 5 minutes. Do not share it.`
      If the registered template differs, change the text in `backend/app/otp.py` to match.
- [ ] Set on the API server: `SMS_PROVIDER=webhook`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`.
- [ ] Test on a staging copy with real phones on each major mobile network.
- Numbers are assumed to be Indian (+91, ten digits). Other countries need a code change.

## 2a. Email codes (staff and patient password reset, staff sign-up)

- [x] Four-digit codes, stored hashed, 5 minutes (`OTP_TTL_SECONDS`), 5 tries, 30 seconds between codes, 5 per
      address an hour. Production never returns a code and refuses `EMAIL_PROVIDER=console`.
- [x] Without an email service, production refuses code requests with a clear message;
      password sign-in keeps working, and applications can still be reviewed in the console.
- [ ] **Choose an email service** and host a small adapter that accepts
      `POST <EMAIL_WEBHOOK_URL>` with `Authorization: Bearer <EMAIL_WEBHOOK_TOKEN>` and body
      `{"to", "subject", "text", "purpose"}` (`staff_reset`, `patient_reset`, `staff_signup`,
      `application`) and sends the email. Any 2xx answer means sent.
- [ ] Set on the API server: `EMAIL_PROVIDER=webhook`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN`.
- [ ] Send a test reset to a real mailbox (check spam placement; set SPF/DKIM for the sender).
- [x] The Super Admin console shows whether email is connected, in test mode or not connected (with what staff cannot do).

## 2b. Fingerprint / Face ID sign-in

- [x] No biometric data is read or stored: a per-device secret is released by the phone's own
      check (`BIOMETRY_CURRENT_SET`), and the API stores only its hash. A password change,
      reset or deactivation ends it.
- [x] `NSFaceIDUsageDescription` is in all three iOS apps; Android gets `USE_BIOMETRIC` from
      react-native-keychain.
- [ ] **Test on real phones** with an enrolled fingerprint and Face ID: turn it on in Settings,
      sign out, sign in with it, change the password, and check it is refused. Simulators and
      the browser builds cannot test the biometric prompt (the browser builds hide it).

## 2c. Content and settings Dentor must supply

- [ ] Everything in [`BUSINESS_CONTENT.md`](BUSINESS_CONTENT.md): Privacy Policy and Terms, help-centre
      contacts, store catalogue and prices, plan activation, referral points and tiers, the real
      lab directory, recall templates, store listings. Nothing there has been invented; the apps
      show marked placeholders or empty lists.
- [ ] Scheduled offers are sent by a one-minute background task inside the API process. Several API
      processes are safe (each offer is claimed once), but at least one must run continuously.

## 3. Push notifications (Firebase for Android, APNs for iPhone)

In-app notifications work today: every app has a notification screen and unread badges fed by
the API. Push, which reaches a phone that is not showing the app, is not connected.

- [x] The API records notifications and can forward each one to a push adapter:
      `POST <PUSH_WEBHOOK_URL>` with `Authorization: Bearer <PUSH_WEBHOOK_TOKEN>` and body
      `{"devices": [{"token": "...", "platform": "android" | "ios"}], "title": "...", "body": "...", "data": {...}}`.
- [x] The apps have one place to hand over a device token
      (`setPushTokenProvider` in `mobile/packages/shared/src/push.ts`) and already send it to
      the API after sign-in.
- [ ] **Firebase project** with three Android apps (`in.dentor.patient`,
      `in.dentor.consultant`, `in.dentor.owner`) and three iOS apps with the same ids.
      Download each `google-services.json` into `mobile/apps/<app>/android/app/` and each
      `GoogleService-Info.plist` into `mobile/apps/<app>/ios/<App>/`. Keep them out of a
      public repository.
- [ ] **APNs key**: in the Apple Developer account create an APNs authentication key (.p8)
      and upload it to the Firebase project. Enable the Push Notifications capability for the
      three app ids.
- [ ] **Add the messaging SDK to the apps** (`@react-native-firebase/app` and
      `@react-native-firebase/messaging`, which are plain React Native libraries, then
      `pod install`), ask for notification permission (Android 13 and iOS), and give the
      token to `setPushTokenProvider`. This is development work that needs the files above.
- [ ] **Write the push adapter**: an endpoint that receives the body above and calls Firebase
      Cloud Messaging with a service-account key, and reports tokens Firebase rejects so they
      can be removed (`POST /api/devices/remove`).
- [ ] Set on the API server: `PUSH_PROVIDER=webhook`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN`.
- [ ] Test on real phones (push does not work on the iOS simulator without extra set-up).

## 4. Android signing and Play Store builds

- [x] Debug and release APKs build for all three apps; a release bundle (AAB) builds. The
      release packages start on an emulator from their own bundled code. (Release builds last
      made on 13 October, before phases 0–9; debug builds were rebuilt on 15 October.)
- [ ] **Rebuild and smoke-test the release packages** with the final code (needs ~5 GB free disk).
- [x] Release builds use an upload key when one is configured, and never read it from the
      repository (`mobile/apps/<app>/android/app/build.gradle`).
- [ ] **Blocker found on 15 October 2026:** no upload key exists on the build Mac
      (`DENTOR_UPLOAD_*` is not set in `~/.gradle/gradle.properties`), so `bundleRelease` today
      produces bundles signed with the public debug key, which the Play Store refuses.
- [ ] **Create the upload key** (once, kept safe and backed up; losing it blocks updates):
      commands in `MOBILE_BUILD.md`, section 6.
- [ ] **Google Play Console**: a developer account, three app entries, Play App Signing
      enabled, store listing, privacy policy address, data-safety form (the apps collect
      name, phone number, health records and photos the patient uploads), content rating.
- [ ] **Version numbers**: raise `versionCode` for every upload, `versionName` for every
      release, in each app's `android/app/build.gradle`.
- [ ] `./gradlew bundleRelease` with the upload key, upload to an internal testing track,
      test on real phones, then promote.
- [ ] Decide whether to turn on code shrinking (`enableProguardInReleaseBuilds`); it is off,
      which is the safe default, and turning it on needs a full regression test.

## 5. Apple signing and iOS builds

- [x] Debug and Release builds compile for the simulator for all three apps and start there.
      The Release builds carry their own bundled code. (Release last built on 13 October; Debug
      rebuilt on 15 October.)
- [ ] **Blocker found on 15 October 2026:** the build Mac has only personal "Apple Development"
      certificates (one revoked), no "Apple Distribution" certificate, no provisioning profiles,
      and no `DEVELOPMENT_TEAM` in the three Xcode projects. It is not known which Apple team owns
      the `in.dentor.*` bundle ids. An archive for the App Store therefore cannot be made here; the
      commands are ready in `MOBILE_BUILD.md`, section 7.
- [ ] **Apple Developer Program membership** and the team id.
- [ ] **Three app ids** (`in.dentor.patient`, `in.dentor.consultant`, `in.dentor.owner`) and
      three App Store Connect app records.
- [ ] Open each `ios/<App>.xcworkspace` in Xcode, choose the team under Signing &
      Capabilities, and archive (commands and steps in `MOBILE_BUILD.md`, section 7).
- [ ] **Never built so far:** a device build and an archive. Both need the team's signing,
      so the first archive may surface signing or capability settings to fix.
- [ ] App Store review needs: a demo login for each app that works against production, a
      privacy policy address, the privacy "nutrition label", and an answer to the export
      compliance question (the apps use only HTTPS and the system Keychain).
- [ ] Account deletion inside the app is required by Apple for apps that create accounts: the
      patient app has it (Profile > Delete account). Check it against production.
- [ ] Raise the build number (`CURRENT_PROJECT_VERSION`) for every upload.

## 6. Notification retention and other clean-up

- [x] Notifications are deleted automatically 180 days after they are created
      (`NOTIFICATION_RETENTION_DAYS`; 0 keeps them for ever). Notifications written before the
      rule existed are given their date at start-up.
- [x] One-time codes are deleted after 2 hours, refresh tokens when they expire (30 days),
      records of signed-out sessions when their token would have expired.
- [ ] **Confirm 180 days** is the right period for the clinics (a legal or policy question).
- [ ] **Device tokens are never removed on their own.** Once push is connected, the adapter
      must report tokens the push service rejects.
- [ ] **Patient files are stored inside the database** as base64 (5 MB each). Watch database
      size; moving files to object storage is a later project.
- [ ] **A deleted patient account leaves the clinic's medical record in place** by design
      (clinics must keep records). Confirm this matches the privacy policy.

## 7. Backend compatibility and API security

- [x] The seven behaviour changes for the live web app are reviewed, with a safeguard for
      each (`SCOPE_CHANGE.md`).
- [x] A read-only pre-deployment check lists every clinic and what must be fixed first:
      `cd backend && uv run python -m app.preflight`.
- [x] The web app that is live today works against the new backend (checked by building it
      from the last commit and driving it in a browser). People signed in before the upgrade
      stay signed in.
- [x] Server-side roles: nine kinds of login (Clinic Owner, Administrator, Dentist,
      Receptionist, Accountant, Pharmacist, Consultant, Patient, Super Admin) against 39 API
      calls (`tests/test_security_matrix.py`), plus refusals inside handlers, are tested, as are
      isolation between two clinics (records, tickets, offers, and a forged clinic header),
      between patients, and between a consultant's patients and everyone else's.
- [x] Sessions: sign-out, password change and reset, deactivation and reuse of a refresh
      token all end the session on the server at once.
- [x] Tests cannot reach production: the API tests refuse a database that is not on this
      machine, the browser suites refuse other addresses, the device flows stop on a release
      build.
- [ ] **Run the pre-deployment check against production** (it only reads) and act on anything
      marked "FIX FIRST".
- [ ] **Deploy in this order:** backend, then web app, then mobile apps. The new web app does
      not work against the old backend.
- [ ] **Back up the production database** before deploying.
- [ ] **Sign-in rate limiting is kept in the API process's memory.** It is correct with one
      API process. If the API is ever run as several processes, each keeps its own count; the
      one-time-code limits are in the database and are not affected.
- [ ] **Sign-in limits are per network address** (30 calls a minute). Patients on one mobile
      network or one clinic Wi-Fi can share an address and therefore the limit. If "too many
      attempts" appears for people who did nothing wrong, raise the limit or count per
      account as well.
- [ ] **The reverse proxy must pass each caller's real address** to the API, or every user
      shares one address and one sign-in limit. With nginx that is
      `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` in the API's `location`
      block; the API trusts that header from a proxy on the same machine. To check after
      deploying: the API's access log should show different addresses for different users,
      not `127.0.0.1` on every line. This matters more once patients sign in.
- [ ] **Dependency advisories** (checked 13 Oct 2026):
      web app, none in shipped dependencies;
      mobile apps, 21 "high", all one issue in the build tools (Metro and the React Native
      CLI, through the `braces` package), not in code that ships inside the apps;
      API, two in the token library `python-jose` and its dependency `ecdsa`. Neither applies
      to how Dentor uses it (one shared secret, HS256, with the algorithm fixed when tokens
      are checked), and neither has a fixed version yet. Re-check before release.
- [ ] **An independent security review** of the patient-facing API has not been done.
- [ ] **Never set `SEED_DEMO=1` in production.** It would create demo logins with the
      passwords printed in the README. The pre-deployment check refuses a production database
      that still has those passwords.

## 8. Environment configuration and production integration

API server (`backend/.env` or the service environment). The first five exist in production
today; the rest are new and optional unless marked.

| Variable | For | Needed in production |
| --- | --- | --- |
| `DENTOR_ENV=production` | safety checks, no API docs page | yes (set today) |
| `MONGO_URL`, `DB_NAME` | database | yes (set today) |
| `JWT_SECRET` | signing sessions; changing it signs everyone out | yes (set today) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | platform owner login | yes (set today) |
| `CORS_ORIGINS` | the web app's address when it is on another domain | yes (set today); the mobile apps need no entry |
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | one-time codes | for patient sign-up |
| `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` | email codes, application decisions | for password reset by email and staff sign-up |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | push | optional |
| `NOTIFICATION_RETENTION_DAYS` | clean-up, default 180 | optional |
| `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES` | session lengths, default 30 and 60 | optional |
| `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR` | code lifetime and limit, default 300 and 5 | optional |

- [ ] The reverse proxy in front of the API must pass the `PATCH` method and the new paths
      (`/api/patient/`, `/api/consultant/`, `/api/owner/`, `/api/clinic/`, `/api/notifications`,
      `/api/devices`). A proxy that forwards everything under `/api` needs no change.
- [ ] The API must be reachable over HTTPS from phones: release builds refuse plain HTTP.
- [ ] **Web app**: `frontend/.env.production` holds the API address baked into the build.
      Serve `sw.js` and `index.html` without long-lived caching.
- [ ] **Mobile apps**: each `mobile/apps/<app>/env.json` holds the production API address used
      by release builds (`apiUrl`). Check it before building for the stores.
- [ ] **After deploying the backend** (read-only checks): `GET /api/health` answers; an
      administrator can sign in on the web; the Super Admin console shows the overview and
      which outside services are connected.
- [ ] **Per clinic**, when it is ready for the patient app: an owner or administrator
      switches on "Patient app booking" in Settings.
- [ ] **Per clinic**, for the Owner app: the Super Admin adds a Clinic Owner login.
- [ ] **Per doctor**, for the Consultant app: an owner or administrator adds a Consultant
      login linked to the doctor's profile (Staff > Logins & app access).

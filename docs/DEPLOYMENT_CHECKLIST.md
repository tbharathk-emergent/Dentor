# Production deployment checklist (backend, web app, Android signing)

For whoever carries out the Dentor production release. Every step here is to be done only after the owner
approves it; nothing in this document has been run against production. Background and full commands:
[`BUILD_AND_DEPLOYMENT_GUIDE.md`](BUILD_AND_DEPLOYMENT_GUIDE.md) sections 6 and 10.

## A. What is verified and what is not (15 October 2026)

Production facts below come from read-only requests (`GET` / `OPTIONS`, no sign-in, no data sent).

| Fact | How it was checked | Status |
| --- | --- | --- |
| Production web app: `https://dentor.localappstore.in` | page loads, title "Dentor · Clinic Management"; `/platform` (Super Admin console), `/login`, `/patients` all served (client-side routes work) | ✅ verified |
| Production API: `https://dentorapi.localappstore.in` | `/api/health` → `{"ok":true}` | ✅ verified |
| Both on one server | both names resolve to 163.227.186.66, `Server: nginx/1.24.0 (Ubuntu)` | ✅ verified |
| HTTPS | one certificate for `dentor.localappstore.in` and `dentorapi.localappstore.in`, valid until 6 Jan 2027 | ✅ verified |
| The web domain does **not** proxy `/api` | `https://dentor.localappstore.in/api/health` → 200 `text/html` (the web page, not the API); nginx has no proxy rule there. Corrected 16 Oct; nothing depends on it | ✅ verified |
| `index.html` and `sw.js` are not cached | `Cache-Control: no-store, no-cache, must-revalidate` | ✅ verified |
| CORS allows the web app | `OPTIONS /api/auth/login` from `https://dentor.localappstore.in` → allowed, PATCH included | ✅ verified |
| The live web bundle calls `https://dentorapi.localappstore.in` | read from the served JavaScript | ✅ verified |
| **Production runs the OLD backend** | `/api/clinic-app/*`, `/api/patient/*`, `/api/consultant/*`, `/api/owner/*`, `/api/engage/*` → 404 | ✅ verified: **the mobile apps cannot work until the new backend is deployed** |
| `central.localhost` | not in the repository; resolves to 127.0.0.1 (this computer) | ✅ verified: not a production domain. `central.localappstore.in` does not exist in DNS |
| Mobile release builds call `https://dentorapi.localappstore.in` | `apiUrl` in all three `env.json`; `config.ts` uses it when `__DEV__` is false | ✅ verified in code |
| Release builds are signed with the debug key until `mobile/signing/signing.properties` exists | `./gradlew :app:signingReport`, all three apps: `Variant: release · Config: debug` | ✅ verified |
| Server paths, process manager, Python / uv on the server, MongoDB location, the production environment variables, how releases are copied today | not visible from outside the server | ❓ unknown: check on the server |
| A signed release APK signing in to a server running the new backend | never done | ⏸ untested |
| The upgrade check (`app.preflight`) on production data | only the server can run it | ⏸ untested |

## B. Android signing: one keystore for all three apps

### B1. How the apps find the key (✅ verified, identical in all three apps)

Since 15 October all three `android/app/build.gradle` files load one shared script,
[`mobile/signing/signing.gradle`](../mobile/signing/signing.gradle). It takes the upload key from, first match
wins:

1. Gradle properties `DENTOR_UPLOAD_STORE_FILE`, `DENTOR_UPLOAD_STORE_PASSWORD`, `DENTOR_UPLOAD_KEY_ALIAS`,
   `DENTOR_UPLOAD_KEY_PASSWORD` (`~/.gradle/gradle.properties`, `-P`, or `ORG_GRADLE_PROJECT_*` variables);
2. a properties file with the same four names: the one named by `DENTOR_SIGNING_PROPERTIES`, otherwise
   **`mobile/signing/signing.properties`** (git-ignored);
3. nothing: release builds use the public debug key (as before).

A relative keystore path is read from the properties file's folder, so `dentor-upload.jks` means
`mobile/signing/dentor-upload.jks`; `~/` is expanded. A setting that is present but incomplete, or a keystore
that is missing, stops **release** tasks with a message naming the missing setting (never a value); debug builds
are not affected. Setup: [`mobile/signing/README.md`](../mobile/signing/README.md).

Checks run on 15 October with React Native's public debug keystore as a test file, outside the repository:
no settings → `Config: debug` for all three; a test properties file → `Config: release` for all three; relative
path, `~/` path, Gradle properties winning over the file, a wrong password (`Error: Failed to read key`), a
missing alias, a missing keystore and a missing `DENTOR_SIGNING_PROPERTIES` file all behave as described, and a
test password never appeared in any output. `mobile/signing/signing.properties` and `*.jks` / `*.keystore` in
that folder are git-ignored; the README, script and example file are not.

### B2. What to send (no secrets)

Nothing is needed in chat for the setup itself. When it is done, say so; to compare, the alias is shown by
`keytool -list -keystore mobile/signing/dentor-upload.jks` (asks for the password in your terminal). Never
paste passwords, the keystore or `signing.properties` into chat. Say whether any of the three apps already
exists on Google Play (then Play expects the upload key registered there).

### B3. Put your files in place (your step)

```sh
cd mobile/signing
cp "/path/to/your-existing.jks" dentor-upload.jks       # a copy; the original stays where it is
cp signing.properties.example signing.properties
open -e signing.properties                               # the four values from your existing file; keep your alias
chmod 600 signing.properties dentor-upload.jks
git status --short .                                     # must not list signing.properties or the .jks
```

### B4. Verification (needs your approval; builds nothing, prints no passwords)

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17) ANDROID_HOME=$HOME/Library/Android/sdk
for app in owner consultant patient; do
  (cd mobile/apps/$app/android && ./gradlew -q :app:signingReport | grep -A6 '^Variant: release$')
done
```

Pass when all three show `Config: release`, a store under `mobile/signing/`, your alias and the same `SHA-256`.
A wrong password shows `Error: Failed to read key … from store`. (`validateSigningRelease` is not a password
check.) Then, separately approved: `./gradlew assembleRelease` / `bundleRelease` and
`apksigner verify --print-certs` on each output.

One upload key for three Play apps is allowed. If the keystore is also used by other products (for example a
`follo.jks` appears in about ten other projects on this Mac), consider whether Dentor should have its own.

## C. Backend deployment checklist (🔒 owner's approval required for each step)

The exact server commands, phase by phase and marked read-only or production-changing, are in
[`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md).

### C1. Before the day

- [ ] Confirm on the server: where the backend lives, how it is started (systemd service or other), its
      Python and uv versions (Python 3.12 needed), where MongoDB runs, and the current environment file.
- [ ] Copy the server's current backend folder and the web root aside as the rollback copy.
- [ ] Decide on email (`EMAIL_*`) and SMS (`SMS_*`): without SMS, **no patient can sign up**, so the patient
      app has no users. Without email, password reset by email and staff sign-up are refused.
- [ ] Prepare production logins for the apps: Clinic Owner logins (created by the Super Admin), Consultant
      logins linked to consultant profiles, a reviewer account per app for the stores.

### C2. Backup (on the server)

- [ ] `mongodump --uri "<MONGO_URL>" --db <DB_NAME> --out /var/backups/dentor/<YYYY-MM-DD>` (paths are
      examples).
- [ ] Check the backup has every collection: `ls /var/backups/dentor/<YYYY-MM-DD>/<DB_NAME> | wc -l`.
- [ ] Keep it off the server as well.

### C3. Upgrade check (on the server, read-only)

- [ ] With the **production environment loaded** (`DENTOR_ENV=production` and the server's `MONGO_URL`,
      `DB_NAME`) and the **new** code: `uv run python -m app.preflight`.
- [ ] Exit code 0 = go; 1 = fix the "FIX FIRST" items first; 2 = database not readable.
- [ ] Read the notes: demo logins, roles that change (Consultant logins lose web access), clinics without an
      owner login, SMS and push status.

### C4. Environment variables (production `backend/.env` or service environment; never in git)

| Variable | Today | Action |
| --- | --- | --- |
| `DENTOR_ENV=production`, `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `CORS_ORIGINS` | set (per `RELEASE_CHECKLIST.md`) | keep unchanged; changing `JWT_SECRET` signs everyone out |
| `SEED_DEMO` | must be `0` or unset | check |
| `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` | new | add when the email service exists (`INTEGRATIONS.md` §1) |
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | new | add when the SMS gateway exists (§2) |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | new, optional | later (§3) |
| `NOTIFICATION_RETENTION_DAYS`, `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES`, `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR` | new, optional | defaults are fine |

No migration script: new collections and indexes are created when the API starts; existing documents are not
changed.

### C5. Deploy the backend

- [ ] Copy the new `backend/` to the server (keeping the old copy), then `uv sync --no-dev`.
- [ ] Restart the API the way the server runs it today, one process, behind nginx with `--proxy-headers`.
- [ ] nginx: `/api` forwarded with `PATCH`, real client address passed (`X-Forwarded-For`), body limit 16 MB.

### C6. Smoke tests, backend (read-only where possible)

- [ ] `curl https://dentorapi.localappstore.in/api/health` → `{"ok":true}`.
- [ ] `curl -o /dev/null -w '%{http_code}' https://dentorapi.localappstore.in/api/clinic-app/patients` →
      **401** (was 404): the new backend is live.
- [ ] The current web app still works (it was checked against the new backend locally, 7 / 7): an
      administrator signs in, opens patients and appointments.
- [ ] Super Admin signs in at `https://dentor.localappstore.in/platform`: clinics listed, connected services
      shown (email, SMS, push).
- [ ] The API access log shows real client addresses.

## D. Web app deployment checklist (after C passes)

- [ ] Build: `cd frontend && npm run build` → `frontend/dist/`; confirm the bundle contains
      `dentorapi.localappstore.in` (`grep -l dentorapi dist/assets/*.js`).
- [ ] Copy `frontend/dist/` to a new release folder on the server; switch the web root to it; keep the old
      one. The existing nginx already serves client-side routes and does not cache `index.html` / `sw.js`.
- [ ] Smoke test: sign in as an administrator and as the Super Admin; open `/platform`, Patients,
      Appointments, Accounts, Expenses; switch a clinic in the Super Admin console.

## E. Mobile apps (after C, D and the signing in B)

- [ ] Signing verified (B4), then signed release builds approved and made.
- [ ] Manual check of each release APK on a phone against production, with a real production account made
      for this purpose (never the development demo logins): sign in, main tabs, sign out.
      Patient app: only after SMS works.
- [ ] Upload to Play internal testing first.

## F. Rollback

| What | How | Notes |
| --- | --- | --- |
| Web | switch the web root back to the previous folder | users get it on reload |
| Backend | restore the previous backend folder and restart | the new release only added collections and indexes; the old backend runs on the same database |
| Database | `mongorestore --uri "<MONGO_URL>" --drop --nsInclude "<DB_NAME>.*" <backup dir>` | **only** if data was damaged; it discards everything written since the backup |
| Mobile | halt the staged rollout in Play; ship a fixed version | installed versions cannot be removed |

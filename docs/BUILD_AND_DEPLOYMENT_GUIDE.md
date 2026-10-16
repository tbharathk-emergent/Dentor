# Dentor: build and deployment guide

For the developer or owner who runs, tests, builds and releases Dentor. This is the main reference;
it links to the detailed guides where a topic needs more space.

| Detailed guide | Covers |
| --- | --- |
| [`BUILD_COMMANDS.md`](BUILD_COMMANDS.md) | one-page command table with the latest verification run |
| [`MOBILE_BUILD.md`](MOBILE_BUILD.md) | the three native apps in depth, API settings, tests, troubleshooting |
| [`WEB_BUILD.md`](WEB_BUILD.md) | the web app in depth |
| [`INTEGRATIONS.md`](INTEGRATIONS.md) | email, SMS, push, fingerprint, Android and Apple signing requirements |
| [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) | everything still needed before a release |
| [`SCOPE_CHANGE.md`](SCOPE_CHANGE.md) | what deploying the new backend changes for clinics using the web app today |
| [`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) | step-3 server commands: discovery, backup, upgrade check, deploy, smoke tests, rollback |
| [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) | the step-by-step production checklist, verified production facts, and Android signing verification |

**Status marks used below:**

| Mark | Meaning |
| --- | --- |
| ✅ | run on this Mac (Apple Silicon) on 15 October 2026 and succeeded |
| ⏸ | matches the repository's scripts and project files, but not run in the latest pass |
| ⛔ | cannot be run yet: needs credentials, an account or hardware that is not available |
| 🔒 | production: documentation only. Nothing here has been deployed, and production configuration was not changed |

---

## Contents

0. [The four applications](#0-the-four-applications)
1. [Prerequisites and installation](#1-prerequisites-and-installation)
2. [Backend and database (needed by every app)](#2-backend-and-database-needed-by-every-app)
3. [Local development](#3-local-development)
4. [Local testing](#4-local-testing)
5. [Android debug builds](#5-android-debug-builds)
6. [Android release builds](#6-android-release-builds)
7. [iOS simulator builds](#7-ios-simulator-builds)
8. [iOS device and release builds](#8-ios-device-and-release-builds)
9. [Web production build](#9-web-production-build)
10. [Production deployment](#10-production-deployment)
11. [Store submission](#11-store-submission)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick reference](#13-quick-reference)

---

## 0. The four applications

| # | App | Folder | Built with | Android id | iOS bundle id · Xcode scheme | Browser dev port |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Dentor Clinic (installs as "Dentor Owner") | `mobile/apps/owner` | React Native 0.87.1, React Native Community CLI 20.2, Gradle 9.4.1, Xcode 26 + CocoaPods 1.17 | `in.dentor.owner` | `in.dentor.owner` · `DentorOwner` | 8093 |
| 2 | Dentor Consultant | `mobile/apps/consultant` | same | `in.dentor.consultant` | `in.dentor.consultant` · `DentorConsultant` | 8092 |
| 3 | Dentor (patient) | `mobile/apps/patient` | same | `in.dentor.patient` | `in.dentor.patient` · `DentorPatient` | 8091 |
| 4 | Web reception + Super Admin console | `frontend/` | React 19, Vite 8, Tailwind 4; installable PWA | — | — | 5173 |
| — | API (serves all four) | `backend/` | Python 3.12, FastAPI, Motor (MongoDB), run with uv and uvicorn | — | — | 8000 |

- **No Expo, no EAS and no Capacitor** anywhere in the build path. The mobile apps are plain React Native
  projects with native `android/` and `ios/` folders.
- The three mobile apps are one npm workspace (`mobile/`) and share `mobile/packages/shared`.
- Production today: web `https://dentor.localappstore.in`, API `https://dentorapi.localappstore.in`.
- Display names, application ids and bundle ids are left as they are. "Dentor Owner" stays until the final
  name is confirmed.

---

## 1. Prerequisites and installation

### Tools

| Tool | Version | For | Check |
| --- | --- | --- | --- |
| Node.js | 22.11 or newer (24 used) | apps 1–4 | `node -v` |
| Python + uv | 3.12 | API | `uv --version` |
| MongoDB | 6 or newer, running on `127.0.0.1:27017` | API | `nc -z 127.0.0.1 27017 && echo up` (on this Mac `mongod` runs from `~/mongodb-local` and is not on the PATH) |
| JDK | **17** (this Mac's default `java` is 21) | Android | `/usr/libexec/java_home -V` |
| Android SDK | platform 37, build-tools 37.0.0, NDK 27.1.12297006, CMake, an emulator | Android | Android Studio › SDK Manager |
| Xcode | 26 (26.2 used), an iOS simulator | iOS | `xcodebuild -version` |
| CocoaPods | 1.17 | iOS | `pod --version` |
| Ruby + Bundler | the system or Homebrew Ruby | CocoaPods via the app's `Gemfile` (optional) | `bundle -v` |
| Disk space | 3 GB free per native build while it runs; 5 GB to be comfortable | Android, iOS | `df -h /System/Volumes/Data` |

Shell settings for Android (put them in `~/.zshrc` to keep them):

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Install dependencies (from the repository root)

| Step | Command | Status |
| --- | --- | --- |
| API | `cd backend && uv sync` | ⏸ (installed; tests ran with it ✅) |
| Mobile apps (all three) | `cd mobile && npm install` (`npm ci` for an exact install) | ⏸ (installed; builds ran with it ✅) |
| iOS pods, per app | `cd mobile/apps/<app>/ios && pod install` | ✅ |
| Web | `cd frontend && npm install` (`npm ci`) | ⏸ (installed; builds ran with it ✅) |
| Root helper (`npm run dev` for API + web) | `npm install` at the root | ⏸ |
| Browser test runner (once) | `cd frontend && npx playwright install chromium` | ⏸ |

`<app>` is `owner`, `consultant` or `patient` throughout this guide; `<Scheme>` is `DentorOwner`,
`DentorConsultant` or `DentorPatient`.

---

## 2. Backend and database (needed by every app)

### Run the API locally

```sh
cd backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Which database this uses.** The API reads `backend/.env` if the file exists, and a variable already set
in the shell always wins over the file (`backend/app/config.py`). With neither, it uses the local
`mongodb://127.0.0.1:27017`, database `dentor`. The running API has **no guard against a remote database**
(only the test suite has one), so a `backend/.env` copied from a server would point a local API at
production. On a development machine:

- keep no production credentials in `backend/.env` (there is none on this Mac today);
- to be certain, name the local database on the command line, which overrides any `.env`:
  ```sh
  cd backend
  DENTOR_ENV=development MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=dentor_local \
    uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- the start-up log line and `/api/health` don't show the database; check `backend/.env` before starting.

| | Local | Production |
| --- | --- | --- |
| API | `http://127.0.0.1:8000` (`http://localhost:8000`) | `https://dentorapi.localappstore.in` |
| Database | MongoDB on `127.0.0.1:27017`, a Dentor database such as `dentor` or `dentor_local` | the server's `MONGO_URL` / `DB_NAME`, set only in the server's environment |
| Who points at it | the web dev server and local previews built with an empty `VITE_API_BASE_URL`, mobile debug builds (`devApiUrl`), mobile browser builds | `npm run build` of the web app (`.env.production`), mobile **release** builds (`apiUrl`) |

- Health check: `curl http://127.0.0.1:8000/api/health` → `{"ok":true}`. API docs at
  `http://127.0.0.1:8000/docs` (development only; switched off in production).
- Status: ✅ (used for every test run on 15 October).

### Database

| Setting | Default | Notes |
| --- | --- | --- |
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | the local MongoDB |
| `DB_NAME` | `dentor` | use another name to keep a separate local copy, e.g. `DB_NAME=dentor_local` |
| `SEED_DEMO` | on in development | creates the demo clinic and the demo logins below on first start |

This Mac's MongoDB is shared with other projects. Use your own `DB_NAME` for Dentor and never drop a
database you did not create.

```sh
MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=dentor_local uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Environment variables and `.env` files

| File | Used by | In git | Contents |
| --- | --- | --- | --- |
| `backend/.env` | API | **no** (git-ignored) | on a server: a copy of `backend/.env.example` with the server's values. Shell variables override it. Development needs none; never copy a server's file to a development machine |
| `backend/.env.example` | reference | yes | every setting, secrets left empty |
| `frontend/.env.development` | web dev server | yes | `VITE_API_BASE_URL=` (empty: the dev server proxies `/api` to `127.0.0.1:8000`) |
| `frontend/.env.production` | web production build (`npm run build`, `vite build`) | yes | `VITE_API_BASE_URL=https://dentorapi.localappstore.in` (public value). A `VITE_API_BASE_URL` already set in the shell, even empty, wins over the file; `.env.*.local` files would win too (none exist) |
| `mobile/apps/<app>/env.json` | mobile apps | yes | `devApiUrl` (debug builds) and `apiUrl` (release builds) |
| `DENTOR_API_URL` (shell variable) | mobile browser builds | — | API address for `npm run web` / `build:web`; default `http://localhost:8000` |
| `mobile/signing/signing.properties` + the keystore | Android release signing | **no** (git-ignored) | `DENTOR_UPLOAD_*` (section 6); `~/.gradle/gradle.properties` or `ORG_GRADLE_PROJECT_*` also work |

Development needs no `backend/.env`. The full list of API settings is in `MOBILE_BUILD.md` section 2.

### Development logins (only where demo data is seeded; production has none)

| App | Login | Password |
| --- | --- | --- |
| Web reception | `admin@dentor.in` | `Dentor@2026` |
| Super Admin console (web, `/platform`) | `superadmin@dentor.in` | `SuperAdmin@2026` |
| Dentor Clinic | `owner@dentor.in` | `Owner@2026` |
| Dentor Consultant | `kumar@dentor.in` | `Consultant@2026` |
| Dentor patient | mobile `9876543210` | `Patient@2026` |

In development, SMS and email codes are not sent: the API logs them and the apps show them.

---

## 3. Local development

Start the API first (section 2) in its own terminal. Each app below then runs in its own terminal(s).

### App 4: web reception + Super Admin

```sh
cd frontend
npm run dev                  # http://localhost:5173 ; /api is proxied to 127.0.0.1:8000
```

`npm run dev` at the repository root starts the API and the web app together. Status ⏸ (the production
preview was used for testing instead, ✅).

### Apps 1–3 in a browser (fast preview; not a deployment target)

```sh
cd mobile/apps/owner && npm run web          # http://localhost:8093   (consultant: 8092, patient: 8091)
```

Status ✅. Uses `http://localhost:8000` unless `DENTOR_API_URL` is set. Fingerprint sign-in and other
phone-only features are hidden in the browser.

### Apps 1–3 on an Android emulator or phone (debug)

```sh
# terminal 1: Metro, the JavaScript server for debug builds (run it in the app you build)
cd mobile/apps/owner && npm start

# terminal 2: let the device reach the Mac, then build, install and open the app
adb reverse tcp:8000 tcp:8000 && adb reverse tcp:8081 tcp:8081
cd mobile/apps/owner && npm run android -- --active-arch-only
```

- `--active-arch-only` builds only the connected device's CPU type (an arm64 phone or an Apple Silicon
  emulator). Without it, all four types are compiled, which takes about four times the disk space and time.
- Status ⏸ for `npm run android` (the same Gradle build ran directly, ✅ section 5).

### Apps 1–3 on the iOS simulator (debug)

```sh
cd mobile/apps/owner && npm start            # terminal 1
cd mobile/apps/owner && npm run ios          # terminal 2 (or: npm run ios -- --simulator "iPhone 16")
```

Status ⏸ for `npm run ios` (the same Xcode build ran directly, ✅ section 7).

### Pointing the apps at the local backend and database

| Where the app runs | Setting | What to do |
| --- | --- | --- |
| Web dev server | `frontend/.env.development` (empty) | nothing: `/api` is proxied to `127.0.0.1:8000` |
| Web production build tested locally | shell | `VITE_API_BASE_URL= npx vite build` then `npx vite preview --port 5173 --strictPort` (the empty value keeps calls on `/api`, which the preview proxies to `127.0.0.1:8000`). Never preview a plain `npm run build` for testing: that bundle calls the **production** API |
| Mobile app in a browser | `DENTOR_API_URL` | nothing for `localhost:8000`; otherwise set it before `npm run web` |
| Android emulator / USB phone | `devApiUrl` = `http://localhost:8000` | run `adb reverse tcp:8000 tcp:8000` after the device connects |
| iOS simulator | `devApiUrl` | nothing: it shares the Mac's network |
| Phone on Wi-Fi (no cable) | `devApiUrl` | set it to the Mac's LAN address (e.g. `http://192.168.1.20:8000`), start the API with `--host 0.0.0.0`; don't commit that change |

Which **database** the local API uses is set by `MONGO_URL` and `DB_NAME` when the API starts (section 2).
Debug builds use `devApiUrl`; release builds always use `apiUrl` (production).

---

## 4. Local testing

All tests run only against this machine: the API tests refuse a remote database or any database other than
`dentor_test`, the browser suites refuse non-local addresses and always refuse the production hosts, the web
suite refuses a build with the production API address in it, and the device flows stop before typing a
password unless the app shows the debug-build "Demo" note. Never run any of them against production or
against a release build.

| What | Command | Needs | Latest result |
| --- | --- | --- | --- |
| API tests | `cd backend && uv run pytest -q` | MongoDB (uses its own `dentor_test` database) | ✅ 122 passed |
| Mobile typecheck | `cd mobile && npm run typecheck` | — | ✅ |
| Mobile unit tests | `cd mobile && npm test` | — | ✅ 23 / 23 |
| Clinic app, browser suite | `cd mobile && npm run e2e:owner` | API with demo data on :8000, `npm run web` in `apps/owner` | ✅ 60 / 60 |
| Consultant app, browser suite | `cd mobile && npm run e2e:consultant` | same, `apps/consultant` | ✅ 33 / 33 |
| Patient app, browser suite | `cd mobile && npm run e2e:patient` | same, `apps/patient` | ✅ 39 / 39 |
| Web type check / lint | `cd frontend && npx tsc -b` · `npm run lint` | — | ✅ (lint warnings only) |
| Web browser suite | `cd frontend && npm run e2e` | API on :8000, `VITE_API_BASE_URL= npx vite build` + `npx vite preview --port 5173 --strictPort` | ✅ 114 / 114 |
| Previous web release against the new API | `cd frontend && node e2e/previous-release.compat.mjs` | API, the previous release on :5174 (steps at the top of the file) | ✅ 7 / 7 |
| Device flows (Maestro) | `maestro test mobile/e2e/native/<app>.yaml` | [Maestro](https://maestro.mobile.dev), the debug build installed on an emulator / simulator, Metro, API | ⏸ passed on the same day's earlier builds; not repeated on the final builds |
| Upgrade check of a database (read-only) | `cd backend && MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=<local db> uv run python -m app.preflight` | a database | ✅ against a local test database, exit 0 (limits: section 10.1) |

Use a separate local database for test runs (`MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=dentor_test_run uv run uvicorn …`): the browser suites
create and remove records. Device flows clear the app's data on the device they run on; run them on an
emulator or simulator, not on a phone you use.

---

## 5. Android debug builds

| Step | Command | Output | Status |
| --- | --- | --- | --- |
| Build a debug APK | `cd mobile/apps/<app>/android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` | `mobile/apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk` (≈51 MB) | ✅ all three, 15 Oct 17:15–17:19 |
| All CPU types (for any device) | `./gradlew assembleDebug` | same path, larger | ⏸ |
| Install on the emulator | `adb -s emulator-5554 install -r <apk>` | — | ✅ (device flows) |
| Install on a USB phone | `adb devices` then `adb -s <serial> install -r <apk>` | — | ⏸ |
| Start an emulator | `$ANDROID_HOME/emulator/emulator -list-avds` then `$ANDROID_HOME/emulator/emulator -avd <name>` | — | ✅ |

A debug APK loads its JavaScript from Metro: start `npm start` in the app's folder and run
`adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:8000 tcp:8000` for the device. It is signed with the
public debug key (`android/app/debug.keystore`) and is for testing only.

Physical phone: enable Developer options › USB debugging, connect by cable, accept the prompt, check
`adb devices`. With several devices connected, use `-s <serial>` or set `ANDROID_SERIAL`.

---

## 6. Android release builds

### Two kinds of release build

| | Without an upload key | With the upload key |
| --- | --- | --- |
| Signed with | the public debug key | Dentor's upload key |
| Good for | installing and testing the release behaviour | Google Play |
| API | `apiUrl` in `env.json` (**production**) | same |

A release build carries its JavaScript (no Metro) and talks to the API in `apiUrl` of `env.json`, which is
the **production** API (`https://dentorapi.localappstore.in`). Release builds also refuse plain HTTP
(`usesCleartextTraffic` is false for release, true only for debug). Without the upload key, the build is
still a release build connected to production; only its signature differs. So:

- never run the test suites or device flows against a release build;
- never use the development demo logins with it (they don't exist in production and must not be created
  there);
- signing in at all means using a real production account; keep that to the smoke tests in section 10.5.

### Signing credentials (⛔ not in place yet)

All three apps read the upload key through one shared script, `mobile/signing/signing.gradle`. Put **your
existing** keystore and its settings in `mobile/signing/` (both git-ignored); the steps are in
[`mobile/signing/README.md`](../mobile/signing/README.md):

```
mobile/signing/
├── signing.gradle               (in git)  shared logic, no secrets
├── signing.properties.example   (in git)  the four names, empty
├── signing.properties           (ignored) DENTOR_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD
└── dentor-upload.jks            (ignored) your existing keystore, copied
```

Gradle properties (`~/.gradle/gradle.properties`, `-P`, `ORG_GRADLE_PROJECT_*`) still work and take precedence,
for CI or other machines; `DENTOR_SIGNING_PROPERTIES` can name a settings file elsewhere. Without any of them,
release builds use the public debug key. An incomplete setting stops release tasks (never debug builds). Do
not generate a new key for an app already on Google Play.

Raise the version for every upload in `mobile/apps/<app>/android/app/build.gradle`: `versionCode` (a whole
number, +1 each upload) and `versionName` (e.g. `1.0.1`). Both are `1` / `"1.0"` today.

### Commands

| Step | Command | Output | Status |
| --- | --- | --- | --- |
| Check `apiUrl` first | `cat mobile/apps/<app>/env.json` | must be the production HTTPS address | — |
| Release APK | `cd mobile/apps/<app>/android && ./gradlew assembleRelease` | `mobile/apps/<app>/android/app/build/outputs/apk/release/app-release.apk` | ⏸ built 13 Oct with the debug key (before the latest features); not re-run |
| Release AAB (Play Store) | `cd mobile/apps/<app>/android && ./gradlew bundleRelease` | `mobile/apps/<app>/android/app/build/outputs/bundle/release/app-release.aab` | ⛔ for Play (no upload key); the patient app's AAB was built with the debug key on 13 Oct |
| Check the signature (APK) | `$ANDROID_HOME/build-tools/37.0.0/apksigner verify --print-certs <apk>` | — | ⏸ |
| Check the signature (AAB) | `jarsigner -verify -verbose -certs <aab>` | — | ⏸ |
| Install a release APK | `adb -s <serial> install -r <apk>` (it is connected to production: only the section 10.5 smoke test with a real production account) | — | ⏸ |

Code shrinking (`enableProguardInReleaseBuilds`) is off; turning it on needs a full regression test.

---

## 7. iOS simulator builds

| Step | Command | Output | Status |
| --- | --- | --- | --- |
| Pods (once, and after dependency changes) | `cd mobile/apps/<app>/ios && pod install` | `ios/Pods`, `ios/<Scheme>.xcworkspace` | ✅ |
| Build, install and open (debug) | `cd mobile/apps/<app> && npm start` then `npm run ios` | — | ⏸ |
| Debug simulator build | `cd mobile/apps/<app>/ios && xcodebuild -workspace <Scheme>.xcworkspace -scheme <Scheme> -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build` | `mobile/apps/<app>/ios/build/Build/Products/Debug-iphonesimulator/<Scheme>.app` (≈87 MB) | ✅ all three, 15 Oct 17:16–17:20 |
| Install and open on the booted simulator | `xcrun simctl install booted <that .app>` then `xcrun simctl launch booted in.dentor.<app>` | — | ✅ (device flows) |
| Release simulator build (production API, no Metro) | same `xcodebuild` with `-configuration Release` | `…/Release-iphonesimulator/<Scheme>.app` | ⏸ built 13 Oct; not re-run |
| Open in Xcode | `open mobile/apps/<app>/ios/<Scheme>.xcworkspace` (the workspace, not the `.xcodeproj`) | — | ⏸ |

Simulator builds need no Apple account. Do not pass `CODE_SIGNING_ALLOWED=NO`: an unsigned app cannot use
the Keychain, where the apps keep the session. List simulators with `xcrun simctl list devices available`.

### CocoaPods troubleshooting

| Problem | Fix |
| --- | --- |
| `pod install` fails on a gem or Ruby version | `cd mobile/apps/<app>/ios && bundle install && bundle exec pod install` (uses the app's `Gemfile`) |
| "Unable to find a specification" / outdated spec repo | `pod repo update` (updates the shared spec repo), then `pod install` |
| Build errors after changing dependencies | `cd mobile/apps/<app>/ios && rm -rf Pods build && pod install` (this app only) |
| "The sandbox is not in sync with the Podfile.lock" | run `pod install` again |

---

## 8. iOS device and release builds

### What is needed (⛔ not available on this Mac yet)

| Needed | Why | Notes |
| --- | --- | --- |
| The Apple Developer team that owns or will own `in.dentor.owner`, `in.dentor.consultant`, `in.dentor.patient`, and its **Team ID** | signing for devices, TestFlight and the App Store | not known; not assumed |
| Your Apple ID added to that team (Admin or App Manager to archive and upload) | Xcode › Settings › Accounts | — |
| An **Apple Distribution** certificate (or automatic signing with enough rights) | archives for TestFlight / App Store | the Mac has only personal "Apple Development" certificates (one revoked); none were used |
| App IDs and provisioning profiles for the three bundle ids | created by Xcode's automatic signing or in the developer portal | none on this Mac |
| App Store Connect records for the three apps | uploading and review | — |

### Physical iPhone (debug) ⛔

1. Connect the iPhone, trust the Mac, enable Developer Mode on the phone (Settings › Privacy & Security).
2. `open mobile/apps/<app>/ios/<Scheme>.xcworkspace`, select the target `<Scheme>` › Signing & Capabilities,
   choose the team.
3. Start Metro (`npm start` in the app's folder), pick the iPhone in Xcode's toolbar, Product › Run.
4. The phone reaches the API only over the network: set `devApiUrl` in `env.json` to the Mac's LAN address
   and start the API with `--host 0.0.0.0` (don't commit that change).

A personal (free) team can sign only bundle ids not registered by someone else, so with `in.dentor.*`
you need the owning team; do not change the bundle ids to work around it.

### Archive and IPA ⛔ 🔒

```sh
cd mobile/apps/<app>/ios
xcodebuild -workspace <Scheme>.xcworkspace -scheme <Scheme> \
  -configuration Release -sdk iphoneos -archivePath build/<Scheme>.xcarchive \
  DEVELOPMENT_TEAM=<TEAMID> -allowProvisioningUpdates archive
# → mobile/apps/<app>/ios/build/<Scheme>.xcarchive

xcodebuild -exportArchive -archivePath build/<Scheme>.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates
# → mobile/apps/<app>/ios/build/ipa/<Scheme>.ipa
```

`ExportOptions.plist` (git-ignored; keep it next to the workspace):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>TEAMID</string>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
```

In Xcode instead: destination "Any iOS Device (arm64)", Product › Archive, then Organizer › Distribute App.
Before each upload raise `CURRENT_PROJECT_VERSION` (build number) and, for a new version,
`MARKETING_VERSION` (both `1` / `1.0` today) in the target's build settings. Neither a device build nor an
archive has ever been made; the first one may surface signing settings to fix.

### API URLs on iOS

Debug builds use `devApiUrl`, release builds `apiUrl` (`env.json`), so a Release build, including a
Release simulator build, talks to production. Debug and Release share the same transport settings in each
`Info.plist`: HTTPS everywhere (`NSAllowsArbitraryLoads = false`), plain HTTP only for local network
addresses (`NSAllowsLocalNetworking = true`). Reaching a Mac's LAN address over HTTP from a physical iPhone
has not been tried.

---

## 9. Web production build

```sh
cd frontend
npm run build               # type check (tsc -b), then vite build
```

| | |
| --- | --- |
| Output | `frontend/dist/`: `index.html`, `assets/` (content-hashed JS and CSS), `manifest.webmanifest`, `sw.js`, `favicon.svg`, `icons/` |
| API address in the bundle | `VITE_API_BASE_URL` from `frontend/.env.production` (`https://dentorapi.localappstore.in`); empty = same domain, with `/api` proxied by the web server |
| Status | ✅ 15 Oct (built, not deployed). The `frontend/dist/` on disk is that production build: it calls the production API, so rebuild with `VITE_API_BASE_URL=` before testing locally |
| Try it locally against the local API | `VITE_API_BASE_URL= npx vite build` then `npx vite preview --port 5173 --strictPort` ✅ |

Details: `WEB_BUILD.md`.

---

## 10. Production deployment

🔒 **Documentation only.** Nothing in this section has been run. The repository contains **no server
configuration** (no nginx file, service file, Docker file or deploy script), so the server parts below are
templates: replace the `<...>` placeholders with the real server's paths and names, and check them against
how production is set up today before using them. The application code does state that the API runs behind
a reverse proxy with uvicorn's `--proxy-headers` (`backend/app/security.py`).

### 10.1 Order and preparation

1. **Back up the production database** (e.g. `mongodump --uri "<production MONGO_URL>" --db <DB_NAME> --out <backup dir>`).
2. **Run the read-only upgrade check** against it and fix anything marked "FIX FIRST":
   `cd backend && MONGO_URL=<...> DB_NAME=<...> uv run python -m app.preflight`

   What it does and doesn't do (`backend/app/preflight.py`, checked): it only reads (`find`, `find_one`,
   `count_documents`; no writes, no index creation), and checks the demo logins' known passwords against the
   stored hashes on the machine it runs on. Limits:
   - its verdict depends on the environment it runs in. Demo logins with known passwords and `SEED_DEMO=1`
     are "FIX FIRST" only when `DENTOR_ENV=production`, and the SMS and push notes describe the settings of
     the machine running it. Run it **on the production server with the server's environment loaded**, or
     the result can look cleaner than it is;
   - it needs the database credentials; a database user with read-only rights is enough and safer;
   - it does not check the email service, the web app or the mobile apps;
   - exit code 0 = nothing to fix, 1 = something to fix, 2 = the database could not be read.
3. Deploy **the backend first**, then **the web app**, then the **mobile apps** (when the stores and outside
   services are ready). The new web app needs the new backend; the web app that is live today keeps
   working against the new backend (checked: previous-release suite 7 / 7).
4. Have the previous backend and web build at hand for a rollback (10.5).

### 10.2 Backend (API)

**Server requirements:** Python 3.12, MongoDB 6+ (reachable from the API, not from the internet), a reverse
proxy with HTTPS for `dentorapi.localappstore.in`, outbound HTTPS only if the email / SMS / push adapters
are used.

**Production environment** (`backend/.env` on the server or the service's environment; never in git):

| Variable | Required | Value |
| --- | --- | --- |
| `DENTOR_ENV` | yes | `production` (refuses to start with unsafe settings; turns off `/docs`) |
| `MONGO_URL`, `DB_NAME` | yes | the production database |
| `JWT_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`); changing it signs everyone out |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | yes | not the development default |
| `SEED_DEMO` | yes | `0` (never `1` in production) |
| `CORS_ORIGINS` | yes when the web app is on another domain | `https://dentor.localappstore.in` |
| `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` | for password reset by email and staff sign-up | `INTEGRATIONS.md` §1 |
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | for patient sign-up and codes | `INTEGRATIONS.md` §2 |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | optional | `INTEGRATIONS.md` §3 |
| `NOTIFICATION_RETENTION_DAYS`, `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES`, `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR` | optional | defaults 180, 30, 60, 300, 5 |

**Install and run (template):**

```sh
# on the server, in the deployed copy of backend/
uv sync --no-dev                                   # or: pip install -r requirements.txt (exported from uv.lock)
uv run --no-dev uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers
```

- Run **one** API process: sign-in rate limiting is kept in the process's memory. It must run continuously
  (it also sends scheduled offers every minute).
- Keep it running with the server's process manager (for example a systemd service with `Restart=always`
  and `EnvironmentFile=<path>/backend/.env`).
- Reverse proxy: forward everything under `/api` (including `PATCH`) to `127.0.0.1:8000`, and pass the
  caller's address, e.g. nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and
  `proxy_set_header X-Forwarded-Proto $scheme;`. Allow request bodies up to 16 MB (`client_max_body_size 16m;`).
- New collections and indexes are created at start-up; existing documents are not changed.

### 10.3 Web app

**Server requirements:** any static web server with HTTPS for `dentor.localappstore.in`.

**Build:** `cd frontend && npm run build` → `frontend/dist/` (section 9). Check that `frontend/.env.production`
has the right API address first.

**Hosting configuration (template, nginx):**

```nginx
server {
    server_name dentor.localappstore.in;
    root <web root>;                       # contents of frontend/dist
    location / { try_files $uri /index.html; }               # client-side routes
    location = /index.html { add_header Cache-Control "no-cache"; }
    location = /sw.js      { add_header Cache-Control "no-cache"; }   # releases are picked up
    location /assets/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
    # HTTPS (listen 443 ssl; certificates) as configured on the server today
}
```

**Deploy (template):** copy `frontend/dist/` to a new release folder on the server and switch the web root to
it (keep the previous folder for rollback), e.g. `rsync -a --delete frontend/dist/ <server>:<releases>/<date>/`
then point the web root (or a symlink) at it.

### 10.4 Mobile apps

Building a release artifact (an AAB or IPA, sections 6 and 8) does **not** publish anything. Publishing
means uploading it to Google Play Console or App Store Connect, testing it there (internal testing track,
TestFlight), and then releasing it to users. Store review takes from hours to days; a release reaches users
gradually and cannot be pulled back from phones that installed it. Before building, check `apiUrl` in each
`env.json`.

### 10.5 After deploying: smoke tests and rollback

**Smoke tests (read-only where possible):**

1. `curl https://dentorapi.localappstore.in/api/health` → `{"ok":true}`.
2. The web app loads, an administrator can sign in, and the main pages open.
3. The Super Admin console shows the overview and which services are connected (email, SMS, push).
4. The API's access log shows the callers' real addresses, not `127.0.0.1` on every line.
5. Mobile release builds: by hand, sign in with a real production account created for this purpose
   (never the development demo logins), open the main tabs, sign out. No automated test runs against
   production.

**Rollback:**

| What | How |
| --- | --- |
| Web app | point the web root back at the previous release folder; users get it on their next reload |
| Backend | restart the previous release with the same environment. The new release only adds collections and indexes, so the previous one runs on the same database; restore the backup only if data was damaged |
| Mobile apps | an installed version cannot be removed: halt a staged rollout in the store, then release a fixed version with a higher version number |

---

## 11. Store submission

| | Google Play | Apple App Store |
| --- | --- | --- |
| Account | Play Console developer account (Dentor) ⛔ | Apple Developer Program, organisation (Dentor) ⛔ |
| App entries | three apps: `in.dentor.owner`, `in.dentor.consultant`, `in.dentor.patient`; Play App Signing on | three App Store Connect records with the same bundle ids |
| Signing | the upload key (section 6) ⛔ | the team's distribution signing (section 8) ⛔ |
| Artifact | `app-release.aab` | `<Scheme>.ipa` (or upload from Xcode's Organizer) |
| Testing before release | internal testing track | TestFlight |
| Listing | names, descriptions, screenshots from a test server (never real patients), privacy-policy URL, data-safety form, content rating | names, descriptions, screenshots, privacy-policy URL, privacy labels, age rating, export compliance (HTTPS and Keychain only) |
| Review access | a reviewer account per app, created in production for the reviewers (not the development demo logins, which must not exist in production) | same; Apple also requires in-app account deletion (the patient app has it) |

Content Dentor must supply first (legal text, contacts, listings): `BUSINESS_CONTENT.md`. Push needs the
Firebase / APNs set-up in `INTEGRATIONS.md` §3 if it is to be included.

---

## 12. Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm error Missing script: "android"` (or `ios`, `web`) | run it in the app's folder: `cd mobile/apps/<app>` |
| Android build stops with "No space left on device" (often in `buildCMakeDebug[armeabi-v7a]`) | free disk space (3 GB+), use `npm run android -- --active-arch-only`, remove the failed build: `rm -rf mobile/apps/<app>/android/app/build mobile/apps/<app>/android/app/.cxx` |
| Gradle: "Unsupported class file major version" / wrong JDK | `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` |
| "SDK location not found" | `export ANDROID_HOME=$HOME/Library/Android/sdk` |
| Licences not accepted | `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses` |
| Red "Unable to load script" in a debug app | Metro is not running for that app: `npm start` in its folder; Android also `adb reverse tcp:8081 tcp:8081` |
| "A dev server is already running" but the wrong app opens | the running Metro belongs to another app: stop it and start `npm start` in the right app's folder |
| Port 8081 / 8000 / 5173 in use | another Metro, API or web server is running; stop it, or use another port (`npm start -- --port 8088` with `npm run android -- --port 8088`) |
| App says it cannot reach the server (Android) | API running? `adb reverse tcp:8000 tcp:8000` |
| App cannot reach the server (phone on Wi-Fi) | `devApiUrl` must be the Mac's LAN address, API started with `--host 0.0.0.0`, same network |
| `adb: more than one device/emulator` | add `-s <serial>` or set `ANDROID_SERIAL` |
| iOS: "Signing … requires a development team" | simulator builds need none; device builds and archives need the owning team (section 8) |
| iOS pods errors | section 7, "CocoaPods troubleshooting" |
| Stale JavaScript | `npm start -- --reset-cache` in the app's folder (clears the Metro cache shared with other projects, see section 12's table) |
| Web build stops with TypeScript errors | `cd frontend && npx tsc -b` shows them |
| Web: every request fails after deploying | check `VITE_API_BASE_URL` in the build and `CORS_ORIGINS` on the API |
| Web: old version keeps loading | the service worker updates on the next load; DevTools › Application › Service Workers › "Update on reload" |
| API refuses to start in production | `DENTOR_ENV=production` checks the settings: set a real `JWT_SECRET` and `SUPER_ADMIN_PASSWORD`, `SEED_DEMO=0` |

**Clean rebuild (this project's folders only; never delete shared caches such as `~/.gradle/caches`,
Xcode's whole DerivedData, `~/Library/Caches/CocoaPods` or `~/.npm`, which other projects use):**

```sh
cd mobile/apps/<app>/android && ./gradlew clean          # or: rm -rf app/build build app/.cxx .gradle
cd mobile/apps/<app>/ios && rm -rf build                 # if pods are broken: rm -rf Pods && pod install
cd frontend && rm -rf dist node_modules/.vite
```

Scope of each: `./gradlew clean` and the `rm -rf` lines remove only this repository's build output (for
Android also the libraries' `android/build` folders inside `mobile/node_modules`); `rm -rf Pods` removes one
app's pods; nothing touches MongoDB.

**Need your agreement first (they reach beyond Dentor):**

| Command | Effect outside this project |
| --- | --- |
| `npm start -- --reset-cache` | clears Metro's cache in `$TMPDIR/metro-cache`, which every React Native project of this user shares; harmless, but other projects' next Metro start is slower |
| `./gradlew --stop` | stops **every** Gradle background process of that Gradle version (9.4.1) on the Mac, including another project's build if it uses the same version |
| `pod repo update` | updates the CocoaPods spec repository in `~/.cocoapods`, shared by all projects |

---

## 13. Quick reference

| Task | Clinic (owner) | Consultant | Patient | Web |
| --- | --- | --- | --- | --- |
| Folder | `mobile/apps/owner` | `mobile/apps/consultant` | `mobile/apps/patient` | `frontend` |
| Install | `cd mobile && npm install` | ← same | ← same | `npm install` |
| Dev (browser) | `npm run web` (:8093) ✅ | `npm run web` (:8092) ✅ | `npm run web` (:8091) ✅ | `npm run dev` (:5173) ⏸ |
| Metro | `npm start` | `npm start` | `npm start` | — |
| Run on Android | `npm run android -- --active-arch-only` ⏸ | ← same | ← same | — |
| Run on iOS simulator | `npm run ios` ⏸ | ← same | ← same | — |
| Debug APK | `cd android && ./gradlew assembleDebug` ✅ | ✅ | ✅ | — |
| Debug APK path | `android/app/build/outputs/apk/debug/app-debug.apk` | ← same, per app | ← same | — |
| Simulator build | `xcodebuild … -scheme DentorOwner …` ✅ | `DentorConsultant` ✅ | `DentorPatient` ✅ | — |
| Release APK | `./gradlew assembleRelease` ⏸ | ⏸ | ⏸ | — |
| Play bundle | `./gradlew bundleRelease` ⛔ (upload key) | ⛔ | ⛔ | — |
| AAB path | `android/app/build/outputs/bundle/release/app-release.aab` | ← same | ← same | — |
| iOS archive / IPA | `xcodebuild … archive` / `-exportArchive` ⛔ (Apple team) | ⛔ | ⛔ | — |
| Production build | — | — | — | `npm run build` → `frontend/dist/` ✅ |
| Tests | `npm run e2e:owner` (in `mobile/`) ✅ | `npm run e2e:consultant` ✅ | `npm run e2e:patient` ✅ | `npm run e2e` ✅ |
| Deploy | Play / App Store ⛔ 🔒 | ⛔ 🔒 | ⛔ 🔒 | copy `dist/` to the web server 🔒 |

API for all of them: `cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`;
tests `uv run pytest -q` ✅.

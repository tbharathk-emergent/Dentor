# Building and running Dentor

Main guide for all four apps, including production deployment: [`BUILD_AND_DEPLOYMENT_GUIDE.md`](BUILD_AND_DEPLOYMENT_GUIDE.md).

Dentor is four apps on one API:

| App | Who uses it | Where it lives | How it ships |
| --- | --- | --- | --- |
| Reception app and Super Admin console | Clinic staff, platform owner | `frontend/` | Web (installable PWA) |
| Dentor (patient) | Patients | `mobile/apps/patient` | Android and iOS |
| Dentor Consultant | Visiting doctors | `mobile/apps/consultant` | Android and iOS |
| Dentor Clinic (folder `owner`; installs as "Dentor Owner") | Clinic owner, administrator, dentist, receptionist, accountant | `mobile/apps/owner` | Android and iOS |

The mobile apps are plain React Native 0.87.1 projects built with the React Native Community CLI
20.2, Gradle (Android) and Xcode with CocoaPods (iOS). Nothing uses Expo or Capacitor: there is no
Expo CLI, no EAS, no Expo Go, no `eas.json`, no Expo or Capacitor package in the dependency tree and
no Expo modules in the Podfiles or Gradle settings (checked on 15 October 2026). The web app in
`frontend/` is a Vite + React app; it has its own guide, [`WEB_BUILD.md`](WEB_BUILD.md). All four
apps on one page: [`BUILD_COMMANDS.md`](BUILD_COMMANDS.md).

The launcher name of the Clinic app is still "Dentor Owner" (`app_name` in
`android/app/src/main/res/values/strings.xml`, `CFBundleDisplayName` in `ios/DentorOwner/Info.plist`)
although the product is called Dentor Clinic; changing it is a store-listing decision and needs a
native rebuild. Application ids and bundle ids are not changed.

Every command below was run on macOS (Apple Silicon). Run them from the repository root
unless a `cd` says otherwise.

## The short version

```sh
# once
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
cd mobile && npm install && cd ..

# every day: the API first, each of these in its own terminal
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
cd frontend && npm run dev                      # web app on http://localhost:5173

# a mobile app (patient shown; consultant and owner are the same)
cd mobile/apps/patient && npm start             # terminal 1: Metro, the JavaScript server
cd mobile/apps/patient && adb reverse tcp:8000 tcp:8000 && npm run android    # terminal 2: Android
cd mobile/apps/patient/ios && pod install && cd .. && npm run ios             # terminal 2: iPhone simulator
```

The rest of this guide explains each step, release builds, tests and what to do when
something fails.

## 1. What you need installed

| Tool | Version used | Needed for |
| --- | --- | --- |
| Node.js | 24 (22.11 or newer) | everything |
| Python with `uv` | 3.12 | the API |
| MongoDB | 6 or newer, on `127.0.0.1:27017` | the API |
| JDK | 17 | Android builds |
| Android SDK | platform 37, build-tools 37.0.0, NDK 27.1.12297006 | Android builds (Gradle downloads a missing platform if its licence is accepted) |
| Xcode | 26 with an iOS simulator | iOS builds |
| CocoaPods | 1.17 | iOS builds |

This Mac's default `java` is JDK 21; React Native 0.87's Android build needs JDK 17. For Android,
point the shell at JDK 17 and the SDK before running Gradle:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Installing the native toolchains, if they are not there yet:

- **Android**: install Android Studio, then in its SDK Manager install "Android SDK Platform
  37", "Android SDK Build-Tools 37.0.0", "NDK (Side by side) 27.1.12297006", "CMake" and
  "Android SDK Command-line Tools". Create a virtual device in the Device Manager (any phone
  with a recent system image). No other native SDK is needed.
- **iOS**: install Xcode from the App Store, open it once to install the iOS platform and a
  simulator, then run `xcode-select --install` and `brew install cocoapods`.
- **Not needed and not used**: Expo, EAS, Expo Go.
- **Not installed yet**: the Firebase messaging SDK. It is only needed for push notifications
  and is added when the Firebase project exists (see `RELEASE_CHECKLIST.md`, section 3).

## 2. The API (needed by every app)

```sh
cd backend
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

In development the API seeds a demo clinic and these logins:

| App | Login | Password |
| --- | --- | --- |
| Reception app | `admin@dentor.in` | `Dentor@2026` |
| Super Admin console | `superadmin@dentor.in` | `SuperAdmin@2026` |
| Owner app | `owner@dentor.in` | `Owner@2026` |
| Consultant app | `kumar@dentor.in` | `Consultant@2026` |
| Patient app | mobile `9876543210` | `Patient@2026` |

These exist only where demo seeding is on. Production starts with none of them.

In development, one-time codes for the patient app are not sent by SMS: the API logs the
code and the app shows it on the code screen.

### API settings (environment variables)

Development needs none of these: the defaults are a local MongoDB and demo data. For a
server, copy `backend/.env.example` to `backend/.env` and fill it in; real environment
variables override the file. Never commit `backend/.env`.

| Variable | Default | What it does |
| --- | --- | --- |
| `DENTOR_ENV` | `development` | `production` turns on the safety checks and turns off the API docs page |
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | database server |
| `DB_NAME` | `dentor` | database name |
| `JWT_SECRET` | a development value | signs sessions; required in production, 32 characters or more (`openssl rand -hex 32`) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | `superadmin@dentor.in`, none | platform owner login; the password is required in production |
| `SEED_DEMO` | on in development, off in production | creates the demo clinic and demo logins; keep it off in production |
| `CORS_ORIGINS` | the local web and preview ports | the web app's address when it is served from another domain; phones need no entry |
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | `console` in development, off in production | one-time codes for the patient app; `webhook` sends each message to your SMS gateway |
| `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` | `console` in development, off in production | 4-digit email codes (password reset, staff sign-up) and application emails; `webhook` posts each email to your mail adapter (`INTEGRATIONS.md`) |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | off | `webhook` forwards notifications to your push adapter |
| `NOTIFICATION_RETENTION_DAYS` | `180` | notifications are deleted after this many days; `0` keeps them |
| `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES`, `JWT_EXPIRE_MINUTES` | `30`, `60`, `720` | how long sessions last |
| `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR` | `300`, `5` | lifetime of a one-time code, and codes per number per hour |
| `MAX_BODY_BYTES` | `16777216` | largest request the API accepts |

Before putting a new backend in front of an existing database, run the read-only check. It
lists every clinic and anything that must be fixed first, and changes nothing:

```sh
cd backend && uv run python -m app.preflight
```

## 3. Reception app and Super Admin console (web)

```sh
cd frontend
npm install
npm run dev          # http://localhost:5173, /api is proxied to the local API
npm run build        # type-checks, then writes the production site to frontend/dist
```

`npm run build` reads the API address from `frontend/.env.production`
(`VITE_API_BASE_URL`). Leave it empty when the web server proxies `/api` on the same domain.

The production build is an installable PWA: `manifest.webmanifest`, the icons in
`public/icons/` and the service worker `public/sw.js`. The service worker caches only the
app's own static files. It never answers `/api` requests, so nothing a clinic enters is
stored by it. Serve `sw.js` and `index.html` without long-lived caching so releases are
picked up; files under `/assets/` are content-hashed and can be cached for a year.

To try the production build locally against the local API:

```sh
cd frontend
VITE_API_BASE_URL= npx vite build --outDir /tmp/dentor-web --emptyOutDir
npx vite preview --outDir /tmp/dentor-web --port 5173 --strictPort
```

## 4. Mobile apps: set up once

```sh
cd mobile
npm install
```

`mobile/` is one npm workspace: the three apps in `apps/`, and `packages/shared` holding the
API client, session handling, navigation and UI kit they share. Dependencies install once,
into `mobile/node_modules`.

### Which API an app talks to

Each app has an `env.json`:

```json
{ "devApiUrl": "http://localhost:8000", "apiUrl": "https://dentorapi.localappstore.in" }
```

Debug builds use `devApiUrl`; release builds use `apiUrl`. Change `apiUrl` before a release
build if the production API moves. A release build cannot reach a plain `http://` address on
Android, and iOS allows `http://` only for local addresses.

`localhost` means the phone itself, so:

- **iOS simulator**: shares the Mac's network; `localhost:8000` works as is.
- **Android emulator or USB device**: run `adb reverse tcp:8000 tcp:8000` after it boots.
- **A phone on Wi-Fi**: set `devApiUrl` to the Mac's LAN address, and start the API with
  `--host 0.0.0.0`.

## 5. Mobile apps in a browser

Each app also builds for the browser with Vite and react-native-web: for fast previews, for the
end-to-end tests, and as the web versions of the apps (publishing them: [`WEB_APPS.md`](WEB_APPS.md)).

| App | Dev server | Port |
| --- | --- | --- |
| Patient | `npm run web --workspace apps/patient` (in `mobile/`), or `npm run web` in `mobile/apps/patient` | 8091 |
| Consultant | `npm run web --workspace apps/consultant`, or `npm run web` in `mobile/apps/consultant` | 8092 |
| Clinic (owner) | `npm run web --workspace apps/owner`, or `npm run web` in `mobile/apps/owner` | 8093 |

```sh
cd mobile
npm run build:web                               # all three, into apps/<app>/dist-web
npm run preview:web --workspace apps/owner      # serve one built app on its port
```

The browser build always talks to `http://localhost:8000` unless `DENTOR_API_URL` is set
when it is built or served. The API's development CORS list already allows these three ports.

## 6. Android

### Run a debug build on an emulator or device

```sh
cd mobile/apps/patient          # or consultant, owner
adb reverse tcp:8000 tcp:8000   # let the app reach the API on this Mac
npm start                       # Metro, the JavaScript dev server, on port 8081 (leave it running)
npm run android                 # in a second terminal: builds, installs and opens the app
```

Run one app's Metro at a time, or give the second one another port
(`npm start -- --port 8088` and `npm run android -- --port 8088`).

`npm run android` uses the emulator that is running, or the phone connected by USB with
"USB debugging" on. `adb devices` lists them; with more than one, add `-- --list-devices`
to choose from a list. To start an emulator from a terminal:
`$ANDROID_HOME/emulator/emulator -list-avds`, then `$ANDROID_HOME/emulator/emulator -avd <name>`.

The three apps install side by side. They are locked to portrait on phones and tablets.

### Build the APK yourself

```sh
cd mobile/apps/patient/android
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease        # app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease          # app/build/outputs/bundle/release/app-release.aab (Play Store)
```

Add `-PreactNativeArchitectures=arm64-v8a` to build for one CPU type only, which is quicker
and smaller while testing (an Apple Silicon emulator and current phones are arm64).

Outputs, per app (`<app>` is `owner`, `consultant` or `patient`), relative to `mobile/apps/<app>/android/`:

| Task | Output | Signed with |
| --- | --- | --- |
| `./gradlew assembleDebug` | `app/build/outputs/apk/debug/app-debug.apk` | the public debug key (`app/debug.keystore`) |
| `./gradlew assembleRelease` | `app/build/outputs/apk/release/app-release.apk` | the upload key if configured, otherwise the debug key |
| `./gradlew bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` | as above; Play accepts it only with the upload key |

Release builds bundle the JavaScript and talk to `apiUrl` in `env.json` (the production API).
Never sign in to a release build with test data. Each build needs about 2–3 GB of free disk
space while it runs; check `df -h /System/Volumes/Data` first. The debug APK loads its JavaScript from Metro. A release build carries its
JavaScript inside it and needs no dev server.

Install an APK with `adb install -r <path to apk>`.

### Signing a release for the Play Store

Without an upload key, release builds are signed with the debug key: fine for installing and
testing, refused by the Play Store. All three apps read the key through one shared script,
`mobile/signing/signing.gradle`. Copy your existing keystore to `mobile/signing/` and fill in
`mobile/signing/signing.properties` from `signing.properties.example`; both are git-ignored.
Steps, alternatives for CI and other machines, and the check: [`mobile/signing/README.md`](../mobile/signing/README.md).

Only if Dentor has no upload key yet, create one once (keep it and its passwords safe; losing it
blocks updates):

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore mobile/signing/dentor-upload.jks \
  -alias dentor-upload -keyalg RSA -keysize 2048 -validity 10000
```

`./gradlew bundleRelease` then produces a store-ready bundle. Raise `versionCode` in
`android/app/build.gradle` for every upload. To check which key signed a build:
`$ANDROID_HOME/build-tools/37.0.0/apksigner verify --print-certs <apk>` (for an AAB:
`jarsigner -verify -verbose -certs <aab>`).

**Not run for a store yet:** no upload key exists on the build Mac (the `DENTOR_UPLOAD_*` properties
are not set), so no Play-ready bundle has been produced. Requirements: `INTEGRATIONS.md`, section 5.

Application ids: `in.dentor.patient`, `in.dentor.consultant`, `in.dentor.owner`.

## 7. iOS

### Install the native dependencies (once, and after any dependency change)

```sh
cd mobile/apps/patient/ios      # or consultant, owner
pod install
```

Always open or build the `.xcworkspace` that this creates, not the `.xcodeproj`.

### Run a debug build on a simulator

```sh
cd mobile/apps/patient
npm start                       # Metro on port 8081 (leave it running)
npm run ios                     # in a second terminal: builds, installs and opens the app
```

`npm run ios` uses the simulator that is open, or starts one. To choose:
`npm run ios -- --simulator "iPhone 16"` (names from `xcrun simctl list devices available`).
The apps also run on iPad, in portrait.

### Open and run it in Xcode

```sh
cd mobile/apps/patient
npm start                               # Metro must be running for a debug build
open ios/DentorPatient.xcworkspace      # the workspace, not the .xcodeproj
```

In Xcode: choose the scheme `DentorPatient` and a simulator in the toolbar, then Product >
Run. For a real iPhone, select the target `DentorPatient`, open Signing & Capabilities, choose
your team, connect the phone and run. A phone reaches the API on your Mac only through the
Mac's network address: set `devApiUrl` in `env.json` to it (section 4).

### Build with xcodebuild yourself

```sh
cd mobile/apps/patient/ios
xcodebuild -workspace DentorPatient.xcworkspace -scheme DentorPatient \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build build

xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/DentorPatient.app
xcrun simctl launch booted in.dentor.patient
```

On Apple Silicon add `ARCHS=arm64 ONLY_ACTIVE_ARCH=YES` before `build` to compile for the
simulator's architecture only (quicker, less disk); the verified builds used it. The `.app` is at
`ios/build/Build/Products/Debug-iphonesimulator/<Scheme>.app`.

Use `-configuration Release` for a build that carries its JavaScript and needs no Metro (it then
talks to the production API).

Do not pass `CODE_SIGNING_ALLOWED=NO` for simulator builds. An unsigned app cannot use the
iOS Keychain, where the apps keep the signed-in session, so the user would be signed out on
every restart.

### Build for devices and the App Store

This needs an Apple Developer account. Replace `TEAMID` with the team's id:

```sh
cd mobile/apps/patient/ios
xcodebuild -workspace DentorPatient.xcworkspace -scheme DentorPatient \
  -configuration Release -sdk iphoneos -archivePath build/DentorPatient.xcarchive \
  DEVELOPMENT_TEAM=TEAMID -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath build/DentorPatient.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates
```

with an `ExportOptions.plist` such as:

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

The result is `build/ipa/DentorPatient.ipa`. Raise the build number
(`CURRENT_PROJECT_VERSION`) for every upload.

The same in Xcode: choose the destination "Any iOS Device (arm64)", then Product > Archive.
When the Organizer opens, Distribute App uploads to App Store Connect or exports an IPA.

**Cannot be run here yet:** neither a device build nor an archive has been made. Both need the
signing of the Apple Developer team that owns the `in.dentor.*` bundle ids; that team is not
known, and the build Mac has no Apple Distribution certificate or provisioning profiles. The
personal development certificates on the Mac were not used. Requirements: `INTEGRATIONS.md`,
section 6.

Workspace, scheme and bundle id per app:

| App | Workspace and scheme | Bundle id |
| --- | --- | --- |
| Patient | `DentorPatient` | `in.dentor.patient` |
| Consultant | `DentorConsultant` | `in.dentor.consultant` |
| Owner | `DentorOwner` | `in.dentor.owner` |

## 8. Tests

| What | Command | Needs |
| --- | --- | --- |
| API | `cd backend && uv run pytest -q` | MongoDB |
| Mobile type check (also checks the route tables are current) | `cd mobile && npm run typecheck` | nothing |
| Mobile unit tests (route tables, and consistency with the web app's colours, labels and formats) | `cd mobile && npm test` | the `frontend/` folder beside it |
| Mobile apps end to end, in a browser | `cd mobile && npm run e2e:patient` (also `e2e:consultant`, `e2e:owner`) | the API with demo data, and that app served on its port (section 5) |
| Web app type check and build | `cd frontend && npm run build` | nothing |
| Web app end to end | `cd frontend && npm run e2e` | the API with demo data, and the web app on port 5173 |
| The previous web release against this backend | `cd frontend && node e2e/previous-release.compat.mjs` (how to build the previous release is at the top of that file) | the API with demo data, the previous web app served on port 5174 |
| Upgrade check for an existing database (read-only) | `cd backend && uv run python -m app.preflight` | a database |
| Mobile apps on an emulator or simulator | `maestro test mobile/e2e/native/owner.yaml` (also `consultant.yaml`, `patient.yaml`, and on Android `consultant-back-guard.yaml`) | [Maestro](https://maestro.mobile.dev), the debug app installed, that app's Metro running on port 8081, the API with demo data |

The end-to-end tests create real records, so they only run against a local stack:

- The API tests refuse to start unless `MONGO_URL` is a MongoDB on this machine.
- The browser suites refuse an app or API address that is not on this machine, and always
  refuse the production hosts. `E2E_ALLOW_REMOTE=1` allows a test server.
- The native flows check for the "Demo …" note that only debug builds show, and stop before
  typing a password if it is missing. Never point them at a release build: release builds use
  the production API.

The native flows start by clearing the app's data on the device, so they also sign it out.
On iOS they clear the simulator's whole Keychain, which signs other apps on that simulator
out too.

Two more native flows check that deleting and reinstalling the iOS app does not bring back
the previous person's session (iOS keeps a deleted app's Keychain; the app clears it on the
first launch after an install). The steps are at the top of
`mobile/e2e/native/patient-reinstall.yaml`.

## 9. Adding or moving a mobile screen

Screens are the files under an app's `src/app/`. The folder path is the screen's path:

- `src/app/(app)/reports/[id].tsx` is the screen `/reports/<id>`.
- A folder in brackets, such as `(app)` or `(auth)`, groups screens by sign-in state and is
  not part of the path.
- Files in `(tabs)` are the bottom-tab screens. Their labels and icons are in `src/tabs.ts`.

After adding, renaming or removing a screen file, regenerate the app's route table and
commit the result:

```sh
cd mobile && npm run routes
```

Screens navigate with `useRouter()` from `@/nav` (`push`, `replace`, `back`) and read path
parameters with `useLocalSearchParams()`.

Launcher icons are generated from the Dentor mark by `node scripts/gen-icons.mjs`; run it
again only if the mark or an app's colours change.

## 9a. Clean rebuild (this project only)

These remove only Dentor's own build output. Do not delete shared caches (`~/.gradle/caches`,
`~/Library/Developer/Xcode/DerivedData` as a whole, `~/Library/Caches/CocoaPods`, `~/.npm`):
other projects on the Mac use them.

```sh
# Android, one app
cd mobile/apps/<app>/android
./gradlew clean                                   # or, if Gradle itself fails:
rm -rf app/build build app/.cxx .gradle           # this app's build folders only

# iOS, one app
cd mobile/apps/<app>/ios
rm -rf build                                      # the -derivedDataPath used above
rm -rf Pods && pod install                        # re-create this app's Pods (Podfile.lock is kept)
# If Xcode's own DerivedData is used (builds from the Xcode window), remove only this app's folder:
# ~/Library/Developer/Xcode/DerivedData/<Scheme>-<hash>

# JavaScript
cd mobile/apps/<app> && npm start -- --reset-cache   # Metro's cache: shared by all React Native projects on the Mac ($TMPDIR/metro-cache); ask first
cd mobile && rm -rf node_modules && npm ci           # this workspace's dependencies only
```

`./gradlew --stop` stops every Gradle daemon of that Gradle version on the Mac, including other
projects' builds; use it only when nothing else is building, and with the Mac owner's agreement.

## 10. When something goes wrong

- **The app opens to a red "Unable to load script" screen.** Metro is not running or not
  reachable. Start it with `npm start` in the app's folder; on Android also run
  `adb reverse tcp:8081 tcp:8081`.
- **Sign-in says it cannot reach the server on Android.** Run
  `adb reverse tcp:8000 tcp:8000` and check the API is running.
- **Port 8081 is in use.** Another Metro is running. Stop it, or use `--port` as in section 6.
- **`adb install` fails with "not enough space".** The emulator's storage is full. Remove
  unused apps from it or create a new virtual device.
- **iOS build fails after changing dependencies.** Run `pod install` again in the app's `ios/`.
- **Gradle fails with "Unsupported class file major version" or a JDK error.** The shell is using
  JDK 21 (this Mac's default). `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` and run again.
- **"SDK location not found".** `export ANDROID_HOME=$HOME/Library/Android/sdk` (or create
  `android/local.properties` with `sdk.dir=...`; it is git-ignored).
- **Licences not accepted.** `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses`.
- **`pod install` fails on Ruby gems.** Use the app's Gemfile: `bundle install` then
  `bundle exec pod install` in `mobile/apps/<app>/ios`; or `pod repo update` if a pod version is
  not found.
- **`npm run android` fails in `buildCMakeDebug[armeabi-v7a]` with "No space left on device".** Without a flag
  the CLI compiles the native code for all four CPU types. Use `npm run android -- --active-arch-only`
  (only the connected device's type, e.g. arm64-v8a), free disk space first, and remove the failed
  build's output: `rm -rf mobile/apps/<app>/android/app/build mobile/apps/<app>/android/app/.cxx`.
- **"No space left on device" or a build stops half-way.** Check `df -h /System/Volumes/Data`;
  each native build needs 2–3 GB free while it runs. Free space with the project-only commands in
  section 9a, not by deleting shared caches.
- **Xcode: "Signing for <Scheme> requires a development team".** Simulator builds need none; a
  device build or archive needs the owning team (section 7).
- **A new screen does not open.** Run `npm run routes` (section 9).
- **Stale JavaScript after switching branches.** `npm start -- --reset-cache`.
- **A native smoke test taps the wrong thing near the bottom of the screen.** In debug builds
  a dark "Open debugger to view warnings" bar appears over the tab bar whenever the app has
  logged a warning. Tap it to read the warning in DevTools, fix the cause, and run the test
  again.

## 11. What needs an account or a service that is not in this repository

- **Play Store release**: the upload key (section 6) and a Play Console account.
- **App Store and physical iPhones**: an Apple Developer team (section 7).
- **SMS one-time codes in production**: an SMS gateway. Set `SMS_PROVIDER=webhook`,
  `SMS_WEBHOOK_URL` and `SMS_WEBHOOK_TOKEN` on the API. Until then, sign-up, code login and
  password reset by code are refused in production; password login works.
- **Push notifications**: a push service (Firebase Cloud Messaging and APNs). The API
  forwards notifications to `PUSH_WEBHOOK_URL` when `PUSH_PROVIDER=webhook`, and the apps
  have one place to hand over the device token (`setPushTokenProvider` in
  `mobile/packages/shared/src/push.ts`). Until both are connected, notifications appear in
  the apps' notification screens only.

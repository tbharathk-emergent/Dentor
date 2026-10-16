# Build commands: all four Dentor apps

The main guide, with local development, testing, release builds and production deployment, is
[`BUILD_AND_DEPLOYMENT_GUIDE.md`](BUILD_AND_DEPLOYMENT_GUIDE.md). This page is the command table.

For developers building Dentor on a Mac (Apple Silicon). One page per question "how do I build X";
details and explanations are in [`MOBILE_BUILD.md`](MOBILE_BUILD.md) (the three native apps) and
[`WEB_BUILD.md`](WEB_BUILD.md) (the web app). Nothing here deploys anything.

## What each app is built with (checked in the repository on 15 October 2026)

| # | App | Path | Framework | Native ids |
| --- | --- | --- | --- | --- |
| 1 | Dentor Clinic (Owner; installs as "Dentor Owner") | `mobile/apps/owner` | React Native 0.87.1, React Native Community CLI 20.2, Gradle 9.4.1, Xcode + CocoaPods | Android `in.dentor.owner`; iOS `in.dentor.owner`, workspace and scheme `DentorOwner` |
| 2 | Dentor Consultant | `mobile/apps/consultant` | same | `in.dentor.consultant`; `DentorConsultant` |
| 3 | Dentor (patient) | `mobile/apps/patient` | same | `in.dentor.patient`; `DentorPatient` |
| 4 | Web reception + Super Admin console | `frontend/` | React 19 + Vite 8 + Tailwind 4 (a web app, installable PWA) | — |

**Expo is not used anywhere in the build path**, and neither is Capacitor: no Expo or EAS package in
any `package.json` or lockfile, no `eas.json`, no Expo modules in the Podfiles or Gradle settings; the
app scripts call `react-native start / run-android / run-ios`. The three mobile apps share
`mobile/packages/shared` and one npm workspace (`mobile/`).

**Latest native run (15 Oct 2026, 17:14–17:20), on the final code, 8.3 GB free:** all six debug builds
succeeded with the commands below: Android `assembleDebug -PreactNativeArchitectures=arm64-v8a` for the
Clinic (owner), Consultant and patient apps (APKs about 51 MB each), and the iOS Debug simulator
`xcodebuild` for `DentorOwner`, `DentorConsultant` and `DentorPatient` (about 87 MB each, BUILD
SUCCEEDED). Device flows (Maestro) were **not** re-run on these builds: the developer's own Metro (port
8081) and API (port 8000) were running at the time, and the flows would have stopped that Metro and written
test records into that API's database. An earlier `npm run android` by the developer (all four CPU types)
failed with "No space left on device" when the disk was nearly full; it was not a project error.

Legend for the **Verified** column: ✅ run on this Mac on 15 Oct 2026 and succeeded · ⏸ correct per
the scripts and project files, not re-run on 15 Oct (reason given) · ⛔ cannot be run yet (blocker
given).

## Prerequisites (once)

| Tool | Version | For |
| --- | --- | --- |
| Node.js | 22.11+ (24 used) | all |
| JDK | **17** (the Mac's default is 21) | Android |
| Android SDK | platform 37, build-tools 37.0.0, NDK 27.1.12297006, an emulator | Android |
| Xcode | 26 (26.2 used), an iOS simulator | iOS |
| CocoaPods | 1.17 | iOS |
| Python 3.12 + `uv`, MongoDB on 127.0.0.1:27017 | | the API, for local testing |

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Free disk space: about 2–3 GB per native build while it runs. Check first: `df -h /System/Volumes/Data`.

### Environment and settings

| Where | Setting | Effect |
| --- | --- | --- |
| `mobile/apps/<app>/env.json` | `devApiUrl` (`http://localhost:8000`), `apiUrl` (`https://dentorapi.localappstore.in`) | debug builds use `devApiUrl`, release builds `apiUrl` (production) |
| shell, when building the mobile apps for the browser | `DENTOR_API_URL` | API for the browser builds (default `http://localhost:8000`) |
| `frontend/.env.development` / `.env.production` | `VITE_API_BASE_URL` | empty (dev proxy) / `https://dentorapi.localappstore.in` |
| `~/.gradle/gradle.properties` (never the repository) | `DENTOR_UPLOAD_STORE_FILE`, `DENTOR_UPLOAD_STORE_PASSWORD`, `DENTOR_UPLOAD_KEY_ALIAS`, `DENTOR_UPLOAD_KEY_PASSWORD` | Play-ready signing; without them release builds use the debug key |
| `backend/.env` | see `MOBILE_BUILD.md` section 2 | the API |

## Dependencies

| Step | Command | Verified |
| --- | --- | --- |
| Mobile workspace (all three apps) | `cd mobile && npm install` (or `npm ci`) | ⏸ installed earlier; not re-run |
| iOS pods, per app | `cd mobile/apps/<app>/ios && pod install` | ✅ first pass (all three) |
| Web | `cd frontend && npm install` (or `npm ci`) | ⏸ installed earlier; not re-run |
| API | `cd backend && uv sync` | ⏸ installed earlier |

## Apps 1–3: native mobile apps

Replace `<app>` with `owner`, `consultant` or `patient`, and `<Scheme>` with `DentorOwner`,
`DentorConsultant` or `DentorPatient`.

| Task | Command | Output | Verified |
| --- | --- | --- | --- |
| Metro (JS server for debug builds) | `cd mobile/apps/<app> && npm start` | :8081 | ✅ used by the device flows |
| Browser dev server | `cd mobile/apps/<app> && npm run web` | Clinic :8093, Consultant :8092, patient :8091 | ✅ |
| Browser production build | `cd mobile && npm run build:web` | `mobile/apps/<app>/dist-web/` | ✅ |
| Typecheck, unit tests | `cd mobile && npm run typecheck && npm test` | — | ✅ (23 / 23) |
| Android debug, build + install + run | `cd mobile/apps/<app> && adb reverse tcp:8000 tcp:8000 && npm run android -- --active-arch-only` (builds only the connected phone's CPU type; without the flag all four are compiled, about 4× the disk and time) | installs on the running emulator / USB device | ⏸ the same Gradle task was run directly (next row) |
| Android debug APK | `cd mobile/apps/<app>/android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (drop the flag for all CPU types) | `mobile/apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk` | ✅ all three, re-run on the final code 15 Oct 17:15–17:19 |
| Install a built APK | `adb install -r mobile/apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk` | — | ✅ (device flows) |
| Android release APK (debug-key signed without an upload key) | `cd mobile/apps/<app>/android && ./gradlew assembleRelease` | `…/app/build/outputs/apk/release/app-release.apk` | ⏸ succeeded 13 Oct (before phases 0–9); not re-run: no upload key, little disk |
| Android release AAB for Google Play | set the four `DENTOR_UPLOAD_*` properties, then `cd mobile/apps/<app>/android && ./gradlew bundleRelease` | `…/app/build/outputs/bundle/release/app-release.aab` | ⛔ no upload key / Play account (`INTEGRATIONS.md` §5) |
| iOS simulator, build + install + run | `cd mobile/apps/<app> && npm run ios` (or `npm run ios -- --simulator "iPhone 16"`) | — | ⏸ the same build was run with xcodebuild (next row) |
| iOS simulator build | `cd mobile/apps/<app>/ios && xcodebuild -workspace <Scheme>.xcworkspace -scheme <Scheme> -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build` | `mobile/apps/<app>/ios/build/Build/Products/Debug-iphonesimulator/<Scheme>.app` | ✅ all three, re-run on the final code 15 Oct 17:16–17:20 |
| Install and launch on the booted simulator | `xcrun simctl install booted <that .app>` then `xcrun simctl launch booted in.dentor.<app>` | — | ✅ (device flows) |
| iOS on a physical iPhone | open `mobile/apps/<app>/ios/<Scheme>.xcworkspace` in Xcode, choose the team, run | — | ⛔ needs the owning Apple team |
| iOS archive | `cd mobile/apps/<app>/ios && xcodebuild -workspace <Scheme>.xcworkspace -scheme <Scheme> -configuration Release -sdk iphoneos -archivePath build/<Scheme>.xcarchive DEVELOPMENT_TEAM=<TEAMID> -allowProvisioningUpdates archive` | `…/ios/build/<Scheme>.xcarchive` | ⛔ Team ID unknown; no distribution certificate (`INTEGRATIONS.md` §6) |
| iOS IPA export | `xcodebuild -exportArchive -archivePath build/<Scheme>.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates` (plist template in `MOBILE_BUILD.md` §7; git-ignored) | `…/ios/build/ipa/<Scheme>.ipa` | ⛔ as above |
| Device flows (Maestro) | `maestro test mobile/e2e/native/<app>.yaml` (debug build installed, Metro running, API on :8000) | — | ⏸ passed on earlier builds the same day (Clinic and Consultant on Android and iPhone in the second pass, patient in the first); not re-run on the final builds (see above) |
| Browser suites | `cd mobile && npm run e2e:owner` (also `e2e:consultant`, `e2e:patient`) | — | ✅ 60 / 33 / 39 |

Clean rebuild of one app (project folders only, never shared caches):

```sh
cd mobile/apps/<app>/android && ./gradlew clean          # or: rm -rf app/build build app/.cxx .gradle
cd mobile/apps/<app>/ios && rm -rf build                 # and, if pods are broken: rm -rf Pods && pod install
cd mobile/apps/<app> && npm start -- --reset-cache       # Metro (clears a cache shared with other RN projects; ask first)
```

## App 4: web reception + Super Admin console

| Task | Command | Output | Verified |
| --- | --- | --- | --- |
| Dev server (with the API on :8000) | `cd frontend && npm run dev` | http://localhost:5173 | ⏸ not re-run on 15 Oct (the preview below was used) |
| API + web together | `npm run dev` at the repository root | — | ⏸ |
| Type check | `cd frontend && npx tsc -b` | — | ✅ |
| Lint | `cd frontend && npm run lint` | — | ✅ (warnings only) |
| **Production build** | `cd frontend && npm run build` (or `npm run build` at the root) | `frontend/dist/` (talks to `https://dentorapi.localappstore.in`) | ✅ — not deployed |
| Build against the local API | `cd frontend && VITE_API_BASE_URL= npx vite build` | `frontend/dist/` | ✅ |
| Preview a build | `cd frontend && npx vite preview --port 5173 --strictPort` | http://localhost:5173 (proxies /api to :8000) | ✅ |
| Browser suite | `cd frontend && npm run e2e` | — | ✅ 114 / 114 |
| Clean | `cd frontend && rm -rf dist node_modules/.vite` | — | ⏸ |

## Common errors

| Error | Fix |
| --- | --- |
| Gradle: "Unsupported class file major version" / JDK mismatch | `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` |
| "SDK location not found" | `export ANDROID_HOME=$HOME/Library/Android/sdk` |
| Licences not accepted | `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses` |
| `pod install` gem or version errors | `cd mobile/apps/<app>/ios && bundle install && bundle exec pod install`, or `pod repo update` |
| Red "Unable to load script" in a debug app | Metro is not running: `npm start`; Android also `adb reverse tcp:8081 tcp:8081` |
| Android app cannot reach the API | `adb reverse tcp:8000 tcp:8000` |
| Port 8081 in use | another Metro is running; stop it or use `--port` |
| Build stops, "No space left on device" | check `df -h /System/Volumes/Data`; free this project's build folders (above), not shared caches |
| Xcode asks for a development team | simulator builds need none; device builds and archives need the owning team |
| Web build: TypeScript errors | `npx tsc -b` shows them; fix and rebuild |

More: `MOBILE_BUILD.md` section 10 and `WEB_BUILD.md` section 7.

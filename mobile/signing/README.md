# Release signing for the three Android apps

One keystore and one settings file, used by Dentor Clinic (`apps/owner`), Dentor Consultant
(`apps/consultant`) and Dentor (`apps/patient`). The logic is in `signing.gradle`, which each app's
`android/app/build.gradle` loads.

| File | In git | What it is |
| --- | --- | --- |
| `README.md` | yes | this page |
| `signing.gradle` | yes | where the key comes from (no secrets) |
| `signing.properties.example` | yes | the four setting names, empty |
| `signing.properties` | **no** (git-ignored) | your values |
| `dentor-upload.jks` (or your file's name) | **no** (`*.jks` is git-ignored) | your existing keystore, copied here |

Debug builds always use React Native's public debug key and are not affected by anything here.

## Set up (once per machine)

```sh
cd mobile/signing
cp /path/to/your-existing.jks dentor-upload.jks            # a copy; the original stays where it is
cp signing.properties.example signing.properties
open -e signing.properties                                  # fill in the values (below), save
chmod 600 signing.properties dentor-upload.jks
git status --short .                                        # must NOT list signing.properties or the .jks
```

`signing.properties`:

```properties
DENTOR_UPLOAD_STORE_FILE=dentor-upload.jks     # relative to this folder, absolute, or ~/...
DENTOR_UPLOAD_STORE_PASSWORD=<keystore password>
DENTOR_UPLOAD_KEY_ALIAS=<your existing alias>
DENTOR_UPLOAD_KEY_PASSWORD=<key password>
```

Use the values from your existing signing file; keep the alias it already uses. To see the alias:
`keytool -list -keystore dentor-upload.jks` (asks for the keystore password; prints the alias, not secrets).

## Check (builds nothing, prints no password)

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17) ANDROID_HOME=$HOME/Library/Android/sdk
for app in owner consultant patient; do
  (cd ../apps/$app/android && ./gradlew -q :app:signingReport | grep -A6 '^Variant: release$')
done
```

Pass: for all three, `Config: release`, the keystore under `mobile/signing/`, your alias, and the same
`SHA-256` line. A wrong password shows `Error: Failed to read key … from store` instead of the SHA-256.

## Build

```sh
cd mobile/apps/<app>/android         # owner, consultant or patient
./gradlew assembleRelease            # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease              # → app/build/outputs/bundle/release/app-release.aab
```

Each release build is also copied, with a clear name, to `mobile/release-builds/<App name>/`
(git-ignored), e.g. `mobile/release-builds/Dentor-Clinic-Owner/Dentor-Clinic-Owner-v1.0-1-20261016-1108.apk`.
Every build adds new time-stamped files; old ones are kept. A build signed with the public debug key gets
`-DEBUG-KEY` in its name. (`mobile/scripts/release-output.gradle`.)

Release builds talk to the **production** API (`apiUrl` in the app's `env.json`).

## Other machines and CI

Each machine needs its own copy of the two files here. Alternatives, in the order they win:

1. Gradle properties: the four names in `~/.gradle/gradle.properties` (write the keystore path in full;
   `~` and `$HOME` are not expanded there), `-P` options, or `ORG_GRADLE_PROJECT_<NAME>` environment
   variables (handy for CI secrets).
2. `DENTOR_SIGNING_PROPERTIES=/path/to/a/signing.properties`: a settings file anywhere; a relative keystore
   path is then read from that file's folder.
3. `mobile/signing/signing.properties`.

Without any of them, release builds are signed with the public debug key (installable, not accepted by
Google Play). A setting that is present but incomplete, or a keystore that is not found, stops release
builds with a message naming what is missing; debug builds carry on.

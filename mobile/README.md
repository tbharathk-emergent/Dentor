# Dentor mobile apps

Three React Native apps in one npm workspace, sharing one package. They are built with the
React Native Community CLI and native Android and iOS projects. Expo is not used.

```
mobile/
  apps/patient      Dentor              in.dentor.patient      patients
  apps/consultant   Dentor Consultant   in.dentor.consultant   doctors and visiting consultants
  apps/owner        Dentor Clinic       in.dentor.owner        the clinic: owner, administrators, dentists, reception, accountants
  packages/shared   @dentor/shared: API client, session, navigation, theme, UI kit, shared screens
  scripts/          route table generator, icon generator, shared Vite config
  e2e/              browser end-to-end tests, and native smoke tests in e2e/native
  tests/            unit tests: the route table, and consistency with the web app and the API
```

All three talk to the same FastAPI backend as the reception web app (`backend/`), through
role-scoped endpoints documented in [`docs/MOBILE_API.md`](../docs/MOBILE_API.md).

**Building and running** (browser, Android, iOS, release builds, signing, tests) is in
[`docs/MOBILE_BUILD.md`](../docs/MOBILE_BUILD.md). What is still needed before a store
release is in [`docs/RELEASE_CHECKLIST.md`](../docs/RELEASE_CHECKLIST.md). The short version:

```sh
cd mobile && npm install                     # once
npm run web --workspace apps/patient         # in a browser, http://localhost:8091

cd apps/patient
npm start                                    # Metro, then in a second terminal:
npm run android                              # or: npm run ios (after `pod install` in ios/)
```

## How an app is put together

Each app has the same layout:

```
apps/<app>/
  android/  ios/        native projects (Gradle, Xcode)
  index.js              native entry point
  index.web.tsx         browser entry point (index.html, vite.config.mjs)
  env.json              API address for debug and release builds
  src/App.tsx           providers, and which group of screens the session may see
  src/app/              the screens, one file each (see "Screens and navigation")
  src/routes.gen.ts     route table generated from src/app (committed)
  src/nav.ts            the one place screens import navigation from
  src/config.ts         API address
  src/components/  src/hooks/  src/lib/     everything that is not a screen
```

Code inside an app imports its own files as `@/…` (meaning `src/…`). The alias is declared
three times, once per tool: `tsconfig.json`, `metro.config.js` and `scripts/vite-app.mjs`.

A file named `x.web.ts` replaces `x.ts` in the browser build, for example
`packages/shared/src/storage.web.ts` (localStorage) beside `storage.ts` (Keychain / Keystore).

## Screens and navigation

Navigation is React Navigation, wrapped by `packages/shared/src/navigation` so that a screen
is just a file:

- `src/app/(app)/reports/[id].tsx` is the screen `/reports/<id>`. Read `id` with
  `useLocalSearchParams()`.
- A folder in brackets is a group and is not part of the path. The first group says which
  session state may see the screen: `App.tsx` mounts only one group at a time, so a
  signed-out user cannot reach a signed-in screen by any path or link.
- Files in `(tabs)` are the bottom-tab screens. Their order, labels and icons are in
  `src/tabs.ts`.
- `_layout.tsx` files are ignored. Side effects for the signed-in area belong in `App.tsx`.

After adding, renaming or removing a screen file run `npm run routes` and commit
`routes.gen.ts`. `npm run typecheck` fails if a route table is out of date.

Screens navigate with `useRouter()` from `@/nav`: `push`, `replace`, `back`, `canGoBack`,
with a path (`'/reports/42'`) or a pattern and its parameters
(`{ pathname: '/reports/[id]', params: { id } }`).

## Conventions

- **Sign-in gating** is in `App.tsx`. Screens never check the session to decide whether they
  may render.
- **Data** goes through `api` from `@dentor/shared` inside `@tanstack/react-query` hooks.
  Never call `fetch` directly; never store tokens yourself. Invalidate the affected query
  keys after a mutation.
- **Every data screen** shows loading, empty and error states: use `QueryState`,
  `SkeletonList`, `EmptyState`, `ErrorState`. Mutations disable their button while pending
  (`<Button loading>`), report failures with `useToast().error(err)`, and confirm destructive
  actions with `ConfirmSheet`.
- **Layout** uses `Screen` (header, safe areas, keyboard, pull-to-refresh, pinned footer).
  Primary actions on forms go in `Screen`'s `footer` so they stay above the keyboard and the
  home indicator. No fixed heights on text containers; long text must wrap or truncate with
  `numberOfLines`. Touch targets are at least 44 pt.
- **Look** comes from `@dentor/shared` theme tokens (`colors`, `space`, `radius`, `font`) and
  kit components. Do not hard-code colours or font sizes in screens: a design pass should be
  a change to the theme and kit, not to every screen.
- **The same as the reception web app.** Colours (`theme.ts`), which status gets which colour
  (`status.ts`), money, date and time formats (`format.ts`) and input checks (`validation.ts`)
  in `packages/shared/src` repeat the web app's and the API's. `npm test` compares them with
  the web app's sources when `frontend/` is checked out next to `mobile/`; change the two
  together, and show a status with `StatusBadge` rather than a colour chosen on the screen.
- **Icons** are `Feather` (and `MaterialDesignIcons` for the tooth mark) from
  `@dentor/shared`. Android bundles the fonts automatically; iOS lists them in `Info.plist`
  (`npx rnvi-update-plist package.json ios/<App>/Info.plist`, then `pod install`, after
  adding an icon family); the browser build loads them in `packages/shared/src/web.tsx`.
- **Native-only code** stays behind one file with a `.web.ts` twin, as `src/lib/pickers.ts`
  does in the patient app (photo and PDF picking).
- **Phones and tablets, portrait only.** Android locks it in `AndroidManifest.xml`, iOS in
  `Info.plist` (iPhone and iPad). `Screen` keeps content in a readable centred column on
  tablets (`CONTENT_MAX_WIDTH`); do not build a separate tablet layout per screen.
- **The session lives in the Keychain (iOS) or Keystore (Android)**, through `loadItem` /
  `saveItem` in `packages/shared/src/storage.ts`. iOS keeps a deleted app's Keychain, so that
  file clears it on the first launch after an install: a reinstall always starts signed out.
- **A screen whose back button does more than leave** (an unsaved form, a step in a flow)
  passes `onBack` to `Screen`; the Android back button then does the same and the iOS edge
  swipe is switched off for that screen.
- **Test hooks**: interactive elements carry a stable `testID`. It is `data-testid` in the
  browser, the accessibility identifier on iOS and the resource id on Android, so one id
  serves the browser tests and the native smoke tests.

## UI kit (`@dentor/shared`)

`Screen`, `Section`, `ListRow`, `KeyValue`, `IconTile`, `HeaderAction` · `T` (text), `Button`,
`IconButton`, `TextField`, `Card`, `Divider`, `Row`, `Badge`, `StatusBadge`, `Avatar`, `Chip`,
`Segmented`, `Banner`, `Icon` · `Loading`, `Skeleton`, `SkeletonList`, `EmptyState`,
`ErrorState`, `QueryState`, `ToothMark` · `Sheet`, `ConfirmSheet`, `useToast` · `StatTile`,
`TileGrid`, `ProgressBar`, `BarList`, `MiniBars` · `BottomBar` (tab bar with optional raised
centre action) · `AppNavigator`, `useRouter`, `useLocalSearchParams`, `useFocusEffect` ·
screens `StaffLoginScreen`, `NotificationsScreen`, `ChangePasswordScreen` · helpers `fmtINR`,
`fmtINRCompact`, `fmtDate`, `fmtTime`, `fmtDateTime`, `timeAgo`, `todayISO`, `addDays`,
`fmtDayShort`, `fmtFileSize`, `initials`, `qs`, `errorMessage`, `statusTone`, `leadStageTone`,
`roleTone`, `riskTone`, `toothLook`, `EMAIL_PATTERN`, `normalizeMobile`, `mobileProblem`.

## Design status

Each app takes its look from its Figma design (`docs/design/`): teal for the patient app,
navy and gold for the Consultant app, red for the Owner app (the design's Clinic app). An
app's colours, fonts, type sizes and header style are in its `src/brand.ts`, loaded before
anything else by `index.js` and `index.web.tsx`; the shared kit reads them through
`packages/shared/src/theme.ts`. The design fonts are in `packages/shared/assets/fonts` and
bundled by Android (an extra asset folder in each `android/app/build.gradle`), iOS (Resources
and `UIAppFonts`) and the browser builds (`packages/shared/src/web.tsx`); a new font must be
added in all three. Artwork exported from the designs is in each app's `src/assets/design`.
What each designed workflow became — screens, API, tests, and the frames left unbuilt because of
agreed exclusions — is in [`../docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md); the
original frame-by-frame comparison is in [`../docs/DESIGN_REVIEW.md`](../docs/DESIGN_REVIEW.md).

Shared screens live in `packages/shared/src/screens` (staff login, forgot password, sign-up, first-launch
welcome and permissions, and in `engage/` support tickets, chat, help, legal pages, notification settings,
wallet, plans, store, jobs, the logout dialog and the rating sheet). The Clinic app keeps its own data
layer in `apps/owner/src/clinic/` (appointments and patients, consultant bookings, clinical work, accounts).

# Building the web app: reception app and Super Admin console

Main guide for all four apps, including production deployment: [`BUILD_AND_DEPLOYMENT_GUIDE.md`](BUILD_AND_DEPLOYMENT_GUIDE.md).

For developers building or testing the web app. Quick reference for all four apps:
[`BUILD_COMMANDS.md`](BUILD_COMMANDS.md). Nothing in this guide deploys anything.

| | |
| --- | --- |
| Path | `frontend/` |
| Framework | React 19 + TypeScript, built with Vite 8 and Tailwind CSS 4. Not React Native, not Expo, not Capacitor. |
| What it is | The clinic reception app and, for the platform owner, the Super Admin console at `/platform`. One app; an installable PWA. |
| Output | static files in `frontend/dist/` |
| API | the FastAPI backend in `backend/` (see `MOBILE_BUILD.md` section 2) |

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 22.11 or newer (24 used) | `node -v` |
| npm | comes with Node | `npm -v` |
| The API, for local use | Python 3.12 with `uv`, MongoDB on `127.0.0.1:27017` | `cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` |

### Environment variables (build time)

The only build setting is the API address, baked into the bundle by Vite. It is a public value,
not a secret.

| File | `VITE_API_BASE_URL` | Used by |
| --- | --- | --- |
| `frontend/.env.development` | empty: requests stay relative and the dev server proxies `/api` to `http://127.0.0.1:8000` | `npm run dev` |
| `frontend/.env.production` | `https://dentorapi.localappstore.in` (the production API) | `npm run build` |

A variable set in the shell wins over the file, e.g. `VITE_API_BASE_URL= npx vite build` for a build
that talks to whatever serves it. Leave it empty in production when the web server proxies `/api` on the
same domain.

## 2. Install dependencies

```sh
cd frontend
npm install          # or `npm ci` for an exact install from package-lock.json
```

Only for the browser tests: `npx playwright install chromium` (once; Playwright is a dev dependency).

## 3. Local development

```sh
# terminal 1: the API
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# terminal 2: the web app with hot reload
cd frontend && npm run dev            # http://localhost:5173 ; /api is proxied to 127.0.0.1:8000
```

From the repository root, `npm run dev` starts both (it uses `concurrently`, installed by `npm install`
at the root).

Development logins (only where demo data is seeded, never in production): reception
`admin@dentor.in` / `Dentor@2026`; Super Admin `superadmin@dentor.in` / `SuperAdmin@2026` (the
development fallback when `SUPER_ADMIN_PASSWORD` is not set).

## 4. Production build

```sh
cd frontend
npm run build        # runs `tsc -b` (type check), then `vite build`
```

- Output: `frontend/dist/` — `index.html`, content-hashed files in `dist/assets/`, and from `public/`:
  `manifest.webmanifest`, `sw.js` (the service worker), `favicon.svg`, `icons/`.
- The bundle talks to `https://dentorapi.localappstore.in` (from `.env.production`). Do not open it with
  `vite preview` for testing: it would call the production API. Test with the build below instead.
- `npm run build` from the repository root does the same.
- Do not deploy from this guide. When it is deployed, serve `sw.js` and `index.html` without long-lived
  caching; `assets/` may be cached for a year. The service worker never answers `/api` requests.

### A production build against the local API (for testing)

```sh
cd frontend
VITE_API_BASE_URL= npx vite build                       # writes frontend/dist, API calls stay relative
npx vite preview --port 5173 --strictPort               # serves dist on :5173; /api is proxied to 127.0.0.1:8000
```

This is what the browser test suite expects. A separate output folder keeps `dist/` untouched:
`VITE_API_BASE_URL= npx vite build --outDir /tmp/dentor-web --emptyOutDir` and
`npx vite preview --outDir /tmp/dentor-web --port 5173 --strictPort`.

## 5. Checks and tests

| What | Command (in `frontend/`) | Needs |
| --- | --- | --- |
| Type check | `npx tsc -b` | nothing |
| Lint | `npm run lint` (oxlint) | nothing |
| Browser suite | `npm run e2e` | the API with demo data on :8000, and the preview above on :5173 |
| Previous release against the new API | `node e2e/previous-release.compat.mjs` | the API, and the previous release served on :5174 (steps at the top of the file) |

The suites refuse any address that is not on this machine and always refuse the production hosts.

## 6. Clean rebuild (this project only)

```sh
cd frontend
rm -rf dist node_modules/.vite        # the build output and Vite's cache for this project
npm run build
```

If dependencies are broken: `rm -rf node_modules && npm ci` in `frontend/` only. Do not clear the global
npm cache (`~/.npm`); other projects use it.

## 7. Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm run build` stops with TypeScript errors | the type check runs first; fix the reported files (`npx tsc -b` shows the same errors) |
| The page loads but every request fails with a network error | the build points at an API that is not reachable from where it is served: check `VITE_API_BASE_URL` (shell or `.env.production`) |
| Requests go to `/api` on the web server and get 404 | `VITE_API_BASE_URL` was empty and nothing proxies `/api`: set it, or configure the proxy |
| Port 5173 in use | another dev server or preview is running; stop it, or use `--port 5174` |
| An old version keeps loading after a new build | the service worker serves the previous files until the new `sw.js` is fetched; reload twice, or in DevTools › Application › Service Workers choose "Update on reload" |
| `npm run e2e` says the address is not allowed | the suites only run against `localhost` / `127.0.0.1` on purpose |

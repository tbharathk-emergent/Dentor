// Browser regression check of the Dentor web app (reception app + Super Admin console + PWA) against the real API.
//
//   npm run e2e
//   APP_URL=http://localhost:5173 API_URL=http://127.0.0.1:8000 node e2e/web.e2e.mjs
//   E2E_ARTIFACTS=/some/dir …      # optional: a screenshot of the page is saved there for every failed step
//   E2E_SCREENSHOTS=all …          # with E2E_ARTIFACTS: also save every screen the layout checks look at
//
// What it needs
//   - APP_URL: a production build of the app (the service worker only registers in one) served with
//     /api proxied to the API, built with an EMPTY VITE_API_BASE_URL so nothing points at production:
//       VITE_API_BASE_URL= npx vite build --outDir <dir> --emptyOutDir && npx vite preview --outDir <dir> --port 5173 --strictPort
//     The check refuses to start if the build has the production API address baked in.
//   - API_URL: the API on a development database with demo data (SEED_DEMO on, SMS provider "console").
//
// What it leaves behind (the API cannot delete these):
//   - one inactive Receptionist login "E2E Web Desk <stamp>" in the demo clinic (for one step it is an
//     Administrator, and it is switched on once more for the layout checks),
//   - one suspended clinic "Web E2E Clinic <stamp>" with two logins, one consultant profile and a banner title,
//   - notifications and activity-feed lines produced by the bookings, registrations and settings saves.
// Everything else it creates (a patient-app account and its patient record, two appointments, a chat
// thread) is deleted again, and the two settings it changes ("Smart queue", "Low stock alerts": neither
// is read by any part of the product yet) are put back as they were, in the demo clinic and in its own.
import fs from 'node:fs'
import path from 'node:path'
import {
  API_URL, APP_URL, FORBIDDEN_HOST, VIEWPORTS, apiCall, assertNoOverflow, fail, inr, launch, numberIn, unsafeTarget,
  patiently, runner, sleep, until, watch,
} from './helpers.mjs'

const ADMIN = { email: 'admin@dentor.in', password: 'Dentor@2026', name: 'Dr. Admin' }
const OWNER = { email: 'owner@dentor.in', password: 'Owner@2026' }
const CONSULTANT = { email: 'kumar@dentor.in', password: 'Consultant@2026' }
const SUPER = { email: 'superadmin@dentor.in', password: 'SuperAdmin@2026' }
const DEMO_PATIENT_CODE = 'DEN-1001'
// The appointment the front desk books: a patient and a dentist nobody signs in as, so the booking
// reaches no real inbox of the patient or consultant apps that are being tested alongside.
const BOOKED = { code: 'DEN-1004', doctor: 'Dr. Gowtham' }

const stamp = Date.now()
const tail = String(stamp).slice(-9)
const DESK_LOGIN = {
  name: `E2E Web Desk ${stamp}`,
  email: `e2e.web.desk.${stamp}@dentor.in`,
  weakPassword: 'weakpass1',
  password: 'Front@Desk2026',
  resetPassword: 'Reset@Desk2026',
}
// Named "Web E2E …", not "E2E …": the patient-app check (mobile/e2e/patient.e2e.mjs), which may run
// against the same database at the same time, removes every patient registered through the app
// whose name starts with "E2E ", and every such conversation and message of the Patient App channel.
const APP_PATIENT = { name: `Web E2E Patient ${tail}`, mobile: `8${tail}`, password: `Patient${tail}` }
const CLINIC = {
  name: `Web E2E Clinic ${stamp}`,
  city: 'Trichy',
  ownerName: `Dr. E2E Owner ${tail}`,
  ownerEmail: `e2e.web.owner.${stamp}@dentor.in`,
  ownerPassword: 'Owner@Web2026',
  consultantName: `Dr. E2E Consultant ${tail}`,
  consultantLogin: `e2e.web.consultant.${stamp}@dentor.in`,
  consultantPassword: 'Consult@Web2026',
}
const TREATMENT = `E2E web booking ${tail}`
const APP_REASON = `E2E app booking ${tail}`
const CHAT_TEXT = `Web E2E hello from the app ${tail}`
const REPLY_TEXT = `Web E2E reply from the desk ${tail}`

/* ------------------------------------------------------------------ dates */

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (date, days) => {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(y, m - 1, d)
  next.setDate(next.getDate() + days)
  return iso(next)
}
// The app works on the device's calendar day; the browser shares this machine's clock and timezone.
const today = iso(new Date())

/* -------------------------------------------------------------- preflight */

function abort(reason) {
  console.log(`✘ Cannot start — ${reason}`)
  console.log('\nWeb app: 0/0 steps passed · NOT RUN')
  process.exit(2)
}

/** Nothing here may touch production: check the addresses and the build before a browser opens. */
async function preflight() {
  for (const url of [APP_URL, API_URL]) if (unsafeTarget(url)) abort(unsafeTarget(url))
  const html = await fetch(APP_URL + '/').then((res) => res.text()).catch(() => abort(`nothing answers at ${APP_URL}`))
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  if (!scripts.some((src) => src.startsWith('/assets/'))) abort(`${APP_URL} is not serving a production build (run "vite build" and "vite preview")`)
  const seen = new Set()
  const queue = [...scripts]
  while (queue.length) {
    const src = queue.shift()
    if (seen.has(src)) continue
    seen.add(src)
    const js = await fetch(APP_URL + src).then((res) => res.text())
    if (FORBIDDEN_HOST.test(js)) abort(`the build at ${APP_URL} has a production API address baked in (${src}); rebuild with VITE_API_BASE_URL= (empty)`)
    for (const m of js.matchAll(/assets\/[\w.-]+\.js/g)) queue.push('/' + m[0])
  }
  const direct = await fetch(API_URL + '/api/health').then((res) => res.status).catch(() => 0)
  if (direct !== 200) abort(`the API at ${API_URL} does not answer /api/health`)
  const proxied = await fetch(APP_URL + '/api/health').then((res) => res.status).catch(() => 0)
  if (proxied !== 200) abort(`${APP_URL}/api is not proxied to the API`)
  return seen.size
}

const scannedFiles = await preflight()

/* ------------------------------------------------------------------ setup */

const ARTIFACTS = process.env.E2E_ARTIFACTS || ''
const ALL_SCREENS = process.env.E2E_SCREENSHOTS === 'all' // also save every screen the layout checks look at
if (ARTIFACTS) fs.mkdirSync(ARTIFACTS, { recursive: true })

const browser = await launch()
const errors = []
const newContext = async (label, viewport = { width: 1280, height: 800 }, options = {}) => {
  const context = await browser.newContext({ viewport, ...options })
  context.setDefaultTimeout(15000)
  context.setDefaultNavigationTimeout(45000)
  const watcher = watch(context, errors, label)
  watcher.alwaysExpect(429, '/api/auth/')
  return { context, ...watcher }
}

const desk = await newContext('reception')
const page = await desk.context.newPage()
let shotPage = page
let shots = 0
const r = runner('Web app', async (name) => {
  const failedOn = shotPage
  shotPage = page
  if (!ARTIFACTS) return
  shots += 1
  const file = path.join(ARTIFACTS, `fail-${String(shots).padStart(2, '0')}-${name.replace(/[^\w]+/g, '-').slice(0, 60)}.png`)
  await failedOn.screenshot({ path: file, fullPage: false }).catch(() => {})
})
/** A step that drives another page than the reception one says so, for the failure screenshot. */
const stepOn = async (target, name, fn) => {
  shotPage = target
  try {
    await r.step(name, fn)
  } finally {
    shotPage = page
  }
}
/** Inside a step: the part of it that drives another page (for the failure screenshot). */
const onPage = async (target, fn) => {
  shotPage = target
  await fn()
  shotPage = page
}

let adminToken = ''
let adminUser = null
let superToken = ''
let guestToken = ''
let guestUser = null
const call = async (token, method, urlPath, body, headers) => {
  const { status, data } = await apiCall(method, urlPath, body, token, headers)
  if (status >= 400) fail(`${method} ${urlPath} answered ${status}: ${JSON.stringify(data).slice(0, 160)}`)
  return data
}
const deskApi = (method, urlPath, body) => (adminToken ? call(adminToken, method, urlPath, body) : fail('the administrator is not signed in'))
const deskGet = (urlPath) => deskApi('GET', urlPath)
const superApi = (method, urlPath, body, clinicId) =>
  superToken ? call(superToken, method, urlPath, body, clinicId ? { 'X-Clinic-Id': clinicId } : {}) : fail('the super admin is not signed in')
const apiSignIn = (email, password, app = 'web') => patiently(() => apiCall('POST', '/api/auth/login', { email, password, app }))

/* ---------------------------------------------------------- page helpers */

const xpathText = (text) => (text.includes('"') ? `'${text}'` : `"${text}"`)
/** The input, select or textarea under a form label, matched on the label's own words (not its hint). */
const field = (scope, label) =>
  scope.locator(`xpath=.//label[span[1][normalize-space(translate(., "*", ""))=${xpathText(label)}]]`).locator('input, select, textarea').first()
const dialog = (target, title) => target.getByRole('dialog').filter({ has: target.getByRole('heading', { name: title }) })
const button = (scope, name) => scope.getByRole('button', { name, exact: true })

async function closeDialog(dlg) {
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click()
  await dlg.waitFor({ state: 'hidden' })
}

const toast = (target, text) => target.locator('[data-sonner-toast]').filter({ hasText: text })
async function clearToasts(target) {
  await target.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click()))
  await until(async () => (await target.locator('[data-sonner-toast]').count()) === 0 || 'a toast is still on screen', 8000).catch(() => {})
}
/** Waits for a toast with this text, then clears the toasts so they never cover what is clicked next. */
async function sawToast(target, text) {
  await toast(target, text).first().waitFor({ timeout: 10000 })
  await clearToasts(target)
}

/** Loaded: nothing on its way and no loading skeleton left. */
async function ready(target) {
  await target.waitForLoadState('networkidle').catch(() => {})
  await until(async () => (await target.locator('.animate-pulse').count()) === 0 || 'the page still shows loading skeletons', 20000)
}

/** A stat tile's value and hint, found by its label. */
const stat = (target, label) =>
  target.evaluate((wanted) => {
    for (const el of document.querySelectorAll('main span')) {
      if (!el.children.length && el.textContent.trim() === wanted && el.previousElementSibling) {
        return { value: el.previousElementSibling.textContent.trim(), hint: el.nextElementSibling ? el.nextElementSibling.textContent.trim() : '' }
      }
    }
    return null
  }, label)
const statValue = async (target, label) => (await stat(target, label))?.value ?? `(no "${label}" tile)`
const statNumber = async (target, label) => {
  const tile = await stat(target, label)
  return tile ? numberIn(tile.value) : `(no "${label}" tile)`
}
/** The count badge of a tab, or null when the tab shows none. */
const tabCount = (target, label) =>
  target.evaluate((wanted) => {
    for (const tab of document.querySelectorAll('main [role="tab"]')) {
      const own = [...tab.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
      if (own !== wanted) continue
      const badge = tab.querySelector('span[class*="ml-1.5"]')
      return badge ? Number(badge.textContent) : null
    }
    return `(no "${wanted}" tab)`
  }, label)
const tab = (target, label) => target.locator('main [role="tab"]').filter({ hasText: label })

/**
 * Waits until every figure on screen equals the API's. Other checks write to this database at the
 * same time, so if a figure moved between the app's request and ours the page is reloaded once.
 * `figures` is a list of [name, read from screen, pick from the API answer]; a fourth element
 * 'includes' asks for the screen text to contain the API value instead of equalling it.
 */
const comparison = (fetchExpected, figures) => async () => {
  const expected = await fetchExpected()
  for (const [name, read, pick, mode] of figures) {
    const onScreen = await read().catch((error) => `unreadable (${String(error).split('\n')[0].slice(0, 80)})`)
    const wanted = pick(expected)
    const same = mode === 'includes' ? String(onScreen).includes(wanted) : JSON.stringify(onScreen) === JSON.stringify(wanted)
    if (!same) return `${name}: screen shows ${JSON.stringify(onScreen)}, API says ${JSON.stringify(wanted)}`
  }
  return true
}
async function figuresMatch(target, fetchExpected, figures, reopen) {
  const compare = comparison(fetchExpected, figures)
  try {
    await until(compare, 5000)
  } catch {
    await target.reload({ waitUntil: 'networkidle' })
    if (reopen) await reopen()
    await ready(target)
    await until(compare, 10000)
  }
}

/** Submits the sign-in form and returns what the API answered to it. */
async function submitSignIn(target, email, password) {
  for (let attempt = 1; ; attempt += 1) {
    await target.locator('input[autocomplete="username"]').fill(email)
    await target.locator('input[autocomplete="current-password"]').fill(password)
    const answered = target.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST')
    await target.getByRole('button', { name: /Login to Dashboard/ }).click()
    const response = await answered
    const data = await response.json().catch(() => ({}))
    if (response.status() !== 429 || attempt >= 6) return { status: response.status(), data }
    await sleep(12000)
  }
}

/** Closes whatever an earlier (failed) step left open, so it cannot swallow the next clicks. */
async function settle(target) {
  for (let i = 0; i < 4 && (await target.getByRole('dialog').count()); i += 1) {
    await target.keyboard.press('Escape')
    await sleep(300)
  }
}

const sidebarLink = (label) => page.locator('aside').getByRole('link', { name: label, exact: true })
const heading = (target, text) => target.locator('main h1').filter({ hasText: text })

/** Opens a reception page from the sidebar and waits for its heading and data. */
async function openFromSidebar(label, urlPath, title) {
  await settle(page)
  await sidebarLink(label).click()
  await page.waitForURL(APP_URL + urlPath)
  await heading(page, title).waitFor({ timeout: 20000 })
  await ready(page)
}

/** Opens a page by address in a context that is already signed in. */
async function visit(target, urlPath, title) {
  await settle(target)
  await target.goto(APP_URL + urlPath, { waitUntil: 'networkidle' })
  if (title) await heading(target, title).waitFor({ timeout: 20000 })
  await ready(target)
}

/**
 * Opens a tab that is already signed in (a session obtained through the API), without another
 * sign-in. Seeded once per tab, so a session the app ends later stays ended.
 */
const signedInAs = (target, token, user) =>
  target.addInitScript(([t, u]) => {
    if (!sessionStorage.getItem('e2e.seeded')) {
      localStorage.setItem('dentor.token', t)
      localStorage.setItem('dentor.user', JSON.stringify(u))
      sessionStorage.setItem('e2e.seeded', '1')
    }
  }, [token, user])

const sentSince = (watcher, from, method, part) => watcher.requests.filter((req) => req.at >= from && req.method === method && req.path.includes(part))

/* ------------------------------------------------------------- signing in */

await r.step(`The app opens on the sign-in page (preflight: production build, ${scannedFiles} script files read, no production API address in them)`, async () => {
  await page.goto(APP_URL + '/', { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForURL(APP_URL + '/login')
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()
})

await r.step('A wrong password shows the API\'s error and stays on the sign-in page', async () => {
  await desk.expecting([[401, '/api/auth/login']], async () => {
    const { status, data } = await submitSignIn(page, ADMIN.email, 'not-the-password')
    if (status !== 401) fail(`expected 401, got ${status}: ${JSON.stringify(data)}`)
    if (!data.detail) fail('the API gave no explanation')
    await page.locator('p[role="alert"]').filter({ hasText: data.detail }).waitFor({ timeout: 5000 })
  })
  if (!page.url().endsWith('/login')) fail(`a wrong password left the sign-in page for ${page.url()}`)
  if (await page.evaluate(() => localStorage.getItem('dentor.token'))) fail('a session was stored after a wrong password')
})

await r.step('A consultant login is refused with the API\'s explanation', async () => {
  await desk.expecting([[403, '/api/auth/login']], async () => {
    const { status, data } = await submitSignIn(page, CONSULTANT.email, CONSULTANT.password)
    if (status !== 403) fail(`expected the API to answer 403, got ${status}: ${JSON.stringify(data)}`)
    if (!/consultant app/i.test(data.detail || '')) fail(`unexpected explanation from the API: ${JSON.stringify(data)}`)
    await page.locator('p[role="alert"]').filter({ hasText: data.detail }).waitFor({ timeout: 5000 })
  })
  if (!page.url().endsWith('/login')) fail('a consultant was let into the reception app')
  if (await page.evaluate(() => localStorage.getItem('dentor.token'))) fail('a session was stored for a consultant')
})

await r.step('The Administrator signs in and lands on the dashboard', async () => {
  const { status, data } = await submitSignIn(page, ADMIN.email, ADMIN.password)
  if (status !== 200) fail(`sign-in answered ${status}: ${JSON.stringify(data)}`)
  adminToken = data.access_token
  adminUser = data.user
  await page.waitForURL(APP_URL + '/')
  await heading(page, `, ${ADMIN.name}`).waitFor({ timeout: 20000 })
  await ready(page)
  if (data.user.role !== 'Administrator') fail(`the demo login has the role ${data.user.role}`)
  const { clinicName } = await deskGet('/api/settings')
  if (!clinicName) fail('the demo clinic has no settings (is the demo data loaded?)')
})

await r.step('Reloading keeps the session', async () => {
  const before = await page.evaluate(() => localStorage.getItem('dentor.token'))
  await page.reload({ waitUntil: 'networkidle' })
  await heading(page, `, ${ADMIN.name}`).waitFor({ timeout: 20000 })
  if (page.url() !== APP_URL + '/') fail(`after a reload the app is on ${page.url()}`)
  if ((await page.evaluate(() => localStorage.getItem('dentor.token'))) !== before) fail('the stored session changed on reload')
  await visit(page, '/login') // a signed-in user who opens the sign-in page is sent back in
  await page.waitForURL(APP_URL + '/')
})

await r.step('Just after midnight in India the app works on the new local day, not on the UTC date', async () => {
  // 01:30 IST is still the previous day in UTC. "Today" must be the day on the clinic's wall clock.
  const night = await newContext('after midnight', { width: 1280, height: 800 }, { timezoneId: 'Asia/Kolkata' })
  const nightPage = await night.context.newPage()
  shotPage = nightPage
  try {
    const localDay = addDays(today, 1)
    await nightPage.clock.setFixedTime(new Date(`${localDay}T01:30:00+05:30`))
    await signedInAs(nightPage, adminToken, adminUser)
    await nightPage.goto(APP_URL + '/', { waitUntil: 'networkidle' })
    await heading(nightPage, `, ${ADMIN.name}`).waitFor({ timeout: 20000 })
    const asked = night.requests.filter((req) => req.path.startsWith('/api/dashboard')).map((req) => req.path)
    if (!asked.length) fail('the dashboard made no request')
    if (asked.some((urlPath) => urlPath !== `/api/dashboard?date=${localDay}`)) fail(`at 01:30 on ${localDay} the dashboard asked for ${asked.join(', ')}`)
    await nightPage.goto(APP_URL + '/appointments', { waitUntil: 'networkidle' })
    await heading(nightPage, 'Appointments').waitFor({ timeout: 20000 })
    const shown = await nightPage.locator('main input[type="date"]').first().inputValue()
    if (shown !== localDay) fail(`at 01:30 on ${localDay} the appointment calendar opens on ${shown}`)
  } finally {
    await night.context.close()
    shotPage = page
  }
})

/* -------------------------------------------------- sidebar destinations */

const dashboardPath = () => `/api/dashboard?date=${today}`
const todaysCard = () => page.locator('main div.shadow-card').filter({ has: page.getByRole('heading', { name: "Today's Appointments" }) })

await r.step('Home: the dashboard figures and today\'s list equal /api/dashboard for today', async () => {
  const from = Date.now()
  await visit(page, '/', `, ${ADMIN.name}`)
  const asked = sentSince(desk, from, 'GET', '/api/dashboard').map((req) => req.path)
  if (!asked.includes(dashboardPath())) fail(`the dashboard asked for ${asked.join(', ') || 'nothing'}, expected ${dashboardPath()} (today on this device)`)
  await figuresMatch(page, () => deskGet(dashboardPath()), [
    ['appointments today', () => statNumber(page, 'Appointments today'), (api) => api.appointmentsToday],
    ['waiting now', () => statNumber(page, 'Waiting now'), (api) => api.byStatus.Waiting],
    ['completed today', () => statNumber(page, 'Completed today'), (api) => api.byStatus.Completed],
    ['total patients', () => statNumber(page, 'Total patients'), (api) => api.patients],
    ['new this month', async () => (await stat(page, 'Total patients'))?.hint, (api) => `+${api.newPatientsThisMonth} this month`],
    ['pharmacy low stock', () => statNumber(page, 'Pharmacy low stock'), (api) => api.pharmacyLowStock],
    ['FRS opportunities', () => statNumber(page, 'FRS opportunities'), (api) => api.frs],
    ['rows in today\'s list', () => todaysCard().locator('ul > li').count(), (api) => api.todayAppointments.length],
    ['first patient today', async () => ((await todaysCard().locator('ul > li').count()) ? (await todaysCard().locator('ul > li').first().locator('.font-semibold.text-slate-800').innerText()).trim() : null),
      (api) => api.todayAppointments[0]?.patient ?? null],
  ])
  const api = await deskGet(dashboardPath())
  if (api.patients === 0 || api.appointmentsToday === 0) fail('the demo data has no patients or no appointment today, so the comparison proves little')
})

await r.step('Home: revenue figures stay masked until the password is confirmed, then equal the API', async () => {
  const api = await deskGet(dashboardPath())
  if (api.financialLock) {
    if ((await statValue(page, 'Outstanding')) !== '₹ •••••') fail('a clinic with the financial lock shows revenue without asking')
    await button(page, 'Unlock financials').click()
    const dlg = dialog(page, 'Unlock financials')
    await dlg.waitFor()
    await desk.expecting([[401, '/api/auth/verify-password']], async () => {
      await field(dlg, 'Your password').fill('not-the-password')
      const answered = page.waitForResponse((res) => res.url().includes('/api/auth/verify-password'))
      await button(dlg, 'Unlock').click()
      const refused = await answered
      if (refused.status() === 401) await sawToast(page, (await refused.json()).detail)
      else if (refused.status() !== 429) fail(`a wrong password was answered with ${refused.status()}`)
    })
    if (!page.url().endsWith('/')) fail('a wrong password on the unlock dialog signed the user out')
    if ((await statValue(page, 'Outstanding')) !== '₹ •••••') fail('revenue was revealed after a wrong password')
    for (let attempt = 1; ; attempt += 1) {
      await field(dlg, 'Your password').fill(ADMIN.password)
      const answered = page.waitForResponse((res) => res.url().includes('/api/auth/verify-password'))
      await button(dlg, 'Unlock').click()
      const status = (await answered).status()
      if (status === 200) break
      if (status !== 429 || attempt >= 6) fail(`confirming the password answered ${status}`)
      await sleep(12000)
    }
    await dlg.waitFor({ state: 'hidden' })
    await clearToasts(page)
  } else {
    await button(page, 'Show financials').click()
  }
  await figuresMatch(page, () => deskGet(dashboardPath()), [
    ['collection today', () => statValue(page, 'Collection today'), (fresh) => inr(fresh.todayCollection)],
    ['outstanding', () => statValue(page, 'Outstanding'), (fresh) => inr(fresh.outstanding)],
  ])
  if (!((await deskGet(dashboardPath())).outstanding > 0)) fail('the demo data has no outstanding balance to compare')
})

const patientCards = () => page.locator('main div.cursor-pointer.shadow-card')
const dayAppointments = () => page.locator('main div.cursor-pointer.border-l-4')
const listRows = () => page.locator('main div.shadow-card ul > li')
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0)

/** [sidebar label, path, page heading, what the API says, figures compared with it] */
const DESTINATIONS = [
  ['Patients', '/patients', 'Patients', () => deskGet('/api/patients?sort=created_at&order=desc'), [
    ['total patients', () => statNumber(page, 'Total patients'), (api) => api.total],
    ['patient cards', () => patientCards().count(), (api) => api.items.length],
    ['newest patient', async () => (await patientCards().first().locator('.font-semibold.text-slate-900').innerText()).trim(), (api) => api.items[0].name],
    ['high risk', () => statNumber(page, 'High risk'), (api) => api.items.filter((p) => p.risk === 'High').length],
  ]],
  ['Staff', '/staff', 'Staff', () => deskGet('/api/staff?sort=code&order=asc'), [
    ['team members', () => statNumber(page, 'Team members'), (api) => api.total],
    ['active', () => statNumber(page, 'Active'), (api) => api.items.filter((s) => s.status === 'Active').length],
    ['rows', () => listRows().count(), (api) => api.items.length],
    ['first member', async () => (await listRows().first().locator('.font-semibold.text-slate-800').innerText()).trim(), (api) => api.items[0].name],
  ]],
  ['Appointments', '/appointments', 'Appointments', () => deskGet('/api/appointments?limit=1000&sort=time&order=asc'), [
    ['today', () => statNumber(page, 'Today'), (api) => api.items.filter((a) => a.date === today).length],
    ['scheduled', () => statNumber(page, 'Scheduled'), (api) => api.items.filter((a) => a.date === today && a.status === 'Scheduled').length],
    ['completed', () => statNumber(page, 'Completed'), (api) => api.items.filter((a) => a.date === today && a.status === 'Completed').length],
    ['appointments in the day view', () => dayAppointments().count(), (api) => api.items.filter((a) => a.date === today).length],
    ['first appointment of the day', async () => ((await dayAppointments().count()) ? (await dayAppointments().first().locator('.font-semibold.text-slate-800').innerText()).trim() : null),
      (api) => api.items.filter((a) => a.date === today)[0]?.patient ?? null],
  ]],
  ['Consultants', '/consultants', 'Consultants', () => deskGet('/api/consultants?sort=code&order=asc&limit=200'), [
    ['all', () => tabCount(page, 'All'), (api) => api.total],
    ['in-house', () => tabCount(page, 'In-house'), (api) => api.items.filter((c) => c.type === 'In-house').length],
    ['visiting', () => tabCount(page, 'Visiting'), (api) => api.items.filter((c) => c.type === 'Visiting').length],
    ['first consultant', async () => (await page.locator('main').getByText(/^Dr\. /).first().innerText()).trim(), (api) => api.items[0].name],
  ]],
  ['Book a Consultant', '/book-consultant', 'Book a Consultant', async () => ({
    consultants: await deskGet('/api/consultants?sort=code&order=asc&limit=100'),
    bookings: await deskGet('/api/consultant_bookings?sort=date&order=desc&limit=200'),
  }), [
    ['visiting specialists', () => statNumber(page, 'Visiting specialists'), (api) => api.consultants.items.filter((c) => c.type === 'Visiting' && c.status !== 'Inactive').length],
    ['first specialist listed', async () => (await page.locator('main').getByText(/^Dr\. /).first().innerText()).trim(), (api) => api.consultants.items.filter((c) => c.type === 'Visiting')[0].name],
    ['upcoming consultations', () => statNumber(page, 'Upcoming consultations'), (api) => api.bookings.items.filter((b) => b.status === 'Confirmed' && b.date >= today).length],
  ]],
  ['Schedule Notes', '/schedule-notes', 'Schedule & Notes', () => deskGet(`/api/schedule_notes?date=${today}&sort=time&order=asc&limit=300`), [
    ['today\'s entries', () => statNumber(page, "Today's entries"), (api) => api.total],
    ['entries listed', () => listRows().count(), (api) => api.items.length],
    ['first entry', async () => ((await listRows().count()) ? (await listRows().first().innerText()).replace(/\s+/g, ' ') : ''), (api) => api.items[0]?.title ?? '', 'includes'],
  ]],
  ['Accounts', '/accounts', 'Billing & Accounts', async () => ({
    summary: await deskGet('/api/accounts/summary'),
    invoices: await deskGet('/api/invoices?sort=date&order=desc&limit=300'),
    payments: await deskGet('/api/payments?sort=date&order=desc&limit=300'),
  }), [
    ['invoices', () => statNumber(page, 'Invoices'), (api) => api.summary.invoices],
    ['outstanding', () => statValue(page, 'Outstanding'), (api) => inr(api.summary.outstanding)],
    ['collected', () => statValue(page, 'Collected'), (api) => inr(api.summary.collected)],
    ['invoices tab', () => tabCount(page, 'Invoices'), (api) => api.invoices.total],
    ['payments tab', () => tabCount(page, 'Payments & Receipts'), (api) => api.payments.total],
    ['first invoice listed', async () => (await page.locator('main').getByText(/^[A-Z]+-INV-\d+$/).first().innerText()).trim(), (api) => api.invoices.items[0].number],
  ]],
  ['Expenses', '/expenses', 'Expenses', () => deskGet('/api/clinic-app/accounts/expenses'), [
    ['expenses listed', () => page.locator('main tbody tr').count(), (api) => api.items.length],
    ['expense total', () => statValue(page, 'Shown'), (api) => inr(api.total)],
  ]],
  ['FRS', '/frs', 'FRS — Future Revenue Scope', () => deskGet('/api/frs_records?sort=created_at&order=desc&limit=500'), [
    ['total pipeline', () => statValue(page, 'Total pipeline'), (api) => inr(sum(api.items.filter((f) => f.completionStatus !== 'Treatment Completed'), 'value'))],
    ['open opportunities', async () => (await stat(page, 'Total pipeline'))?.hint, (api) => `${api.items.filter((f) => f.completionStatus !== 'Treatment Completed').length} open opportunities`],
  ]],
  ['Certificates', '/certificates', 'Certificates', () => deskGet('/api/certificates?sort=created_at&order=desc'), [
    ['all', () => tabCount(page, 'All'), (api) => api.total],
    ['empty state', () => page.locator('main').getByText('No certificates yet').count(), (api) => (api.total === 0 ? 1 : 0)],
  ]],
  ['Inventory', '/inventory', 'Inventory', async () => ({
    items: await deskGet('/api/inventory_items?sort=created_at&order=desc&limit=500'),
    suppliers: await deskGet('/api/inventory_suppliers?sort=created_at&order=desc&limit=200'),
  }), [
    ['total items', () => statNumber(page, 'Total items'), (api) => api.items.total],
    ['items tab', () => tabCount(page, 'Items'), (api) => api.items.total],
    ['suppliers tab', () => tabCount(page, 'Suppliers'), (api) => api.suppliers.total],
    ['rows in the table', () => page.locator('main tbody tr').count(), (api) => api.items.items.length],
  ]],
  ['E-prescription', '/prescriptions', 'E-Prescription', () => deskGet('/api/prescriptions?sort=created_at&order=desc&limit=300'), [
    ['history', () => tabCount(page, 'History'), (api) => api.total || null],
  ]],
  ['Pharmacy', '/pharmacy', 'Pharmacy', () => deskGet('/api/pharmacy_items?limit=2000&sort=name&order=asc'), [
    ['total items', () => statNumber(page, 'Total items'), (api) => api.total],
    ['stock tab', () => tabCount(page, 'Stock'), (api) => api.total],
    ['first item', async () => (await page.locator('main tbody tr').first().locator('td').first().innerText()).split('\n')[0].trim(), (api) => api.items[0].name],
  ]],
  ['Lab Orders', '/lab', 'Lab Orders', () => deskGet('/api/lab_orders?sort=created_at&order=desc&limit=500'), [
    ['orders tab', () => tabCount(page, 'Orders'), (api) => api.total],
    ['order codes on the board', async () => new Set(await page.locator('main').getByText(/^LAB-\d+$/).allInnerTexts()).size > 0, (api) => api.total > 0],
  ]],
  ['Reports', '/reports', 'Reports & Analytics', async () => ({
    invoices: (await deskGet('/api/invoices?limit=1000')).items.filter((i) => i.date >= addDays(today, -30) && i.date <= today),
    payments: (await deskGet('/api/payments?limit=1000')).items.filter((p) => p.date >= addDays(today, -30) && p.date <= today),
  }), [
    ['billed', () => statValue(page, 'Billed'), (api) => inr(sum(api.invoices, 'total'))],
    ['collected', () => statValue(page, 'Collected'), (api) => inr(sum(api.payments, 'amount'))],
    ['outstanding', () => statValue(page, 'Outstanding'), (api) => inr(sum(api.invoices, 'balance'))],
  ]],
  ['Reviews & Ratings', '/reviews', 'Reviews & Ratings', () => deskGet('/api/reviews?limit=500&sort=created_at&order=desc'), [
    ['total reviews', () => statNumber(page, 'Total reviews'), (api) => api.total],
    ['approved', () => statNumber(page, 'Approved'), (api) => api.items.filter((v) => v.status === 'Approved').length],
    ['all reviews tab', () => tabCount(page, 'All Reviews'), (api) => api.total],
  ]],
  ['Omni-channel', '/omni', 'Omnichannel Communication', async () => ({
    conversations: await deskGet('/api/omni_conversations?limit=200&sort=updated_at&order=desc'),
    templates: await deskGet('/api/omni_templates?limit=100&sort=code&order=asc'),
  }), [
    ['conversations listed', () => page.locator('main ul > li').count(), (api) => api.conversations.items.length],
    ['unread on the inbox tab', () => tabCount(page, 'Inbox'), (api) => sum(api.conversations.items, 'unread') || null],
    ['templates tab', () => tabCount(page, 'Templates'), (api) => api.templates.total || null],
    ['most recent conversation', async () => (await page.locator('main ul > li').first().locator('.font-semibold.text-slate-800').innerText()).trim(), (api) => api.conversations.items[0].name],
  ]],
  ['Lead Generation', '/leads', 'Lead Generation & CRM', () => deskGet('/api/leads?limit=500&sort=created_at&order=desc'), [
    ['total leads', () => statNumber(page, 'Total leads'), (api) => api.total],
  ]],
  ['Masters', '/masters', 'Masters', () => deskGet('/api/masters?module=clinical&sort=sort&order=asc&limit=500'), [
    ['clinical masters listed', () => listRows().count(), (api) => api.items.length],
    ['first master', async () => (await listRows().first().locator('.font-semibold.text-slate-800').innerText()).trim(), (api) => api.items[0].name],
  ]],
  ['Settings', '/settings', 'Settings', () => deskGet('/api/settings'), [
    ['clinic name', () => field(page.locator('main'), 'Clinic Name').inputValue(), (api) => api.clinicName],
    ['invoice prefix', () => field(page.locator('main'), 'Invoice Prefix').inputValue(), (api) => api.invoicePrefix],
    ['patient app booking switch', () => settingSwitch('Patient app booking').getAttribute('aria-checked'), (api) => String(Boolean(api.onlineBooking))],
    ['double booking switch', () => settingSwitch('Allow double booking').getAttribute('aria-checked'), (api) => String(Boolean(api.doubleBooking))],
  ]],
]
const switchOn = (target, label) => target.locator('main label').filter({ hasText: label }).getByRole('switch')
const settingSwitch = (label) => switchOn(page, label)

await r.step('The sidebar lists every reception destination', async () => {
  const links = await page.locator('aside nav a').allInnerTexts()
  const expected = ['Home', ...DESTINATIONS.map(([label]) => label)]
  // Clinical Chart is checked by its own step below (it needs a patient to be chosen first).
  expected.splice(expected.indexOf('Appointments') + 1, 0, 'Clinical Chart')
  if (JSON.stringify(links.map((t) => t.trim())) !== JSON.stringify(expected)) fail(`sidebar shows ${links.join(' | ')}; this check covers ${expected.join(' | ')}`)
})

for (const [label, urlPath, title, fetchExpected, figures] of DESTINATIONS) {
  await r.step(`Sidebar → ${label}: opens with the API's data (${figures.map(([name]) => name).join(', ')})`, async () => {
    await openFromSidebar(label, urlPath, title)
    await figuresMatch(page, fetchExpected, figures, async () => heading(page, title).waitFor({ timeout: 20000 }))
    if ((await page.locator('main').innerText()).trim().length < 80) fail('the page is nearly blank')
  })
}

await r.step('Sidebar → Clinical Charts: a patient found through the API opens their charts', async () => {
  await openFromSidebar('Clinical Chart', '/clinical', 'Clinical Charts')
  await page.locator('main').getByText('No patient selected').waitFor()
  const found = (await deskGet(`/api/patients?q=${DEMO_PATIENT_CODE}&limit=12&sort=name&order=asc`)).items
  if (found.length !== 1) fail(`the API finds ${found.length} patients for ${DEMO_PATIENT_CODE}`)
  const from = Date.now()
  const picker = page.locator('main input[placeholder^="Search patient"]')
  await picker.click()
  await picker.fill(DEMO_PATIENT_CODE)
  const option = page.locator('main button').filter({ hasText: `${DEMO_PATIENT_CODE} ·` })
  await option.filter({ hasText: found[0].name }).waitFor()
  if ((await option.count()) !== 1) fail(`${await option.count()} patients offered for ${DEMO_PATIENT_CODE}`)
  await option.click()
  await page.locator('main').getByText('No patient selected').waitFor({ state: 'hidden' })
  await ready(page)
  await until(() => sentSince(desk, from, 'GET', `/api/charts?patientId=${found[0].id}`).length >= 2 || 'the charts of the chosen patient were not requested')
  const saved = (await deskGet(`/api/charts?patientId=${found[0].id}&type=perio`)).total
  if (!(await page.locator('main').innerText()).includes(found[0].name)) fail('the chosen patient is not shown on the chart page')
  if (typeof saved !== 'number') fail('the API did not answer the chart lookup')
})

/* ------------------------------------------ when the data cannot be loaded */

// A request that fails is not "no data". Each destination is opened while every read from the API
// fails, in turn as a dead connection and as an HTTP 500. It has to say what it could not load, say
// nothing it cannot know (no empty state, no zero, no blank form), and load the real data with
// "Try again" once the API answers, on the same page.

/** How the API is broken: [the status the watcher sees (0 = no answer), what the page says about it]. */
const BROKEN = {
  'no connection': [0, 'The server could not be reached'],
  'HTTP 500': [500, 'The server reported a problem (Internal Server Error)'],
}

/**
 * Makes every read from the API fail in one tab until the function it returns is called. Only GET
 * requests are touched, so nothing is written or lost. `only` narrows it to one kind of request.
 */
async function breakApi(target, kind, only = '**/api/**') {
  const handler = (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return kind === 'no connection'
      ? route.abort('connectionfailed')
      : route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal Server Error"}' })
  }
  await target.route(only, handler)
  return () => target.unroute(only, handler)
}

const alerts = (target) => target.locator('main [role="alert"]')
const saying = (target, text) => alerts(target).filter({ hasText: text })
const mainText = async (target) => (await target.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400)

/**
 * What a page claims about data it does not have: a line of `main` that says "No …" / "Nothing …",
 * a nought on its own or a "₹0", a figure tile that shows anything but a dash, a count on a tab.
 * `allow` is a line that is no such claim on this page.
 */
const falseClaims = (target, allow) =>
  target.locator('main').evaluate((main, allowed) => {
    const fine = allowed ? new RegExp(allowed) : null
    const lines = main.innerText.split('\n').map((line) => line.trim()).filter(Boolean)
    const claims = lines.filter((line) => (/^(No|Nothing)\b/.test(line) || /^0(\s|$)/.test(line) || /₹\s?0(?![\d,.])/.test(line)) && !(fine && fine.test(line)))
    for (const figure of main.querySelectorAll('.shadow-card span.text-xl.font-bold')) {
      if (figure.textContent.trim() !== '—') claims.push(`the tile "${figure.nextElementSibling?.textContent.trim()}" shows ${figure.textContent.trim()}`)
    }
    for (const badge of main.querySelectorAll('[role="tab"] span[class*="ml-1.5"]')) claims.push(`the tab "${badge.parentElement.textContent.trim()}" shows a count`)
    return claims
  }, allow ? allow.source : null)

/**
 * Nothing is loading and nothing is being tried again: every failed request has had its automatic
 * second attempt. (A request the page repeats on its own must not be mistaken for "Try again".)
 */
const settled = (target) =>
  until(async () => {
    if (await target.locator('main .animate-pulse').count()) return 'a part of the page is still loading'
    return (await alerts(target).locator('button:disabled').count()) === 0 || 'a failed request is still being tried again'
  }, 20000)

/** The page says what it could not load and why, offers "Try again", and claims nothing it cannot know. */
async function assertUnavailable(target, kind, says, allow) {
  for (const text of says) {
    await until(async () => (await saying(target, text).count()) > 0 || `the page does not say "${text}"; it reads: ${await mainText(target)}`, 20000)
  }
  await settled(target)
  if (!(await saying(target, BROKEN[kind][1]).count())) fail(`with ${kind} the page does not say "${BROKEN[kind][1]}"; it reads: ${await mainText(target)}`)
  const messages = await alerts(target).count()
  if ((await alerts(target).getByRole('button', { name: 'Try again', exact: true }).count()) !== messages) fail(`${messages} messages, but not each of them offers "Try again"`)
  const claims = await falseClaims(target, allow)
  if (claims.length) fail(`without its data the page still claims: ${claims.slice(0, 5).join(' | ')}`)
}

/** With the API answering again, one press of "Try again" loads everything, without leaving the page. */
async function tryAgain(target, watcher) {
  await target.evaluate(() => {
    window.__e2eSamePage = true
  })
  const from = Date.now()
  await alerts(target).first().getByRole('button', { name: 'Try again', exact: true }).click()
  // While it asks again the page shows its loading state; the message must not come back after it.
  await until(async () => watcher.requests.some((req) => req.at >= from && req.method === 'GET' && !req.path.startsWith('/api/notifications')) || '"Try again" sent no request', 10000)
  await ready(target)
  await until(async () => (await alerts(target).count()) === 0 || `after "Try again" the page still says: ${(await alerts(target).first().innerText().catch(() => '')).replace(/\s+/g, ' ')}`, 20000)
  if (!(await target.evaluate(() => window.__e2eSamePage === true))) fail('"Try again" reloaded the page instead of asking the API again')
}

/**
 * What each destination says while its data cannot be loaded: on the view it opens on, and on every
 * other tab that loads data of its own ([tab, message, …]).
 */
const UNAVAILABLE = {
  Patients: { says: ['Could not load the patients'] },
  Appointments: { says: ['Could not load today’s appointment figures.', 'Could not load the appointments'] },
  'Book a Consultant': { says: ['Could not load the consultation figures.', 'Could not load the consultants', 'Could not load the booking history'] },
  Accounts: { says: ['Could not load the billing figures.', 'Could not load the invoices'], tabs: [['Payments & Receipts', 'Could not load the payments']] },
  Expenses: { says: ['Could not load the expenses'] },
  'Schedule Notes': { says: ['Could not load today’s figures.', 'Could not load the schedule'] },
  Consultants: { says: ['Could not load the consultants'] },
  FRS: { says: ['Could not load the revenue pipeline'] },
  'E-prescription': { says: ['Could not load the saved combos.'], tabs: [['History', 'Could not load the prescriptions']] },
  Certificates: { says: ['Could not load the certificates'] },
  Pharmacy: { says: ['Could not load the pharmacy stock'], tabs: [['Dispense', 'Could not load the pharmacy stock'], ['Bills', 'Could not load the stock figures.', 'Could not load the pharmacy bills']] },
  'Lab Orders': { says: ['Could not load the lab orders'], tabs: [['Orders', 'Could not load the lab orders'], ['Payments', 'Could not load the order figures.', 'Could not load the lab payments']] },
  Inventory: {
    says: ['Could not load the inventory items'],
    tabs: [['Movements', 'Could not load the stock figures.', 'Could not load the stock movements'], ['Purchases', 'Could not load the purchases'], ['Suppliers', 'Could not load the suppliers']],
  },
  Staff: { says: ['Could not load the team directory'], tabs: [['Logins & app access', 'Could not load the logins']] },
  // "No report run yet" is the builder waiting for its first run, not a claim about data.
  Reports: { says: ['Could not load the report data'], tabs: [['Custom Reports', 'Could not load the saved reports']], allow: /^No report run yet$/ },
  'Reviews & Ratings': { says: ['Could not load the reviews'] },
  'Omni-channel': { says: ['Could not load the conversations'], tabs: [['Templates', 'Could not load the message templates'], ['Campaigns', 'Could not load the campaigns']] },
  'Lead Generation': { says: ['Could not load the leads'] },
  Masters: { says: ['Could not load the master records'] },
  Settings: { says: ['Could not load the settings'] },
}

/** Opens a page while the API is broken, checks what it says (on each tab), and repairs the API again. */
async function openWhileBroken(target, watcher, kind, open, says, { tabs = [], allow, extra } = {}) {
  const restore = await breakApi(target, kind)
  try {
    await watcher.expecting([[BROKEN[kind][0], '/api/']], async () => {
      await open() // a fresh page load: nothing is remembered from an earlier visit
      await assertUnavailable(target, kind, says, allow)
      if (extra) await extra()
      for (const [name, ...tabSays] of tabs) {
        await tab(target, name).click()
        await assertUnavailable(target, kind, tabSays, allow)
      }
      if (tabs.length) {
        await target.locator('main [role="tab"]').first().click()
        await assertUnavailable(target, kind, says, allow)
      }
      await restore()
    })
  } finally {
    await restore()
  }
}

await r.step('Home with no connection: the dashboard says it could not load today\'s figures (no zeros, no "No appointments today"), and "Try again" brings the API\'s figures', async () => {
  await openWhileBroken(page, desk, 'no connection', () => visit(page, '/', `, ${ADMIN.name}`), ['Could not load today’s figures'], {
    extra: async () => {
      for (const gone of ["Today's Appointments", 'Schedule & Notes', 'Recent Activity']) {
        if (await page.locator('main').getByRole('heading', { name: gone }).count()) fail(`the "${gone}" card is shown without any data`)
      }
    },
  })
  await tryAgain(page, desk)
  await until(comparison(() => deskGet(dashboardPath()), [
    ['appointments today', () => statNumber(page, 'Appointments today'), (api) => api.appointmentsToday],
    ['total patients', () => statNumber(page, 'Total patients'), (api) => api.patients],
    ['FRS opportunities', () => statNumber(page, 'FRS opportunities'), (api) => api.frs],
    ['rows in today\'s list', () => todaysCard().locator('ul > li').count(), (api) => api.todayAppointments.length],
  ]), 15000)
})

await r.step('Home: a refresh that fails keeps the last figures on screen and says that they could not be refreshed', async () => {
  const later = await newContext('dashboard refresh')
  const laterPage = await later.context.newPage()
  shotPage = laterPage
  try {
    await laterPage.clock.install() // the clock keeps running; it can also be moved forward
    await signedInAs(laterPage, adminToken, adminUser)
    await laterPage.goto(APP_URL + '/', { waitUntil: 'networkidle' })
    await heading(laterPage, `, ${ADMIN.name}`).waitFor({ timeout: 20000 })
    await ready(laterPage)
    const shown = await statValue(laterPage, 'Total patients')
    if (!(numberIn(shown) > 0)) fail(`the dashboard shows ${shown} patients before the refresh`)
    const restore = await breakApi(laterPage, 'no connection')
    try {
      await later.expecting([[0, '/api/']], async () => {
        await laterPage.clock.fastForward(61000) // the dashboard asks again every minute
        await saying(laterPage, 'Could not refresh today’s figures.').waitFor({ timeout: 15000 })
        if ((await statValue(laterPage, 'Total patients')) !== shown) fail('the figures changed although the refresh failed')
        if (await saying(laterPage, 'Could not load').count()) fail('figures that are on screen are reported as not loaded')
        await restore()
      })
    } finally {
      await restore()
    }
    await tryAgain(laterPage, later)
    await until(comparison(() => deskGet(dashboardPath()), [['total patients', () => statNumber(laterPage, 'Total patients'), (api) => api.patients]]), 15000)
  } finally {
    await later.context.close()
    shotPage = page
  }
})

{
  let turn = 0
  for (const [label, urlPath, title, fetchExpected, figures] of DESTINATIONS) {
    const kind = Object.keys(BROKEN)[(turn += 1) % 2]
    const spec = UNAVAILABLE[label]
    await r.step(`Sidebar → ${label} with ${kind}: says what it could not load (no empty state, no zero), and "Try again" brings the API's data`, async () => {
      if (!spec) fail(`this check does not know what "${label}" says when its data cannot be loaded`)
      await openWhileBroken(page, desk, kind, () => visit(page, urlPath, title), spec.says, {
        tabs: spec.tabs,
        allow: spec.allow,
        // A form with blank fields and switched-off switches would be a claim too (and could be saved).
        extra: label === 'Settings' ? async () => {
          if ((await page.locator('main input, main [role="switch"]').count()) > 0) fail('settings that could not be loaded are shown as a blank form')
        } : undefined,
      })
      await tryAgain(page, desk)
      await until(comparison(fetchExpected, figures), 15000) // no reload here: the data has to arrive through "Try again"
      // The tabs that were not open get their data too, without a second press.
      for (const [name] of spec.tabs ?? []) {
        await tab(page, name).click()
        await until(async () => (await alerts(page).count()) === 0 || `the tab "${name}" still says: ${(await alerts(page).first().innerText()).replace(/\s+/g, ' ')}`, 15000)
        await ready(page)
      }
    })
  }
}

await r.step('Sidebar → Clinical Charts with no connection: a chart that could not be loaded is not shown as a blank one that can be saved, and "Try again" opens it', async () => {
  const found = (await deskGet(`/api/patients?q=${DEMO_PATIENT_CODE}&limit=12&sort=name&order=asc`)).items[0]
  await visit(page, '/clinical', 'Clinical Charts')
  const restore = await breakApi(page, 'no connection', '**/api/charts**')
  try {
    await desk.expecting([[0, '/api/charts']], async () => {
      const picker = page.locator('main input[placeholder^="Search patient"]')
      await picker.click()
      await picker.fill(DEMO_PATIENT_CODE)
      await page.locator('main button').filter({ hasText: `${DEMO_PATIENT_CODE} ·` }).filter({ hasText: found.name }).click()
      await assertUnavailable(page, 'no connection', ['Could not load the periodontal chart'])
      if (await button(page.locator('main'), 'Save Chart').count()) fail('a chart that was not loaded can be saved (it would replace the one on record)')
      if (await page.locator('main').getByText('Bleeding on Probing').count()) fail('a blank periodontal chart is shown')
      await tab(page, 'Orthodontic Chart').click()
      await assertUnavailable(page, 'no connection', ['Could not load the orthodontic chart'])
      await tab(page, 'Periodontal Chart').click()
      await assertUnavailable(page, 'no connection', ['Could not load the periodontal chart'])
      await restore()
    })
  } finally {
    await restore()
  }
  await tryAgain(page, desk)
  await page.locator('main').getByText('Bleeding on Probing').waitFor()
  await button(page.locator('main'), 'Save Chart').waitFor()
})

await r.step('A patient profile with HTTP 500: it says it could not load (not "Patient not found"), each tab says so too (no all-healthy dental chart), and only an unknown patient is "not found"', async () => {
  const patient = (await deskGet(`/api/patients?q=${DEMO_PATIENT_CODE}`)).items.find((p) => p.code === DEMO_PATIENT_CODE)
  await openWhileBroken(page, desk, 'HTTP 500', () => visit(page, `/patients/${patient.id}`), ['Could not load this patient'], {
    extra: async () => {
      if (await page.locator('main').getByText('Patient not found').count()) fail('a patient whose record could not be loaded is reported as not found')
    },
  })
  await tryAgain(page, desk)
  await heading(page, patient.name).waitFor()

  const restore = await breakApi(page, 'HTTP 500')
  try {
    await desk.expecting([[500, '/api/']], async () => {
      // Not "Invoices": the Overview tab has loaded this patient's invoices already, so that tab has them to show.
      for (const [name, text] of [['Treatments', 'Could not load this patient’s treatments'], ['Procedures', 'Could not load this patient’s procedures'], ['Dental Chart', 'Could not load this patient’s dental chart'],
        ['Files', 'Could not load this patient’s files'], ['Consents', 'Could not load this patient’s consent forms'], ['Timeline', 'Could not load this patient’s timeline']]) {
        await tab(page, name).click()
        await until(async () => (await saying(page, text).count()) > 0 || `the tab "${name}" does not say "${text}"; it reads: ${await mainText(page)}`, 20000)
        await settled(page)
        const claims = (await page.locator('main').innerText()).split('\n').map((line) => line.trim()).filter((line) => /^(No|Nothing)\b/.test(line))
        if (claims.length) fail(`the tab "${name}" claims: ${claims.join(' | ')}`)
        if (await page.locator('main button[aria-label^="Tooth "]').count()) fail('a dental chart that could not be loaded is drawn, every tooth healthy')
      }
      await restore()
    })
  } finally {
    await restore()
  }
  await tryAgain(page, desk)
  await until(async () => (await page.locator('main').getByText(/No timeline entries yet|Previous Treatments/).count()) > 0 || `after "Try again" the timeline reads: ${await mainText(page)}`)

  await desk.expecting([[404, '/api/patients/']], async () => {
    await visit(page, '/patients/000000000000000000000000')
    await page.locator('main').getByText('Patient not found').waitFor({ timeout: 15000 })
    if (await alerts(page).count()) fail('a patient the API does not know is reported as a failed load')
  })
})

/* ------------------------------------------------- patient-app test data */

// A patient who registered and booked in the patient app: the source of the "App booking" badge,
// of two notifications for the front desk and of a "Patient App" conversation.
const fixture = { token: '', patientId: '', patientCode: '', appointmentId: '', conversationId: '', date: '', time: '', webTime: '', webAppointmentId: '' }
const patientApi = async (method, urlPath, body) => {
  const result = await patiently(() => apiCall(method, urlPath, body, fixture.token))
  if (result.status >= 400) fail(`${method} ${urlPath} as the app patient answered ${result.status}: ${JSON.stringify(result.data).slice(0, 160)}`)
  return result.data
}

await r.step('Test setup (API): a new patient registers with the clinic in the patient app, books a visit and sends a message', async () => {
  const clinicId = (await deskGet('/api/auth/me')).clinic_id
  const otp = await patientApi('POST', '/api/patient/auth/otp/request', { mobile: APP_PATIENT.mobile, purpose: 'signup' })
  if (!otp.dev_otp) fail('the API does not return development OTP codes (SMS_PROVIDER must be "console")')
  const { ticket } = await patientApi('POST', '/api/patient/auth/otp/verify', { mobile: APP_PATIENT.mobile, purpose: 'signup', code: otp.dev_otp })
  fixture.token = (await patientApi('POST', '/api/patient/auth/signup', { ticket, name: APP_PATIENT.name, password: APP_PATIENT.password, gender: 'Female', age: 31 })).access_token
  const joined = await patientApi('POST', '/api/patient/profiles/join', { clinic_id: clinicId })
  fixture.token = joined.access_token
  fixture.patientId = joined.profile.patient_id
  fixture.patientCode = joined.profile.code
  // Details as long as real ones get, so the layout checks see a profile that has to wrap.
  await deskApi('PATCH', `/api/patients/${fixture.patientId}`, {
    email: `e2e.web.patient.${tail}@example-dental-mail.test`, address: 'No. 12, Second Cross Street, Thillai Nagar West Extension', city: 'Tiruchirappalli',
    blood: 'B+', allergy: 'Penicillin and latex', doctor: BOOKED.doctor, treatment: 'Full Mouth Rehabilitation',
  })

  // A day well ahead with nothing booked, so no other check's slots are taken.
  for (let ahead = 30 + (stamp % 20); ahead < 85 && !fixture.date; ahead += 1) {
    const day = addDays(today, ahead)
    if ((await deskGet(`/api/appointments?date=${day}&limit=5`)).total === 0) fixture.date = day
  }
  if (!fixture.date) fail('no free day found for the test appointments')
  const { slots } = await patientApi('GET', `/api/patient/slots?date=${fixture.date}&doctor=${encodeURIComponent(BOOKED.doctor)}`)
  const open = slots.filter((slot) => slot.available).map((slot) => slot.time)
  if (open.length < 2) fail(`the patient API offers ${open.length} slots on ${fixture.date}`)
  fixture.time = open.includes('11:00') ? '11:00' : open[0]
  fixture.webTime = open.includes('15:00') ? '15:00' : open[open.length - 1]
  const booked = await patientApi('POST', '/api/patient/appointments', { date: fixture.date, time: fixture.time, doctor: BOOKED.doctor, reason: APP_REASON })
  fixture.appointmentId = booked.id
  if (booked.source !== 'Patient App') fail(`the booking has source ${JSON.stringify(booked.source)}`)
  await patientApi('POST', '/api/patient/chat', { text: CHAT_TEXT })
  const thread = (await deskGet(`/api/omni_conversations?patientId=${fixture.patientCode}`)).items[0]
  if (!thread || thread.channel !== 'Patient App') fail('the message did not open a "Patient App" conversation')
  fixture.conversationId = thread.id
})

/* ------------------------------------------------------ notification bell */

const bell = () => page.locator('header button[aria-label^="Notifications"]')
const bellPanel = () => page.locator('header div.shadow-pop').filter({ has: page.getByText('Notifications', { exact: true }) })
const notices = () => bellPanel().locator('ul > li')
const bellLabel = (unread) => (unread ? `Notifications, ${unread} unread` : 'Notifications')
const bellMatches = () =>
  figuresMatch(page, () => deskGet('/api/notifications'), [
    ['bell label', () => bell().getAttribute('aria-label'), (api) => bellLabel(api.unread)],
    ['badge', async () => ((await bell().locator('span').count()) ? (await bell().locator('span').innerText()).trim() : ''), (api) => (api.unread > 9 ? '9+' : api.unread ? String(api.unread) : '')],
  ])
const myNotice = (items, title) => items.find((n) => n.title === title && n.body.includes(APP_PATIENT.name))

await r.step('Notification bell: the unread count and the list equal /api/notifications', async () => {
  await visit(page, '/', `, ${ADMIN.name}`)
  await bellMatches()
  const api = await deskGet('/api/notifications')
  if (!myNotice(api.items, 'New booking from the patient app') || !myNotice(api.items, 'New patient from the app')) fail('the API has no notification for the app patient\'s registration and booking')
  if (api.unread < 2) fail(`the API counts ${api.unread} unread notifications after two new ones`)
  await bell().click()
  await bellPanel().waitFor()
  await figuresMatch(page, () => deskGet('/api/notifications'), [
    ['notifications listed', () => notices().count(), (fresh) => fresh.items.length],
    ['newest title', async () => (await notices().first().locator('span.font-semibold').innerText()).trim(), (fresh) => fresh.items[0].title],
    ['newest text', async () => (await notices().first().locator('span.text-xs.text-slate-500').innerText()).trim(), (fresh) => fresh.items[0].body],
    ['unread dots', () => notices().locator('span.bg-brand-600.rounded-full').count(), (fresh) => fresh.items.filter((n) => !n.read).length],
  ], async () => {
    await bell().click()
    await bellPanel().waitFor()
  })
  await button(bellPanel(), 'Mark all read').waitFor()
  await page.keyboard.press('Escape')
  await bellPanel().waitFor({ state: 'hidden' })
})

await r.step('Notification bell: opening a notification marks that one as read and goes to what it is about', async () => {
  const before = await deskGet('/api/notifications')
  const booking = myNotice(before.items, 'New booking from the patient app')
  const registered = myNotice(before.items, 'New patient from the app')
  if (booking.read || registered.read) fail('the new notifications are already read')

  await bell().click()
  await notices().filter({ hasText: booking.body }).click()
  await page.waitForURL(APP_URL + '/appointments')
  await bellPanel().waitFor({ state: 'hidden' })
  await until(async () => (await deskGet('/api/notifications')).items.find((n) => n.id === booking.id).read || 'the API still has the opened notification as unread')
  const after = await deskGet('/api/notifications')
  if (after.items.find((n) => n.id === registered.id).read) fail('opening one notification marked another one as read')
  await bellMatches()

  await bell().click()
  await notices().filter({ hasText: registered.body }).click()
  await page.waitForURL(`${APP_URL}/patients/${fixture.patientId}`)
  await heading(page, APP_PATIENT.name).waitFor({ timeout: 20000 })
  await until(async () => (await deskGet('/api/notifications')).items.find((n) => n.id === registered.id).read || 'the API still has the second notification as unread')
})

await r.step('Notification bell: "Mark all read" clears the unread count in the API and on the bell', async () => {
  const before = await deskGet('/api/notifications')
  await visit(page, '/', `, ${ADMIN.name}`)
  await bell().click()
  await bellPanel().waitFor()
  if (before.unread === 0) {
    // Nothing unread is left (no other activity on this database): the action must not be offered.
    if (await button(bellPanel(), 'Mark all read').count()) fail('"Mark all read" is offered with nothing unread')
  } else {
    const answered = page.waitForResponse((res) => res.url().includes('/api/notifications/read'))
    await button(bellPanel(), 'Mark all read').click()
    if ((await answered).status() !== 200) fail('marking all as read was refused')
    // Notifications that arrive after the click (other checks are running) may be unread again;
    // every one that was unread before it must now be read.
    const wereUnread = before.items.filter((n) => !n.read).map((n) => n.id)
    await until(async () => {
      const now = await deskGet('/api/notifications')
      const still = now.items.filter((n) => wereUnread.includes(n.id) && !n.read)
      return still.length === 0 || `${still.length} of ${wereUnread.length} notifications are still unread in the API`
    })
  }
  await page.keyboard.press('Escape')
  await bellMatches()
  const now = await deskGet('/api/notifications')
  if (now.unread === 0 && (await bell().locator('span').count())) fail('the bell still shows a badge with nothing unread')
})

/* ------------------------------------------------- appointments: writing */

const appointmentCard = (text) => dayAppointments().filter({ hasText: text })
const pageDate = () => page.locator('main input[type="date"]').first()
const showDay = async (day) => {
  await pageDate().fill(day)
  await ready(page)
}

await r.step('Appointments: the booking form warns about a taken slot, then books a free one for an existing patient', async () => {
  const patient = (await deskGet(`/api/patients?q=${BOOKED.code}`)).items.find((p) => p.code === BOOKED.code)
  if (!patient) fail(`the demo patient ${BOOKED.code} is missing`)
  await page.locator('aside').getByRole('button', { name: 'New Appointment' }).click()
  await page.waitForURL(/\/appointments/)
  const dlg = dialog(page, 'New Appointment')
  await dlg.waitFor()

  const posts = () => desk.requests.filter((req) => req.method === 'POST' && req.path === '/api/appointments').length
  const sentBefore = posts()
  await button(dlg, 'Book Appointment').click()
  await dlg.getByText('Choose a patient (or register a new one).').waitFor()
  await dlg.getByText('Enter the treatment or reason for visit.').waitFor()

  await dlg.locator('input[placeholder^="Search by name"]').fill(BOOKED.code)
  await dlg.locator('button').filter({ hasText: `${BOOKED.code} ·` }).filter({ hasText: patient.name }).click()
  await dlg.getByText(BOOKED.code, { exact: true }).waitFor()
  await field(dlg, 'Treatment / Reason').fill(TREATMENT)
  await field(dlg, 'Dentist').selectOption(BOOKED.doctor)
  await field(dlg, 'Chair').selectOption('Chair 03')
  await field(dlg, 'Date').fill(fixture.date)

  // The slot the app patient already holds with this dentist must be refused before anything is sent.
  await field(dlg, 'Time').selectOption(fixture.time)
  await dlg.getByText(`${BOOKED.doctor} already has ${APP_PATIENT.name}`).waitFor({ timeout: 10000 })
  await button(dlg, 'Book Appointment').click()
  await sawToast(page, `${BOOKED.doctor} already has ${APP_PATIENT.name}`)
  if (posts() !== sentBefore) fail('the form was sent although the slot is taken or fields are missing')

  await field(dlg, 'Time').selectOption(fixture.webTime)
  await dlg.getByText('already has').waitFor({ state: 'hidden' })
  const answered = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/appointments' && res.request().method() === 'POST')
  await button(dlg, 'Book Appointment').click()
  const response = await answered
  if (response.status() !== 201) fail(`booking answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`)
  fixture.webAppointmentId = (await response.json()).id
  await dlg.waitFor({ state: 'hidden' })
  await sawToast(page, `Appointment booked for ${patient.name}`)

  const saved = await deskGet(`/api/appointments/${fixture.webAppointmentId}`)
  for (const [key, wanted] of [['patient', patient.name], ['patientCode', BOOKED.code], ['date', fixture.date], ['time', fixture.webTime], ['treatment', TREATMENT], ['doctor', BOOKED.doctor], ['chair', 'Chair 03'], ['status', 'Scheduled']]) {
    if (saved[key] !== wanted) fail(`the API saved ${key}=${JSON.stringify(saved[key])}, the form said ${JSON.stringify(wanted)}`)
  }
})

await r.step('Appointments: the new booking is in the day view and in "All Upcoming", found by search', async () => {
  await openFromSidebar('Appointments', '/appointments', 'Appointments')
  await showDay(fixture.date)
  await appointmentCard(TREATMENT).waitFor()
  await figuresMatch(page, () => deskGet(`/api/appointments?date=${fixture.date}&sort=time&order=asc&limit=300`), [
    ['appointments that day', () => dayAppointments().count(), (api) => api.total],
    ['status of the new booking', async () => (await appointmentCard(TREATMENT).locator('span.rounded-full').first().innerText()).trim(), (api) => api.items.find((a) => a.id === fixture.webAppointmentId).status],
  ], () => showDay(fixture.date))
  if (!(await appointmentCard(TREATMENT).innerText()).includes(`${BOOKED.doctor} · Chair 03`)) fail('the card does not show the dentist and chair that were chosen')

  await button(page.locator('main'), 'All Upcoming').click()
  await page.locator('main input[type="search"]').fill(TREATMENT)
  await until(async () => (await listRows().count()) === 1 || `the search lists ${await listRows().count()} appointments for "${TREATMENT}"`)
  const found = (await deskGet(`/api/appointments?q=${encodeURIComponent(TREATMENT)}&sort=date&order=desc&limit=300`)).items
  if (found.length !== 1 || found[0].id !== fixture.webAppointmentId) fail('the API search does not return exactly the new booking')
  await page.locator('main input[type="search"]').fill('')
  await button(page.locator('main'), 'Day').click()
})

await r.step('Appointments: a booking made in the patient app carries one "App booking" badge, a front-desk booking none', async () => {
  await openFromSidebar('Appointments', '/appointments', 'Appointments')
  await showDay(fixture.date)
  const app = appointmentCard(APP_REASON)
  await app.waitFor()
  const fromApi = (await deskGet(`/api/appointments?date=${fixture.date}&limit=300`)).items
  if (fromApi.find((a) => a.id === fixture.appointmentId)?.source !== 'Patient App') fail('the API does not mark the app booking with source "Patient App"')
  if (fromApi.find((a) => a.id === fixture.webAppointmentId)?.source === 'Patient App') fail('the API marks the front-desk booking as an app booking')
  const badges = await app.getByText('App booking', { exact: true }).count()
  if (badges !== 1) fail(`the app booking shows ${badges} "App booking" badges in the day view`)
  if (await appointmentCard(TREATMENT).getByText('App booking', { exact: true }).count()) fail('the front-desk booking is badged as an app booking')
  if (!(await app.innerText()).includes(APP_PATIENT.name)) fail('the app booking does not show the patient\'s name')

  await button(page.locator('main'), 'All Upcoming').click()
  await page.locator('main input[type="search"]').fill(APP_PATIENT.name)
  await until(async () => (await listRows().count()) === 1 || `"All Upcoming" lists ${await listRows().count()} appointments for the app patient`)
  const inList = await listRows().first().getByText('App booking', { exact: true }).count()
  if (inList !== 1) fail(`the app booking shows ${inList} "App booking" badges in "All Upcoming"`)
  await page.locator('main input[type="search"]').fill('')
  await button(page.locator('main'), 'Day').click()
})

await r.step('Appointments: cancelling asks first, then the booking is cancelled in the API', async () => {
  await openFromSidebar('Appointments', '/appointments', 'Appointments')
  await showDay(fixture.date)
  const card = appointmentCard(TREATMENT)
  await button(card, 'Cancel').click()
  const confirm = dialog(page, 'Cancel this appointment?')
  await confirm.waitFor()
  if (!(await confirm.innerText()).includes(TREATMENT)) fail('the confirmation does not say which appointment it is about')
  await button(confirm, 'Cancel').click() // "Cancel" here keeps the appointment
  await confirm.waitFor({ state: 'hidden' })
  if ((await deskGet(`/api/appointments/${fixture.webAppointmentId}`)).status !== 'Scheduled') fail('the appointment was cancelled without confirmation')

  await button(card, 'Cancel').click()
  await button(dialog(page, 'Cancel this appointment?'), 'Cancel Appointment').click()
  await sawToast(page, 'Appointment cancelled')
  await until(async () => (await deskGet(`/api/appointments/${fixture.webAppointmentId}`)).status === 'Cancelled' || 'the API still has the appointment as scheduled')
  await until(async () => (await card.locator('span.rounded-full').first().innerText()).trim() === 'Cancelled' || 'the card does not show "Cancelled"')
  if (await card.getByRole('button').count()) fail('a cancelled appointment still offers actions')
})

/* ------------------------------------------- omni: the patient app channel */

await r.step('Omnichannel: the "Patient App" channel lists the app conversation, and a reply reaches the patient', async () => {
  await openFromSidebar('Omni-channel', '/omni', 'Omnichannel Communication')
  const rows = page.locator('main ul > li')
  await button(page.locator('main'), 'Patient App').click()
  await figuresMatch(page, () => deskGet('/api/omni_conversations?limit=200&sort=updated_at&order=desc'), [
    ['conversations under "Patient App"', () => rows.count(), (api) => api.items.filter((c) => c.channel === 'Patient App').length],
    ['their channel line', async () => (await rows.locator('span.text-slate-400.truncate').allInnerTexts()).every((line) => line.startsWith('Patient App · ')), () => true],
  ], async () => button(page.locator('main'), 'Patient App').click())
  const mine = rows.filter({ hasText: APP_PATIENT.name })
  if (!(await mine.innerText()).includes(CHAT_TEXT)) fail('the conversation does not show the patient\'s message')
  await button(page.locator('main'), 'WhatsApp').click()
  await until(async () => (await rows.filter({ hasText: APP_PATIENT.name }).count()) === 0 || 'the app conversation is listed under WhatsApp')
  await button(page.locator('main'), 'Patient App').click()

  await mine.locator('button').click()
  await page.locator('main').getByText('Patient App · Patient app chat · Consent: Opted-in').waitFor()
  await page.locator('main p').filter({ hasText: CHAT_TEXT }).waitFor()
  await until(async () => (await deskGet(`/api/omni_conversations/${fixture.conversationId}`)).unread === 0 || 'opening the conversation did not clear its unread count in the API')
  await page.locator('main textarea').fill(REPLY_TEXT)
  await page.locator('main').getByRole('button', { name: 'Send message' }).click()
  await sawToast(page, 'Message added to Patient App conversation')
  await page.locator('main p').filter({ hasText: REPLY_TEXT }).waitFor()
  await until(async () => {
    const { messages } = await patientApi('GET', '/api/patient/chat')
    return messages.some((m) => m.text === REPLY_TEXT && m.mine === false) || 'the reply is not in the patient\'s chat'
  })
})

/* --------------------------------------------- settings: saving a change */

// The two settings this step changes are stored but read by nothing in the product yet ("Phase 2" on
// the page), so having them changed for a moment disturbs neither the clinic nor the other checks
// that use this database.
const PAGE_SETTING = { key: 'smartQueue', label: 'Smart queue' }
const API_SETTING = { key: 'lowStockAlert', label: 'Low stock alerts' }

await r.step('Settings: a save sends only the setting that was changed (PATCH), does not undo a setting changed elsewhere in the meantime, and sends nothing when nothing changed', async () => {
  const before = await deskGet('/api/settings')
  const original = Boolean(before[PAGE_SETTING.key])
  const elsewhere = !before[API_SETTING.key] // what somebody else sets while the page is open
  const toggle = settingSwitch(PAGE_SETTING.label)
  const other = settingSwitch(API_SETTING.label)
  const save = page.locator('main').getByRole('button', { name: /Save Changes|Saved/ }).first()
  const offers = async (label) => (await save.innerText()).trim() === label
  const writes = () => desk.requests.filter((req) => req.path === '/api/settings' && req.method !== 'GET')
  const saveAndCatch = async () => {
    const answered = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/settings' && res.request().method() !== 'GET')
    await save.click()
    const response = await answered
    if (response.status() !== 200) fail(`saving answered ${response.status()}`)
    return response.request()
  }
  const only = (request, value) => {
    if (request.method() !== 'PATCH') fail(`the page saved with ${request.method()} (the whole map), not PATCH`)
    const wanted = { values: { [PAGE_SETTING.key]: value } }
    if (JSON.stringify(request.postDataJSON()) !== JSON.stringify(wanted)) fail(`the request carried ${request.postData()}, expected only ${JSON.stringify(wanted)}`)
  }
  try {
    await openFromSidebar('Settings', '/settings', 'Settings')
    await until(async () => (await toggle.getAttribute('aria-checked')) === String(original) || 'the switch does not show the saved value')
    if ((await other.getAttribute('aria-checked')) !== String(!elsewhere)) fail(`the "${API_SETTING.label}" switch does not show the saved value`)
    const sent = writes().length
    if (await save.isEnabled()) fail('"Save" is offered before anything changed')

    // Nothing changed: a switch flipped and flipped back, a text typed and removed again.
    await toggle.click()
    await until(async () => (await offers('Save Changes')) || 'a flipped switch does not offer "Save Changes"')
    await toggle.click()
    const registration = field(page.locator('main'), 'Registration No.')
    const typed = await registration.inputValue()
    await registration.fill(`${typed} X`)
    await until(async () => (await offers('Save Changes')) || 'a changed text does not offer "Save Changes"')
    await registration.fill(typed)
    await until(async () => ((await offers('Saved')) && !(await save.isEnabled())) || 'with everything put back the page still offers to save')
    if (await button(page.locator('main'), 'Save Changes').count()) fail('with nothing changed a "Save Changes" button is still on the page')
    if (writes().length !== sent) fail('a request was sent although nothing was changed')

    // One setting is changed on the page; before it is saved, another one is changed elsewhere.
    await toggle.click()
    await deskApi('PATCH', '/api/settings', { values: { [API_SETTING.key]: elsewhere } })
    only(await saveAndCatch(), !original)
    await sawToast(page, 'Settings saved')
    const saved = await deskGet('/api/settings')
    if (Boolean(saved[PAGE_SETTING.key]) !== !original) fail('the changed setting did not reach the API')
    if (Boolean(saved[API_SETTING.key]) !== elsewhere) fail(`saving on the page put "${API_SETTING.label}" back to ${!elsewhere}: the change made elsewhere was undone`)
    // The page shows what is saved now, the other change included, and has nothing left to save.
    await until(async () => (await offers('Saved')) || 'the page still says there are unsaved changes')
    await until(async () => (await toggle.getAttribute('aria-checked')) === String(!original) || 'the switch jumped back after saving')
    await until(async () => (await other.getAttribute('aria-checked')) === String(elsewhere) || `the page does not show what "${API_SETTING.label}" was set to elsewhere`)
    if (writes().length !== sent + 1) fail(`${writes().length - sent} requests were sent for one save`)

    // And back, again through the page: one PATCH with one setting.
    await toggle.click()
    only(await saveAndCatch(), original)
    await sawToast(page, 'Settings saved')
    await until(async () => (await offers('Saved')) || 'the page still says there are unsaved changes')
    await deskApi('PATCH', '/api/settings', { values: { [API_SETTING.key]: !elsewhere } })

    const after = await deskGet('/api/settings')
    // "doubleBooking" is switched by another check that may be running; a switch that was never
    // stored reads as off, exactly as the page shows it.
    const shown = (value) => (value === undefined || value === false ? false : value)
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (key !== 'doubleBooking' && JSON.stringify(shown(after[key])) !== JSON.stringify(shown(before[key]))) fail(`the saves changed "${key}" from ${JSON.stringify(before[key])} to ${JSON.stringify(after[key])}`)
    }
    await page.reload({ waitUntil: 'networkidle' })
    await until(async () => (await toggle.getAttribute('aria-checked')) === String(original) || 'after a reload the switch is not back at its original value')
    await until(async () => (await other.getAttribute('aria-checked')) === String(!elsewhere) || `after a reload "${API_SETTING.label}" is not back at its original value`)
  } finally {
    const now = await deskGet('/api/settings')
    const back = {}
    for (const key of [PAGE_SETTING.key, API_SETTING.key]) if (Boolean(now[key]) !== Boolean(before[key])) back[key] = Boolean(before[key])
    if (Object.keys(back).length) await deskApi('PATCH', '/api/settings', { values: back })
  }
})

/* ------------------------------------------ settings: who may change them */

// Only a Clinic Owner, an Administrator and the Super Admin (managing a clinic) may change the
// settings or the dashboard banner; the API answers 403 to every other login. For those the page is
// the same form to read, with nothing on it to change or save.
const READ_ONLY = 'You can view these settings, but only the clinic owner or an administrator can change them.'
const readOnlyNote = (target) => target.locator('main [role="note"]')

/**
 * Every control on the Settings page that is open: its name, its kind (field, switch, button) and
 * whether it is disabled. `own` marks the form for the signed-in person's own password, which is
 * not a clinic setting and stays theirs to use whatever their role.
 */
const settingsControls = (target) =>
  target.locator('main').evaluate((main) => {
    const words = (node) => (node?.textContent ?? '').replace('*', '').replace(/\s+/g, ' ').trim()
    return [...main.querySelectorAll('input, select, textarea, button')].map((el) => {
      const label = el.closest('label')
      const kind = el.getAttribute('role') === 'switch' ? 'switch' : el.tagName === 'BUTTON' ? 'button' : 'field'
      const name = kind === 'switch' ? words(label?.querySelector('span > span')?.firstChild) : kind === 'button' ? words(el) : words(label?.querySelector('span'))
      return { name, kind, disabled: el.disabled, own: Boolean(el.closest('form')) }
    })
  })
/** The fields and switches that hold the clinic's settings and its banner. */
const settingNames = (controls) => controls.filter((c) => !c.own && c.kind !== 'button').map((c) => `${c.name} (${c.kind})`)
const saveActions = (controls) => controls.filter((c) => c.kind === 'button' && /save/i.test(c.name)).map((c) => c.name)
/** What can be used on a page that is read-only: nothing but "Export" (a download of what is on screen) and the own-password form. */
const usable = (controls) => controls.filter((c) => !c.own && !c.disabled).map((c) => c.name)
const OWN_PASSWORD = ['Current Password', 'New Password', 'Confirm New Password', 'Update Password']
/** Requests a tab sent that would change the settings or the banner. */
const settingsWrites = (watcher, from = 0) => watcher.requests.filter((req) => req.at >= from && req.method !== 'GET' && /^\/api\/(settings|advertisement)/.test(req.path))

/** A click where the element is, as a person makes it: no waiting for something there that can be clicked. */
async function clickOn(target, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) fail('the element to click is not on the page')
  await target.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/**
 * Somebody who may change the settings does so on the Settings page that is open: one switch is
 * flipped and saved, then flipped back and saved. Each save is one accepted PATCH, and `stored`
 * (the API's settings of that clinic) has the value afterwards.
 */
async function changesASetting(target, stored) {
  if (await readOnlyNote(target).count()) fail(`the page is read-only: "${(await readOnlyNote(target).innerText()).trim()}"`)
  const toggle = switchOn(target, PAGE_SETTING.label)
  const original = Boolean((await stored())[PAGE_SETTING.key])
  await until(async () => (await toggle.getAttribute('aria-checked')) === String(original) || 'the switch does not show the saved value')
  for (const value of [!original, original]) {
    await toggle.click()
    const answered = target.waitForResponse((res) => new URL(res.url()).pathname === '/api/settings' && res.request().method() === 'PATCH')
    await button(target.locator('main'), 'Save Changes').first().click()
    const response = await answered
    if (response.status() !== 200) fail(`saving answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`)
    await sawToast(target, 'Settings saved')
    if (Boolean((await stored())[PAGE_SETTING.key]) !== value) fail(`after the save the API does not have "${PAGE_SETTING.label}" as ${value}`)
    await until(async () => (await toggle.getAttribute('aria-checked')) === String(value) || 'the switch jumped back after saving')
  }
}

/* -------------------------------------------- staff: logins & app access */

const loginRow = (email) => page.locator('main ul > li').filter({ hasText: email })
const openLogins = async () => {
  await openFromSidebar('Staff', '/staff', 'Staff')
  await tab(page, 'Logins & app access').click()
  await button(page.locator('main'), 'Add Login').waitFor()
  await ready(page)
}
/** The "Add Login" dialog, opened and filled in if an earlier step did not leave it that way. */
async function addLoginDialog() {
  const dlg = dialog(page, 'Add Login')
  if (!(await dlg.count())) {
    await openLogins()
    await button(page.locator('main'), 'Add Login').click()
    await dlg.waitFor()
    await field(dlg, 'Full Name').fill(DESK_LOGIN.name)
    await field(dlg, 'Email').fill(DESK_LOGIN.email)
    await field(dlg, 'Initial Password').fill(DESK_LOGIN.password)
  }
  return dlg
}
const loginPosts = () => desk.requests.filter((req) => req.method === 'POST' && req.path === '/api/clinic/users').length
/** Presses "Add Login" in the dialog and returns the API's answer to it. */
async function submitNewLogin(dlg) {
  const answered = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/clinic/users' && res.request().method() === 'POST')
  await button(dlg, 'Add Login').click()
  const response = await answered
  return { status: response.status(), data: await response.json().catch(() => ({})) }
}
let deskLogin = null

await r.step('Staff logins: every login of the clinic is listed with its role, app and status as in /api/clinic/users', async () => {
  await openLogins()
  await figuresMatch(page, () => deskGet('/api/clinic/users'), [
    ['logins listed', () => page.locator('main ul > li').count(), (api) => api.items.length],
    ['administrator row', async () => (await loginRow(ADMIN.email).innerText()).replace(/\s+/g, ' ').trim(), (api) => {
      const me = api.items.find((l) => l.email === ADMIN.email)
      return `${me.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()} ${me.name} You ${me.email} ${me.role} Web ${me.status} Edit`
    }],
    ['owner row', async () => (await loginRow(OWNER.email).innerText()).replace(/\s+/g, ' ').includes('Clinic Owner Web + Owner app Active'), () => true],
    ['consultant row', async () => (await loginRow(CONSULTANT.email).innerText()).replace(/\s+/g, ' '), (api) => {
      const c = api.items.find((l) => l.email === CONSULTANT.email)
      return `${c.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()} ${c.name} ${c.email} · linked to ${c.consultant_name} Consultant Consultant app ${c.status} Edit ${c.status === 'Active' ? 'Deactivate' : 'Activate'}`
    }],
  ], async () => tab(page, 'Logins & app access').click())
})

await r.step('Staff logins: the signed-in administrator cannot deactivate or re-role their own login', async () => {
  await openLogins()
  const mine = loginRow(ADMIN.email)
  if (await mine.getByRole('button', { name: /Deactivate|Activate/ }).count()) fail('the administrator is offered to deactivate their own login')
  await button(mine, 'Edit').click()
  const dlg = dialog(page, 'Edit Login')
  await dlg.waitFor()
  if (!(await field(dlg, 'Role').isDisabled())) fail('the administrator can change their own role')
  await dlg.getByText('You cannot change your own role.').waitFor()
  if (await field(dlg, 'Email').count()) fail('the email of an existing login can be edited')
  await closeDialog(dlg)
})

await r.step('Staff logins: a Consultant login needs a free consultant profile; an administrator cannot create an owner', async () => {
  await openLogins()
  await button(page.locator('main'), 'Add Login').click()
  const dlg = dialog(page, 'Add Login')
  await dlg.waitFor()
  const { items: logins, roles } = await deskGet('/api/clinic/users')
  const offeredRoles = await field(dlg, 'Role').locator('option').allTextContents()
  if (JSON.stringify(offeredRoles) !== JSON.stringify(roles)) fail(`roles offered: ${offeredRoles.join(', ')}; the API lists ${roles.join(', ')}`)

  await field(dlg, 'Full Name').fill(DESK_LOGIN.name)
  await field(dlg, 'Email').fill(DESK_LOGIN.email)
  await field(dlg, 'Initial Password').fill(DESK_LOGIN.password)
  await field(dlg, 'Role').selectOption('Consultant')
  const profiles = (await deskGet('/api/consultants?limit=200&sort=name&order=asc')).items
  const taken = logins.map((l) => l.consultant_id).filter(Boolean)
  const free = profiles.filter((p) => !taken.includes(p.id))
  if (!taken.length || !free.length) fail('the demo data needs a consultant with a login and one without')
  await until(async () => (await field(dlg, 'Consultant profile').locator('option').count()) === free.length + 1 || `${(await field(dlg, 'Consultant profile').locator('option').count()) - 1} profiles offered, ${free.length} are free`)
  const offered = await field(dlg, 'Consultant profile').locator('option').evaluateAll((options) => options.map((o) => o.value).filter(Boolean))
  if (JSON.stringify([...offered].sort()) !== JSON.stringify(free.map((p) => p.id).sort())) fail('the profiles offered are not exactly the consultants without a login')
  for (const id of taken) if (offered.includes(id)) fail('a consultant who already has a login is offered')

  const before = loginPosts()
  await button(dlg, 'Add Login').click()
  await sawToast(page, 'Choose the consultant profile this login belongs to.')
  if (loginPosts() !== before) fail('the form was sent without a consultant profile')

  await field(dlg, 'Role').selectOption('Clinic Owner')
  if (await field(dlg, 'Consultant profile').count()) fail('the profile chooser stays for a role that is not Consultant')
  await desk.expecting([[403, '/api/clinic/users', 'POST']], async () => {
    const refused = await submitNewLogin(dlg)
    if (refused.status !== 403) fail(`an administrator creating an owner was answered ${refused.status}`)
    await sawToast(page, refused.data.detail)
  })
  if ((await deskGet('/api/clinic/users')).items.some((l) => l.email === DESK_LOGIN.email)) fail('an owner login was created by an administrator')
})

await r.step('Staff logins: a duplicate email and a weak password are refused with the API\'s messages', async () => {
  const dlg = await addLoginDialog()
  await field(dlg, 'Role').selectOption('Receptionist')
  await desk.expecting([[409, '/api/clinic/users', 'POST'], [400, '/api/clinic/users', 'POST']], async () => {
    await field(dlg, 'Email').fill(OWNER.email)
    const duplicate = await submitNewLogin(dlg)
    if (duplicate.status !== 409) fail(`expected 409 for a duplicate email, got ${duplicate.status}`)
    await sawToast(page, duplicate.data.detail)

    await field(dlg, 'Email').fill(DESK_LOGIN.email)
    await field(dlg, 'Initial Password').fill(DESK_LOGIN.weakPassword)
    const weak = await submitNewLogin(dlg)
    if (weak.status !== 400 || !/strong password/i.test(weak.data.detail || '')) fail(`a weak password was answered ${weak.status} ${JSON.stringify(weak.data)} (is the strong-password rule on?)`)
    await sawToast(page, weak.data.detail)
  })
  if ((await deskGet('/api/clinic/users')).items.some((l) => l.email === DESK_LOGIN.email)) fail('the login was created despite the weak password')
})

await r.step('Staff logins: a Receptionist login is added and listed as active', async () => {
  const dlg = await addLoginDialog()
  await field(dlg, 'Role').selectOption('Receptionist')
  await field(dlg, 'Email').fill(DESK_LOGIN.email)
  await field(dlg, 'Initial Password').fill(DESK_LOGIN.password)
  const created = await submitNewLogin(dlg)
  if (created.status !== 201) fail(`expected 201, got ${created.status}: ${JSON.stringify(created.data)}`)
  await dlg.waitFor({ state: 'hidden' })
  await sawToast(page, `${DESK_LOGIN.name} can sign in now`)
  const row = loginRow(DESK_LOGIN.email)
  await row.waitFor()
  if (!(await row.innerText()).replace(/\s+/g, ' ').includes(`${DESK_LOGIN.name} ${DESK_LOGIN.email} Receptionist Web Active Edit Deactivate`)) fail(`the new row reads "${(await row.innerText()).replace(/\s+/g, ' ')}"`)
  deskLogin = (await deskGet('/api/clinic/users')).items.find((l) => l.email === DESK_LOGIN.email)
  if (!deskLogin || deskLogin.role !== 'Receptionist' || deskLogin.status !== 'Active') fail(`the API does not list the new login as an active Receptionist: ${JSON.stringify(deskLogin)}`)
})

await r.step('Staff logins: an administrator cannot reset the owner\'s password', async () => {
  await openLogins()
  // Sent with the owner's current password, so even a wrongly accepted request would change nothing.
  await loginRow(OWNER.email).getByRole('button', { name: /^Reset password for/ }).click()
  const dlg = dialog(page, 'Reset Password')
  await dlg.waitFor()
  await field(dlg, 'New Password').fill(OWNER.password)
  await desk.expecting([[403, '/reset-password', 'POST']], async () => {
    const answered = page.waitForResponse((res) => res.url().includes('/reset-password'))
    await button(dlg, 'Reset Password').click()
    const response = await answered
    if (response.status() !== 403) fail(`resetting the owner's password as an administrator answered ${response.status()}`)
    await sawToast(page, (await response.json()).detail)
  })
  await closeDialog(dlg)
})

await r.step('Staff logins: resetting a password makes the old one fail and the new one work', async () => {
  if (!deskLogin) fail('the login was not created')
  await openLogins()
  await loginRow(DESK_LOGIN.email).getByRole('button', { name: `Reset password for ${DESK_LOGIN.name}` }).click()
  const dlg = dialog(page, 'Reset Password')
  await dlg.waitFor()
  if (!(await dlg.innerText()).includes(DESK_LOGIN.email)) fail('the dialog does not say whose password is reset')
  const resets = () => desk.requests.filter((req) => req.path.includes('/reset-password')).length
  const before = resets()
  await field(dlg, 'New Password').fill('short')
  await button(dlg, 'Reset Password').click()
  await sawToast(page, 'Password must be at least 8 characters.')
  if (resets() !== before) fail('a too-short password was sent to the API')
  await desk.expecting([[400, '/reset-password', 'POST']], async () => {
    await field(dlg, 'New Password').fill(DESK_LOGIN.weakPassword)
    const answered = page.waitForResponse((res) => res.url().includes('/reset-password'))
    await button(dlg, 'Reset Password').click()
    const weak = await answered
    if (weak.status() !== 400) fail(`a weak new password was answered ${weak.status()}`)
    await sawToast(page, (await weak.json()).detail)
  })
  await field(dlg, 'New Password').fill(DESK_LOGIN.resetPassword)
  const answered = page.waitForResponse((res) => res.url().includes('/reset-password'))
  await button(dlg, 'Reset Password').click()
  if ((await answered).status() !== 200) fail('the reset was refused')
  await dlg.waitFor({ state: 'hidden' })
  await sawToast(page, `Password reset for ${DESK_LOGIN.name}`)

  const old = await apiSignIn(DESK_LOGIN.email, DESK_LOGIN.password)
  if (old.status !== 401) fail(`the old password was answered ${old.status} after the reset`)
  const fresh = await apiSignIn(DESK_LOGIN.email, DESK_LOGIN.resetPassword)
  if (fresh.status !== 200) fail(`sign-in with the new password answered ${fresh.status}: ${JSON.stringify(fresh.data)}`)
  guestToken = fresh.data.access_token
  guestUser = fresh.data.user
})

/* -------------------------------------------- a login without admin rights */

const guest = await newContext('receptionist')
const guestPage = await guest.context.newPage()
await stepOn(guestPage, 'A Receptionist sees the Staff directory without the logins tab, and the API refuses them the list', async () => {
  if (!guestToken) fail('the Receptionist could not sign in')
  await signedInAs(guestPage, guestToken, guestUser)
  await visit(guestPage, '/staff', 'Staff')
  const staff = await call(guestToken, 'GET', '/api/staff?sort=code&order=asc')
  await until(async () => (await guestPage.locator('main div.shadow-card ul > li').count()) === staff.items.length || 'the Receptionist does not see the team directory')
  if (await guestPage.locator('[role="tab"]').count()) fail('a Receptionist is shown tabs on the Staff page')
  if (await guestPage.getByText('Logins & app access').count()) fail('a Receptionist is shown "Logins & app access"')
  const refused = await apiCall('GET', '/api/clinic/users', undefined, guestToken)
  if (refused.status !== 403) fail(`GET /api/clinic/users as a Receptionist answered ${refused.status}`)
})

const isoIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const niceDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}` }

await r.step('Appointments: a move made in the reception app shows in "Rescheduled" with its first time, and in the week and month views', async () => {
  const patient = (await deskApi('GET', '/api/clinic-app/patients?q=DEN-1001')).items[0]
  const doctor = (await deskApi('GET', '/api/clinic-app/doctors')).items.find((d) => d.kind === 'in-house').name
  const freeOn = async (offset) => {
    for (let i = 0; i < 30; i += 1) {
      const day = isoIn(offset + i)
      const free = (await deskApi('GET', `/api/clinic-app/slots?date=${day}&doctor=${encodeURIComponent(doctor)}`)).slots.filter((x) => x.available)
      if (free.length) return { day, time: free[free.length - 1].time }
    }
    fail('no free slot')
  }
  const a = await freeOn(50)
  const made = await deskApi('POST', '/api/clinic-app/appointments', { patient_id: patient.id, doctor, date: a.day, time: a.time, treatment: `E2E move ${stamp}` })
  const b = await freeOn(52)
  await deskApi('PATCH', `/api/appointments/${made.id}`, { date: b.day, time: b.time })
  await openFromSidebar('Appointments', '/appointments', 'Appointments')
  await button(page.locator('main'), 'Rescheduled').click()
  await page.getByTestId(`rescheduled-${made.code}`).waitFor()
  await page.getByTestId(`rescheduled-${made.code}`).getByText(niceDate(a.day), { exact: false }).waitFor()
  await button(page.locator('main'), 'Month').click()
  await page.getByTestId('month-view').waitFor()
  const wanted = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(b.day.slice(5, 7)) - 1]} ${b.day.slice(0, 4)}`
  for (let i = 0; i < 6 && !(await page.getByTestId('month-label').innerText()).includes(wanted); i += 1) await page.getByRole('button', { name: 'Next month' }).click()
  if (!(await page.getByTestId('month-label').innerText()).includes(wanted)) fail(`the month view did not reach ${wanted}`)
  const counts = (await deskApi('GET', `/api/clinic-app/appointments/month?month=${b.day.slice(0, 7)}`)).days
  await until(async () => (await page.getByTestId(`month-day-${b.day}`).innerText()).includes(String(counts[b.day])) || 'the month cell does not show the API count')
  await page.getByTestId(`month-day-${b.day}`).click()
  await button(page.locator('main'), 'Week').click()
  await page.getByTestId(`week-day-${b.day}`).getByText(patient.name, { exact: false }).first().waitFor()
  await deskApi('POST', `/api/clinic-app/appointments/${made.id}/cancel`, { reason: 'E2E clean-up' })
})

await r.step('Masters: a procedure is added with its fee, GST and doctor share, checked by the API', async () => {
  await openFromSidebar('Masters', '/masters', 'Masters')
  await page.getByRole('tab', { name: 'Treatment fees' }).click()
  await page.getByTestId('fee-add').click()
  await page.getByTestId('fee-name').fill(`E2E Night guard ${stamp}`)
  await page.getByTestId('fee-save').click()
  await page.getByTestId('fee-error').filter({ hasText: 'Enter the fee.' }).waitFor()
  await page.getByTestId('fee-price').fill('3200')
  await page.getByTestId('fee-tax').selectOption('18')
  await page.getByTestId('fee-share').fill('25')
  await page.getByTestId('fee-save').click()
  await until(async () => (await deskApi('GET', `/api/treatment_masters?q=${encodeURIComponent(`E2E Night guard ${stamp}`)}`)).items.length === 1 || 'the procedure is not in the API')
  const row = (await deskApi('GET', `/api/treatment_masters?q=${encodeURIComponent(`E2E Night guard ${stamp}`)}`)).items[0]
  if (row.price !== 3200 || row.tax !== 18 || row.doctorShare !== 25) fail(`the API has ${JSON.stringify(row)}`)
  await page.getByTestId(`fee-row-${row.code}`).waitFor()
  await deskApi('PATCH', `/api/treatment_masters/${row.id}`, { status: 'Inactive' })
})

await r.step('Patient profile: the case sheet lists the patient\'s plan and visits; the virtual card shows the patient', async () => {
  const p = (await deskApi('GET', '/api/patients?q=DEN-1001')).items[0]
  await visit(page, `/patients/${p.id}`, null)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByTestId('open-case-sheet').click()
  await page.getByTestId('case-sheet').getByText(`${p.name} (${p.code})`).waitFor()
  const plan = (await deskApi('GET', `/api/patient_treatments?patientId=${p.code}&limit=50`)).items
  if (plan.length) await page.getByTestId('case-sheet').getByText(plan[0].name, { exact: false }).first().waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByTestId('open-virtual-card').click()
  await page.getByTestId('virtual-card').getByText(p.code).waitFor()
  await page.keyboard.press('Escape')
})

await r.step('Accounts: this month\'s income, expenses and net equal the API; consultants show their load', async () => {
  await openFromSidebar('Accounts', '/accounts', 'Billing & Accounts')
  const s = await deskApi('GET', '/api/clinic-app/accounts/summary')
  await until(async () => (await statValue(page, 'Income this month')) === inr(s.collected) || `income ${await statValue(page, 'Income this month')} vs ${inr(s.collected)}`)
  await until(async () => (await statValue(page, 'Expenses this month')) === inr(s.expenses) || 'expenses differ')
  await openFromSidebar('Consultants', '/consultants', 'Consultants')
  const stats = (await deskApi('GET', '/api/clinic-app/analytics/consultants')).items
  const kumar = stats.find((x) => x.name === 'Dr. Kumar')
  const code = (await deskApi('GET', '/api/consultants?q=Dr. Kumar')).items[0].code
  await page.getByTestId(`consultant-stats-${code}`).getByText(`${kumar.appointments} appts`).waitFor()
})

await r.step('Expenses: the form checks its input, the expense is recorded in the API and listed', async () => {
  await openFromSidebar('Expenses', '/expenses', 'Expenses')
  await page.getByTestId('expense-add').click()
  await page.getByTestId('expense-save').click()
  await page.getByTestId('expense-error').filter({ hasText: 'Choose the category.' }).waitFor()
  await page.getByTestId('expense-category').selectOption('Miscellaneous')
  await page.getByTestId('expense-amount').fill('450')
  await page.getByTestId('expense-payee').fill(`E2E Stationery ${stamp}`)
  await page.getByTestId('expense-save').click()
  await until(async () => (await deskGet(`/api/expenses?q=${encodeURIComponent(`E2E Stationery ${stamp}`)}`)).items.length === 1 || 'the expense is not in the API')
  const mine = (await deskGet(`/api/expenses?q=${encodeURIComponent(`E2E Stationery ${stamp}`)}`)).items[0]
  await page.getByTestId(`expense-row-${mine.code}`).waitFor()
  if (mine.amount !== 450 || mine.category !== 'Miscellaneous') fail(`the API has ${JSON.stringify(mine)}`)
})

await stepOn(guestPage, 'A Receptionist has no Expenses entry, the page explains why, and the API refuses the list', async () => {
  if (!guestToken) fail('the Receptionist could not sign in')
  await signedInAs(guestPage, guestToken, guestUser)
  await visit(guestPage, '/', null).catch(() => undefined)
  if (await guestPage.locator('aside nav a', { hasText: 'Expenses' }).count()) fail('a Receptionist is offered Expenses in the sidebar')
  await guestPage.goto(APP_URL + '/expenses', { waitUntil: 'networkidle' })
  await guestPage.getByText('Only the owner, an administrator or an accountant can see the clinic\'s expenses.').waitFor()
  const refused = await apiCall('GET', '/api/expenses', undefined, guestToken)
  if (refused.status !== 403) fail(`GET /api/expenses as a Receptionist answered ${refused.status}`)
})

await stepOn(guestPage, 'A clinic user cannot open the platform console: /platform sends them back to the dashboard, the API answers 403', async () => {
  for (const [who, target, token] of [['Receptionist', guestPage, guestToken], ['Administrator', page, adminToken]]) {
    await target.goto(APP_URL + '/platform', { waitUntil: 'networkidle' })
    await target.waitForURL(APP_URL + '/')
    await heading(target, /Good (morning|afternoon|evening)/).waitFor({ timeout: 20000 })
    if (await target.getByText('Super Admin Console').count()) fail(`the ${who} sees the platform console`)
    for (const urlPath of ['/api/platform/overview', '/api/platform/clinics']) {
      const refused = await apiCall('GET', urlPath, undefined, token)
      if (refused.status !== 403) fail(`GET ${urlPath} as the ${who} answered ${refused.status}`)
    }
  }
})

await stepOn(guestPage, 'A Receptionist gets the Settings page to read: the API\'s values, the explanation, every setting and banner control disabled and no Save; using the page sends nothing, the API answers 403 to their own PATCH and PUT, and the Administrator\'s page still has every control and both save actions', async () => {
  if (!guestToken) fail('the Receptionist could not sign in')
  const asGuest = (urlPath) => call(guestToken, 'GET', urlPath)
  const main = guestPage.locator('main')
  const from = Date.now()
  await visit(guestPage, '/settings', 'Settings')

  // What is stored, not a blank form.
  const TEXTS = [['Clinic Name', 'clinicName'], ['Legal Name', 'legalName'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address'], ['GSTIN', 'gstin'], ['Registration No.', 'registration'], ['Invoice Prefix', 'invoicePrefix'], ['Receipt Prefix', 'receiptPrefix']]
  // Not "Allow double booking": the owner-app check, when it runs alongside, switches it on and off again.
  const SWITCHES = [['Patient app booking', 'onlineBooking'], [PAGE_SETTING.label, PAGE_SETTING.key], [API_SETTING.label, API_SETTING.key], ['Financial lock', 'financialLock'], ['Strong password policy', 'strongPassword']]
  await figuresMatch(guestPage, () => asGuest('/api/settings'), [
    ...TEXTS.map(([label, key]) => [label, () => field(main, label).inputValue(), (api) => String(api[key] ?? '')]),
    ...SWITCHES.map(([label, key]) => [`"${label}" switch`, () => switchOn(guestPage, label).getAttribute('aria-checked'), (api) => String(Boolean(api[key]))]),
  ])
  // The patient-app check, when it runs alongside, replaces the banner for a while and puts it back:
  // two changes, so the page gets a second look before it is called wrong.
  const bannerShown = () => figuresMatch(guestPage, () => asGuest('/api/advertisement'), [
    ['banner title', () => field(main, 'Title').inputValue(), (api) => String(api.title ?? '')],
    ['banner subtitle', () => field(main, 'Subtitle').inputValue(), (api) => String(api.subtitle ?? '')],
    ['banner button label', () => field(main, 'Button Label').inputValue(), (api) => String(api.button ?? '')],
  ])
  await bannerShown().catch(bannerShown)
  const saved = await asGuest('/api/settings')
  const banner = await asGuest('/api/advertisement')
  if (!saved.clinicName || !saved.invoicePrefix || !SWITCHES.some(([, key]) => saved[key]) || !banner.title) fail('the demo clinic has no settings or no banner to show, so the comparison proves little')

  const note = (await readOnlyNote(guestPage).innerText()).trim()
  if (note !== READ_ONLY) fail(`the page explains itself with "${note}"`)
  const controls = await settingsControls(guestPage)
  if (!settingNames(controls).length) fail('the page shows no settings')
  if (JSON.stringify(usable(controls)) !== JSON.stringify(['Export'])) fail(`a Receptionist can use: ${usable(controls).join(', ') || 'nothing'} (expected only "Export")`)
  if (saveActions(controls).length) fail(`a Receptionist is offered: ${saveActions(controls).join(', ')}`)
  await main.getByText('View only', { exact: true }).waitFor()
  // Their own password is not a clinic setting: that form is theirs to use.
  const own = controls.filter((c) => c.own)
  if (JSON.stringify(own.map((c) => c.name)) !== JSON.stringify(OWN_PASSWORD) || own.some((c) => c.disabled)) fail(`the own-password form reads ${JSON.stringify(own)}`)

  // What a person would try: the switch, its row, typing into a field of the settings and of the banner.
  const toggle = switchOn(guestPage, PAGE_SETTING.label)
  const shown = [await toggle.getAttribute('aria-checked'), await field(main, 'Clinic Name').inputValue(), await field(main, 'Title').inputValue()]
  await clickOn(guestPage, toggle)
  await clickOn(guestPage, main.locator('label').filter({ hasText: PAGE_SETTING.label }).locator('span').first())
  await clickOn(guestPage, field(main, 'Clinic Name'))
  await guestPage.keyboard.type(' E2E')
  await guestPage.keyboard.press('Enter')
  await clickOn(guestPage, field(main, 'Title'))
  await guestPage.keyboard.type(' E2E')
  await guestPage.keyboard.press('Enter')
  await sleep(500)
  if ((await toggle.getAttribute('aria-checked')) !== shown[0]) fail('a switch changed on the read-only page')
  if ((await field(main, 'Clinic Name').inputValue()) !== shown[1] || (await field(main, 'Title').inputValue()) !== shown[2]) fail('a field took what was typed on the read-only page')
  if (saveActions(await settingsControls(guestPage)).length) fail('a Save action appeared after the page was used')
  const written = settingsWrites(guest, from)
  if (written.length) fail(`the read-only page sent ${written.map((req) => `${req.method} ${req.path}`).join(', ')}`)

  // The rule is the API's, not only the page's. Both requests carry what is stored already, so even
  // one that was wrongly accepted would change nothing.
  for (const [method, urlPath, body] of [
    ['PATCH', '/api/settings', { values: { [PAGE_SETTING.key]: Boolean(saved[PAGE_SETTING.key]) } }],
    ['PUT', '/api/advertisement', { values: banner }],
  ]) {
    const refused = await apiCall(method, urlPath, body, guestToken)
    if (refused.status !== 403) fail(`${method} ${urlPath} as a Receptionist answered ${refused.status}`)
    if (!/clinic owner or an administrator/i.test(refused.data.detail || '')) fail(`${method} ${urlPath} was refused with ${JSON.stringify(refused.data)}`)
  }

  // The Administrator has the same form with everything on it in use, and no explanation.
  await onPage(page, async () => {
    await visit(page, '/settings', 'Settings')
    const admin = await settingsControls(page)
    if (await readOnlyNote(page).count()) fail('the Administrator is told that the settings cannot be changed')
    if (JSON.stringify(settingNames(admin)) !== JSON.stringify(settingNames(controls))) fail(`the Receptionist is shown ${settingNames(controls).length} settings, the Administrator ${settingNames(admin).length}`)
    const off = admin.filter((c) => c.disabled).map((c) => c.name)
    if (JSON.stringify(off) !== JSON.stringify(['Saved'])) fail(`for the Administrator these are disabled: ${off.join(', ') || 'nothing'} (expected only "Saved", with nothing changed yet)`)
    if (JSON.stringify(saveActions(admin)) !== JSON.stringify(['Saved', 'Save Banner'])) fail(`the Administrator is offered: ${saveActions(admin).join(', ') || 'no save action'}`)
    if (await page.locator('main').getByText('View only', { exact: true }).count()) fail('the Administrator\'s banner is marked "View only"')
    // Saving is not tried here: the Administrator's settings save has its own step above, and this
    // clinic's banner is being changed by the patient-app check when that runs alongside. The banner
    // is saved by the owner of this run's own clinic, further down.
  })
})

await r.step('Settings: a login that loses the Administrator role while its Settings page is open has its save refused: the page shows the API\'s message, saves nothing and becomes read-only (settings, then the banner)', async () => {
  if (!deskLogin) fail('the login was not created')
  const setRole = (role) => deskApi('PATCH', `/api/clinic/users/${deskLogin.id}`, { role })
  const stale = await newContext('role changed')
  const stalePage = await stale.context.newPage()
  const main = stalePage.locator('main')
  let before = null
  let banner = null
  shotPage = stalePage
  try {
    await setRole('Administrator')
    const signedIn = await apiSignIn(DESK_LOGIN.email, DESK_LOGIN.resetPassword)
    if (signedIn.status !== 200 || signedIn.data.user.role !== 'Administrator') fail(`as an Administrator the login signed in with ${signedIn.status} and the role ${JSON.stringify(signedIn.data.user?.role)}`)
    await signedInAs(stalePage, signedIn.data.access_token, signedIn.data.user)
    await visit(stalePage, '/settings', 'Settings')
    if (await readOnlyNote(stalePage).count()) fail('an Administrator gets the read-only page')
    before = await deskGet('/api/settings')
    const original = String(Boolean(before[PAGE_SETTING.key]))
    const toggle = switchOn(stalePage, PAGE_SETTING.label)
    await until(async () => (await toggle.getAttribute('aria-checked')) === original || 'the switch does not show the saved value')

    /** Presses a save action, expects the API to refuse it, and returns the API's explanation once the page has shown it. */
    const refusal = (method, urlPath, press) =>
      stale.expecting([[403, urlPath, method]], async () => {
        const answered = stalePage.waitForResponse((res) => new URL(res.url()).pathname === urlPath && res.request().method() === method)
        await press()
        const response = await answered
        if (response.status() !== 403) fail(`${method} ${urlPath} answered ${response.status()} to a login that is a Receptionist again`)
        const { detail } = await response.json()
        if (!detail) fail('the API gave no explanation')
        await toast(stalePage, detail).first().waitFor({ timeout: 10000 })
        return detail
      })
    /** After a refused save the API's message stays on the page, which offers nothing to change or save any more. */
    const lockedWith = async (detail) => {
      const noteText = async () => (await readOnlyNote(stalePage).innerText().catch(() => '(no note)')).trim()
      await until(async () => (await noteText()) === `Your changes were not saved. ${detail}` || `the page does not keep the API's message; its note reads "${await noteText()}"`)
      if (await toast(stalePage, /Settings saved|Advertisement updated/).count()) fail('the page reports a save that the API refused')
      const controls = await settingsControls(stalePage)
      if (JSON.stringify(usable(controls)) !== JSON.stringify(['Export']) || saveActions(controls).length) fail(`after the refusal the page still offers: ${[...usable(controls), ...saveActions(controls)].join(', ')}`)
    }

    // A change is waiting to be saved when the role is taken away.
    await toggle.click()
    await button(main, 'Save Changes').first().waitFor()
    await setRole('Receptionist')
    const from = Date.now()
    const detail = await refusal('PATCH', '/api/settings', () => button(main, 'Save Changes').first().click())
    await lockedWith(detail)
    await until(async () => (await toggle.getAttribute('aria-checked')) === original || 'the switch still shows the change that was refused')
    if (String(Boolean((await deskGet('/api/settings'))[PAGE_SETTING.key])) !== original) fail('the refused change reached the API')
    await clickOn(stalePage, toggle)
    await sleep(300)
    if (settingsWrites(stale, from).length !== 1) fail(`after the refusal the page sent ${settingsWrites(stale, from).length - 1} more requests`)
    await clearToasts(stalePage)

    // The banner has a save of its own. The browser still holds the role it signed in with, so a
    // reload offers the form again; that save is refused and handled the same way. (Another check
    // may be changing this banner meanwhile, so it is judged by the title tried here, not by the
    // banner staying as it was.)
    await visit(stalePage, '/settings', 'Settings')
    banner = { shown: await field(main, 'Title').inputValue(), tried: `Web E2E refused banner ${tail}` }
    await field(main, 'Title').fill(banner.tried)
    const again = await refusal('PUT', '/api/advertisement', () => button(main, 'Save Banner').click())
    await lockedWith(again)
    await main.getByText('View only', { exact: true }).waitFor()
    await until(async () => (await field(main, 'Title').inputValue()) === banner.shown || 'the banner form still shows the title that was refused')
    if ((await deskGet('/api/advertisement')).title === banner.tried) fail('the refused banner reached the API')
  } finally {
    await setRole('Receptionist').catch(() => {})
    // Only needed if the API wrongly accepted one of the saves.
    if (before && Boolean((await deskGet('/api/settings'))[PAGE_SETTING.key]) !== Boolean(before[PAGE_SETTING.key])) await deskApi('PATCH', '/api/settings', { values: { [PAGE_SETTING.key]: Boolean(before[PAGE_SETTING.key]) } })
    const left = banner ? await deskGet('/api/advertisement') : null
    if (left && left.title === banner.tried) await deskApi('PUT', '/api/advertisement', { values: { ...left, title: banner.shown } })
    await stale.context.close()
    shotPage = page
  }
})

await r.step('Staff logins: deactivating asks first, then the API refuses that login and its session', async () => {
  if (!deskLogin) fail('the login was not created')
  await openLogins()
  const row = loginRow(DESK_LOGIN.email)
  await button(row, 'Deactivate').click()
  const confirm = dialog(page, 'Deactivate this login?')
  await confirm.waitFor()
  if (!(await confirm.innerText()).includes(DESK_LOGIN.name)) fail('the confirmation does not name the login')
  await button(confirm, 'Cancel').click()
  await confirm.waitFor({ state: 'hidden' })
  if ((await deskGet('/api/clinic/users')).items.find((l) => l.id === deskLogin.id).status !== 'Active') fail('the login was deactivated before the confirmation')

  await button(row, 'Deactivate').click()
  await button(dialog(page, 'Deactivate this login?'), 'Deactivate').click()
  await sawToast(page, `${DESK_LOGIN.name} can no longer sign in`)
  await until(async () => (await row.innerText()).replace(/\s+/g, ' ').includes('Inactive Edit Activate') || 'the row does not show the login as inactive')
  if ((await deskGet('/api/clinic/users')).items.find((l) => l.id === deskLogin.id).status !== 'Inactive') fail('the API still lists the login as active')

  const refused = await apiSignIn(DESK_LOGIN.email, DESK_LOGIN.resetPassword)
  if (refused.status !== 403 || !/inactive/i.test(refused.data.detail || '')) fail(`a deactivated login could still sign in: ${refused.status} ${JSON.stringify(refused.data)}`)
  const session = await apiCall('GET', '/api/staff', undefined, guestToken)
  if (session.status !== 401) fail(`the deactivated login's open session was answered ${session.status}`)
  // In the browser that is still open for that login, the next request ends the session.
  await guest.expecting([[401, '/api/']], async () => {
    await guestPage.goto(APP_URL + '/patients', { waitUntil: 'networkidle' })
    await guestPage.waitForURL(APP_URL + '/login')
    await guestPage.getByRole('heading', { name: 'Sign in' }).waitFor()
  })
  if (await guestPage.evaluate(() => localStorage.getItem('dentor.token'))) fail('the ended session is still stored in the browser')
})

/* ------------------------------------------------- super admin console */

const sa = await newContext('platform')
const saPage = await sa.context.newPage()
const kpi = (label) => stat(saPage, label)
const clinicCards = () => saPage.locator('main div.grid.gap-3 > div.shadow-card')
const clinicCard = (name) => clinicCards().filter({ hasText: name })
const created = { clinicId: '', code: '', consultantId: '', ownerToken: '', ownerUser: null }
const OVERVIEW = [
  ['clinics', async () => numberIn((await kpi('Clinics')).value), (api) => api.clinics],
  ['active and suspended', async () => (await kpi('Clinics')).hint, (api) => `${api.clinics_active} active · ${api.clinics_suspended} suspended`],
  ['staff logins', async () => numberIn((await kpi('Staff logins')).value), (api) => api.staff_logins],
  ['patients', async () => numberIn((await kpi('Patients')).value), (api) => api.patients],
  ['patient app accounts', async () => (await kpi('Patients')).hint, (api) => `${api.patient_app_accounts} use the patient app`],
  ['collected', async () => (await kpi('Collected')).value, (api) => inr(api.collected)],
  ['appointments and app bookings', async () => (await kpi('Collected')).hint, (api) => `${api.appointments} appointments · ${api.app_bookings} via app`],
]
const overviewMatches = () => figuresMatch(saPage, () => superApi('GET', '/api/platform/overview'), OVERVIEW)

// What is connected outside Dentor for the mobile apps, as the console words it for the platform
// owner: per service, the state and what has to be said about it for an answer of the API.
const services = () => saPage.getByRole('region', { name: 'Connected services' })
const serviceTile = (name) => services().locator(':scope > div').filter({ hasText: name })
const SMS = 'Text messages (SMS)'
const PUSH = 'Push notifications'
const EMAIL = 'Email'
const SERVICES = {
  [SMS]: (i) =>
    !i.sms ? ['Not connected', ['Patients cannot sign up, log in with a one-time code or reset a forgotten password', 'Logging in with a password still works']]
      : i.sms_test_mode ? ['Test mode', ['One-time codes are shown on screen and in the server log instead of being sent']]
        : ['Connected', []],
  [PUSH]: (i) => (i.push ? ['Connected', []] : ['Not connected', ['Notifications appear inside the apps only']]),
  [EMAIL]: (i) =>
    i.email === undefined ? null
      : !i.email ? ['Not connected', ['cannot reset a forgotten password by email', 'Logging in with a password still works']]
        : i.email_test_mode ? ['Test mode', ['Email codes are shown on screen and in the server log instead of being sent']]
          : ['Connected', []],
}
/** True when the status on screen is what this `integrations` answer calls for; otherwise what is wrong. */
const servicesShow = async (integrations) => {
  if ((await services().count()) !== 1) return 'the console shows no status of the connected services'
  for (const [name, says] of Object.entries(SERVICES)) {
    const expected = says(integrations)
    const tile = serviceTile(name)
    if (expected === null) {
      if (await tile.count()) return `"${name}" is shown although the API does not report it`
      continue
    }
    const [state, phrases] = expected
    if ((await tile.count()) !== 1) return `${await tile.count()} entries for "${name}"`
    const badge = (await tile.locator('span.rounded-full').innerText()).trim()
    if (badge !== state) return `"${name}" is shown as "${badge}"; ${JSON.stringify(integrations)} means "${state}"`
    const text = (await tile.locator('p').count()) ? (await tile.locator('p').innerText()).trim() : ''
    if (!phrases.length && text) return `"${name}" is connected, yet the console adds: ${text}`
    for (const phrase of phrases) if (!text.includes(phrase)) return `"${name}" does not say "${phrase}"; it says "${text}"`
  }
  return true
}
/** How an entry is set off from the page: a warning has to look unlike the others, and only a warning may. */
const tileLook = (name) =>
  serviceTile(name).evaluate((tile) => {
    const style = getComputedStyle(tile)
    return `${style.backgroundColor} / ${style.borderTopColor} / ${style.color}`
  })
/**
 * Rewrites the `integrations` part of the overview in the browser until the function it returns is
 * called (null: as an older API that does not send it). The server is not touched and the figures
 * pass through unchanged. `seen` holds the last answer the console was given.
 */
async function rewriteOverview(change, seen = {}) {
  const handler = async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (change === null) delete body.integrations
    else body.integrations = { ...body.integrations, ...change }
    seen.overview = body
    await route.fulfill({ response, json: body })
  }
  await saPage.route('**/api/platform/overview', handler)
  return () => saPage.unroute('**/api/platform/overview', handler)
}

await stepOn(saPage, 'Super Admin: signs in and lands on the platform console', async () => {
  await saPage.goto(APP_URL + '/', { waitUntil: 'networkidle' })
  await saPage.waitForURL(APP_URL + '/login')
  const { status, data } = await submitSignIn(saPage, SUPER.email, SUPER.password)
  if (status !== 200) fail(`sign-in answered ${status}: ${JSON.stringify(data)}`)
  superToken = data.access_token
  await saPage.waitForURL(APP_URL + '/platform')
  await saPage.getByText('Super Admin Console').waitFor()
  await heading(saPage, 'Clinics').waitFor()
  await saPage.locator('header').getByText(SUPER.email).waitFor()
  await ready(saPage)
  // No clinic is chosen yet, so the reception app is not reachable.
  await saPage.goto(APP_URL + '/patients', { waitUntil: 'networkidle' })
  await saPage.waitForURL(APP_URL + '/platform')
  await ready(saPage)
})

await stepOn(saPage, 'Super Admin: the KPI tiles equal /api/platform/overview', async () => {
  await overviewMatches()
  const api = await superApi('GET', '/api/platform/overview')
  if (!(api.clinics > 0 && api.patients > 0 && api.collected > 0 && api.app_bookings > 0)) fail(`the overview has an empty figure to compare: ${JSON.stringify({ clinics: api.clinics, patients: api.patients, collected: api.collected, app_bookings: api.app_bookings })}`)
})

/** Applies through the API as the apps do (development server: the email code comes back in the answer). */
async function applyToJoin(kind, email, name) {
  const sent = await apiCall('POST', '/api/auth/signup/email', { email })
  if (sent.status !== 200 || !sent.data.dev_code) fail(`asking for a sign-up code answered ${sent.status}: ${JSON.stringify(sent.data)}`)
  const verified = await apiCall('POST', '/api/auth/signup/verify', { email, code: sent.data.dev_code })
  const profile = { name, mobile: '9845055566', institution: 'GDC', graduation_year: '2015', dci_number: `DCI-${stamp}`, specialisation: 'Endodontics', area: 'Hebbal', city: 'Bengaluru', state: 'Karnataka', pincode: '560024' }
  if (kind === 'clinic') profile.clinic_name = `${name} Dental`
  const applied = await apiCall('POST', '/api/auth/signup', { ticket: verified.data.ticket, kind, password: 'Applicant#2026', aadhaar: '2345 6789 0123', profile, agreed: true })
  if (applied.status !== 201) fail(`the application answered ${applied.status}: ${JSON.stringify(applied.data)}`)
}

await stepOn(saPage, 'Super Admin: sign-up applications are listed with only the last four Aadhaar digits; rejecting needs a reason and moves it to Rejected', async () => {
  const email = `reject.${stamp}@e2e.test`
  await applyToJoin('clinic', email, 'Rhea Reject')
  await saPage.reload({ waitUntil: 'networkidle' })
  const card = saPage.getByTestId(`application-${email}`)
  await card.waitFor()
  await card.getByText('ends 0123').waitFor()
  if (await card.getByText('234567890123').count()) fail('the full Aadhaar number is shown')
  await card.getByTestId('application-reject').click()
  await saPage.getByTestId('reject-confirm').click()
  await saPage.getByText('Say why, so the applicant knows what to change.').waitFor()
  await saPage.getByTestId('reject-reason').fill('The DCI number could not be verified')
  await saPage.getByTestId('reject-confirm').click()
  await card.waitFor({ state: 'detached' })
  await saPage.getByRole('tab', { name: 'Rejected' }).click()
  await saPage.getByTestId(`application-${email}`).getByText('The DCI number could not be verified').waitFor()
  const signIn = await apiCall('POST', '/api/auth/login', { email, password: 'Applicant#2026', app: 'owner' })
  if (signIn.status !== 403 || !signIn.data.detail.includes('could not be verified')) fail(`the applicant's sign-in answered ${signIn.status}: ${JSON.stringify(signIn.data)}`)
  await saPage.getByRole('tab', { name: 'Pending' }).click()
})

await stepOn(saPage, 'Super Admin: a consultant is approved into a chosen clinic and can then sign in to the Consultant app', async () => {
  const email = `approve.${stamp}@e2e.test`
  await applyToJoin('consultant', email, `Dr. Arun Approve ${stamp}`)
  await saPage.reload({ waitUntil: 'networkidle' })
  const card = saPage.getByTestId(`application-${email}`)
  await card.getByTestId('application-approve').click()
  await saPage.getByTestId('approve-confirm').click()
  await saPage.getByText('Choose the clinic this consultant joins.').waitFor()
  const clinics = (await superApi('GET', '/api/platform/clinics')).items.filter((c) => c.status !== 'Suspended')
  await saPage.getByTestId('approve-clinic').selectOption(clinics[0].id)
  await saPage.getByTestId('approve-confirm').click()
  await card.waitFor({ state: 'detached' })
  const signIn = await apiCall('POST', '/api/auth/login', { email, password: 'Applicant#2026', app: 'consultant' })
  if (signIn.status !== 200 || signIn.data.user.role !== 'Consultant') fail(`the approved consultant's sign-in answered ${signIn.status}: ${JSON.stringify(signIn.data).slice(0, 200)}`)
})

await stepOn(saPage, 'Super Admin: the console shows the connected services as /api/platform/overview reports them (SMS and email in test mode here), warns what patients cannot do when SMS is off and what staff cannot do when email is off, shows a masked notice while a fixed test code or test patient logins are on, alarms nobody when all is connected, and shows nothing for an API that does not report them', async () => {
  const { integrations } = await superApi('GET', '/api/platform/overview')
  if (!integrations) fail('/api/platform/overview does not report "integrations"')
  if (!integrations.sms || !integrations.sms_test_mode) fail(`this check runs against the SMS provider "console" (test mode), but the API reports ${JSON.stringify(integrations)}`)
  await until(() => servicesShow(integrations))
  if ((await tileLook(SMS)) !== (await tileLook(PUSH))) fail('SMS is connected, yet its entry is set off like a warning')

  const CASES = [
    ['SMS off', { sms: false, sms_test_mode: false }],
    ['email off', { email: false, email_test_mode: false }],
    ['everything connected', { sms: true, sms_test_mode: false, email: true, email_test_mode: false, push: true }],
    ['an API that does not report email yet', { email: undefined, email_test_mode: undefined }],
    ['an API that does not report the services', null],
  ]
  for (const [what, change] of CASES) {
    const seen = {}
    const restore = await rewriteOverview(change, seen)
    try {
      await visit(saPage, '/platform', 'Clinics')
      const given = seen.overview
      if (!given) fail(`with ${what} the console did not ask for the overview`)
      // The figures are the API's own in every case: only the services part was rewritten.
      await until(async () => (await kpi('Clinics'))?.value === String(given.clinics) || `with ${what} the "Clinics" tile shows ${(await kpi('Clinics'))?.value}, the answer says ${given.clinics}`)
      if (change === null) {
        if (await services().count()) fail('the console shows a status the API did not report')
        if (await saPage.locator('main').getByText(/not connected|test mode/i).count()) fail('the console claims something about services the API did not report')
        continue
      }
      await until(() => servicesShow(given.integrations))
      if (given.integrations.email === false && (await tileLook(EMAIL)) === (await tileLook(PUSH))) fail('with email off its entry looks like the informational ones')
      if (given.integrations.email && (await tileLook(EMAIL)) !== (await tileLook(PUSH))) fail(`with ${what} the email entry is set off like a warning`)
      const warns = (await tileLook(SMS)) !== (await tileLook(PUSH))
      if (given.integrations.sms) {
        if (warns) fail(`with ${what} the SMS entry is set off like a warning`)
        if (what === 'everything connected' && await saPage.locator('main').getByText(/cannot|not connected/i).count()) fail(`with ${what} the console still reports a problem`)
      } else {
        if (!warns) fail('with SMS off its entry looks like the informational ones')
        // A warning nobody scrolls to is not one: it is on the first screen, above the clinic list.
        const box = await serviceTile(SMS).boundingBox()
        const firstClinic = await clinicCards().first().boundingBox()
        if (!box || box.y < 0 || box.y + box.height > saPage.viewportSize().height) fail(`the SMS warning is not on the first screen (${JSON.stringify(box)})`)
        if (firstClinic && firstClinic.y < box.y) fail('the SMS warning comes after the clinic list')
        if (!(await serviceTile(SMS).locator('svg').count())) fail('the SMS warning has no warning sign')
      }
    } finally {
      await restore()
    }
  }
  // The testing aids: a notice with the masked numbers and the number of test logins while they are on, nothing when off.
  if (integrations.otp_test_mobiles?.length || integrations.patient_test_logins) {
    fail(`this check expects the testing aids off on the test API, it reports ${JSON.stringify([integrations.otp_test_mobiles, integrations.patient_test_logins])}`)
  }
  if (await saPage.getByTestId('otp-test-warning').count()) fail('the test-code notice shows although the testing aids are off')
  for (const [rewrite, expected, absent] of [
    [{ otp_test_mobiles: ['******0777', '******0778'] }, ['the patient numbers', '******0777, ******0778', 'Remove OTP_TEST_MOBILES and OTP_TEST_CODE on the server'], 'test patient login'],
    [{ patient_test_logins: 2 }, ['2 test patient logins are active', 'Remove PATIENT_TEST_ACCOUNTS on the server'], 'verification code'],
    [{ otp_test_mobiles: ['******0777'], patient_test_logins: 1 }, ['the patient number ******0777', '1 test patient login is active', 'Remove OTP_TEST_MOBILES, OTP_TEST_CODE and PATIENT_TEST_ACCOUNTS'], null],
  ]) {
    const restore = await rewriteOverview(rewrite)
    try {
      await visit(saPage, '/platform', 'Clinics')
      const notice = saPage.getByTestId('otp-test-warning')
      await notice.waitFor()
      const text = (await notice.innerText()).replace(/\s+/g, ' ')
      for (const part of expected) if (!text.includes(part)) fail(`the testing notice should say "${part}", it says: ${text}`)
      if (absent && text.includes(absent)) fail(`the testing notice mentions "${absent}": ${text}`)
      if (/\d{10}|123456|@/.test(text)) fail('the testing notice shows a full number, a code or an email')
    } finally {
      await restore()
    }
  }
  // Back to what the server really reports, for the steps that follow.
  await visit(saPage, '/platform', 'Clinics')
  await until(() => servicesShow(integrations))
  if (await saPage.getByTestId('otp-test-warning').count()) fail('the test-code notice stayed after the test code was off again')
})

await stepOn(saPage, 'Super Admin: the clinic list equals /api/platform/clinics, and search narrows it through the API', async () => {
  const cards = clinicCards()
  const demo = (api) => api.items.find((c) => c.is_demo) ?? api.items[0]
  const { name, code } = demo(await superApi('GET', '/api/platform/clinics'))
  // The tile labels are upper-cased by CSS, which innerText reflects: compare them without case.
  const cardText = async () => (await clinicCard(name).first().evaluate((el) => el.innerText)).replace(/\s+/g, ' ')
  await figuresMatch(saPage, () => superApi('GET', '/api/platform/clinics'), [
    ['clinics listed', () => cards.count(), (api) => api.items.length],
    ['clinic names', async () => (await cards.locator('span.font-semibold.text-slate-900').allTextContents()).map((t) => t.trim()), (api) => api.items.map((c) => c.name)],
    ['demo clinic line', cardText, (api) => `${demo(api).code} · ${demo(api).city || '—'} · ${demo(api).plan}`, 'includes'],
    ['demo clinic figures', async () => (await cardText()).match(/(\d+) Patients (\d+) Appts (₹[\d,]+) Collected/i)?.slice(1, 4), (api) => [String(demo(api).stats.patients), String(demo(api).stats.appointments), inr(demo(api).stats.collected)]],
    ['demo clinic logins', async () => (await cardText()).match(/Users \((\d+)\)/)?.[1], (api) => String(demo(api).stats.users)],
    ['demo clinic status', cardText, (api) => demo(api).status, 'includes'],
  ])
  const from = Date.now()
  await saPage.locator('main input[type="search"]').fill(code)
  await until(() => sentSince(sa, from, 'GET', `/api/platform/clinics?q=${encodeURIComponent(code)}`).length > 0 || 'the search was not sent to the API')
  const found = await superApi('GET', `/api/platform/clinics?q=${encodeURIComponent(code)}`)
  await until(async () => (await cards.count()) === found.items.length || `${await cards.count()} clinics shown for "${code}", the API finds ${found.items.length}`)
  await saPage.locator('main input[type="search"]').fill('')
  await until(async () => (await cards.count()) === (await superApi('GET', '/api/platform/clinics')).items.length || 'clearing the search does not bring the list back')
})

await stepOn(saPage, 'Super Admin with HTTP 500: the console says what it could not load (no "No clinics found", no figures), and "Try again" brings the API\'s data; so does a clinic\'s list of logins', async () => {
  await openWhileBroken(saPage, sa, 'HTTP 500', () => visit(saPage, '/platform', 'Clinics'), ['Could not load the platform figures.', 'Could not load the clinics'])
  await tryAgain(saPage, sa)
  await until(comparison(() => superApi('GET', '/api/platform/overview'), OVERVIEW), 15000)
  await until(async () => (await clinicCards().count()) === (await superApi('GET', '/api/platform/clinics')).items.length || 'after "Try again" the clinics are not listed', 15000)

  // The logins of one clinic, in their dialog.
  const first = (await superApi('GET', '/api/platform/clinics')).items[0]
  const logins = (await superApi('GET', `/api/platform/clinics/${first.id}/users`)).items
  const restore = await breakApi(saPage, 'HTTP 500', '**/api/platform/clinics/*/users')
  const users = dialog(saPage, `Logins — ${first.name}`)
  try {
    await sa.expecting([[500, '/users']], async () => {
      await clinicCard(first.name).first().getByRole('button', { name: /^Users \(/ }).click()
      await users.waitFor()
      await users.locator('[role="alert"]').filter({ hasText: 'Could not load this clinic’s logins' }).waitFor({ timeout: 15000 })
      if (await users.getByText('No logins yet').count()) fail('logins that could not be loaded are reported as "No logins yet"')
      await restore()
    })
  } finally {
    await restore()
  }
  await users.getByRole('button', { name: 'Try again', exact: true }).click()
  await until(async () => (await users.locator('ul > li').count()) === logins.length || `${await users.locator('ul > li').count()} logins listed after "Try again", the API has ${logins.length}`, 15000)
  await closeDialog(users)
})

await stepOn(saPage, 'Super Admin: a clinic is not created with missing details or a first login that already exists', async () => {
  await settle(saPage)
  const before = (await superApi('GET', '/api/platform/clinics')).total
  await button(saPage.locator('main'), 'New Clinic').first().click()
  const dlg = dialog(saPage, 'Onboard New Clinic')
  await dlg.waitFor()
  const posts = () => sa.requests.filter((req) => req.method === 'POST' && req.path === '/api/platform/clinics').length
  const sent = posts()
  await button(dlg, 'Create Clinic').click()
  await sawToast(saPage, 'Enter the clinic name.')
  await field(dlg, 'Clinic Name').fill(CLINIC.name)
  await button(dlg, 'Create Clinic').click()
  await sawToast(saPage, 'Enter the name and email for the clinic’s first login.')
  await field(dlg, 'Name').fill(CLINIC.ownerName)
  await field(dlg, 'Email').fill(ADMIN.email)
  await field(dlg, 'Initial Password').fill('short')
  await button(dlg, 'Create Clinic').click()
  await sawToast(saPage, 'The first login’s password must be at least 8 characters.')
  if (posts() !== sent) fail('an incomplete form was sent to the API')

  await field(dlg, 'Initial Password').fill(CLINIC.ownerPassword)
  await sa.expecting([[409, '/api/platform/clinics', 'POST']], async () => {
    const answered = saPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/platform/clinics' && res.request().method() === 'POST')
    await button(dlg, 'Create Clinic').click()
    const refused = await answered
    if (refused.status() !== 409) fail(`a first login with a taken email was answered ${refused.status()}`)
    await sawToast(saPage, (await refused.json()).detail)
  })
  const after = await superApi('GET', '/api/platform/clinics')
  if (after.total !== before || after.items.some((c) => c.name === CLINIC.name)) fail('a clinic was created although its first login was refused')
})

await stepOn(saPage, 'Super Admin: a clinic is created with its first login, which can sign in to that clinic', async () => {
  const dlg = dialog(saPage, 'Onboard New Clinic')
  if (!(await dlg.count())) {
    await settle(saPage)
    await button(saPage.locator('main'), 'New Clinic').first().click()
    await dlg.waitFor()
    await field(dlg, 'Clinic Name').fill(CLINIC.name)
    await field(dlg, 'Name').fill(CLINIC.ownerName)
    await field(dlg, 'Initial Password').fill(CLINIC.ownerPassword)
  }
  const roles = await field(dlg, 'Role').locator('option').allTextContents()
  if (JSON.stringify(roles) !== JSON.stringify(['Clinic Owner', 'Administrator'])) fail(`first-login roles offered: ${roles.join(', ')}`)
  await field(dlg, 'City').fill(CLINIC.city)
  await field(dlg, 'Plan').selectOption('Professional')
  await field(dlg, 'Email').fill(CLINIC.ownerEmail)
  const answered = saPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/platform/clinics' && res.request().method() === 'POST')
  await button(dlg, 'Create Clinic').click()
  const response = await answered
  if (response.status() !== 201) fail(`creating the clinic answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`)
  const clinic = await response.json()
  created.clinicId = clinic.id
  created.code = clinic.code
  await dlg.waitFor({ state: 'hidden' })
  await sawToast(saPage, `${CLINIC.name} onboarded — ${CLINIC.ownerName} can sign in now`)

  const card = clinicCard(CLINIC.name)
  await card.waitFor()
  const text = (await card.innerText()).replace(/\s+/g, ' ')
  if (!text.includes(`${clinic.code} · ${CLINIC.city} · Professional`) || !text.includes('Active') || !text.includes('Users (1)')) fail(`the new clinic's card reads "${text}"`)
  if (!/^CL-\d{3,}$/.test(clinic.code)) fail(`unexpected clinic code ${clinic.code}`)
  const users = (await superApi('GET', `/api/platform/clinics/${clinic.id}/users`)).items
  if (users.length !== 1 || users[0].email !== CLINIC.ownerEmail || users[0].role !== 'Clinic Owner' || users[0].status !== 'Active') fail(`the API lists these logins for the new clinic: ${JSON.stringify(users.map((u) => [u.email, u.role, u.status]))}`)
  await overviewMatches()

  const signedIn = await apiSignIn(CLINIC.ownerEmail, CLINIC.ownerPassword)
  if (signedIn.status !== 200) fail(`the first login could not sign in: ${signedIn.status} ${JSON.stringify(signedIn.data)}`)
  if (signedIn.data.user.clinic?.id !== clinic.id) fail('the first login signs in to another clinic')
  created.ownerToken = signedIn.data.access_token
  created.ownerUser = signedIn.data.user
  const patients = await call(created.ownerToken, 'GET', '/api/patients')
  if (patients.total !== 0) fail(`the new clinic's owner sees ${patients.total} patients of another clinic`)
})

await r.step('A Clinic Owner in the reception app sees only their own clinic, and a logins tab with their login on it', async () => {
  if (!created.ownerToken) fail('the new clinic\'s first login could not sign in')
  const owner = await newContext('new owner')
  const ownerPage = await owner.context.newPage()
  shotPage = ownerPage
  try {
    await signedInAs(ownerPage, created.ownerToken, created.ownerUser)
    await visit(ownerPage, '/', CLINIC.ownerName)
    const api = await call(created.ownerToken, 'GET', dashboardPath())
    if ((await statNumber(ownerPage, 'Total patients')) !== api.patients || api.patients !== 0) fail(`the new clinic's dashboard shows ${await statNumber(ownerPage, 'Total patients')} patients, its API says ${api.patients}`)
    await ownerPage.locator('main').getByText('No appointments today').waitFor()

    await visit(ownerPage, '/staff', 'Staff')
    await tab(ownerPage, 'Logins & app access').click()
    const rows = ownerPage.locator('main ul > li')
    await until(async () => (await rows.count()) === 1 || `${await rows.count()} logins listed for a clinic that has one`)
    const text = (await rows.innerText()).replace(/\s+/g, ' ')
    if (!text.includes(`${CLINIC.ownerName} You ${CLINIC.ownerEmail} Clinic Owner Web + Owner app Active Edit`)) fail(`the owner's row reads "${text}"`)
    if (await rows.getByRole('button', { name: /Deactivate|Activate/ }).count()) fail('the owner is offered to deactivate their own login')

    await ownerPage.goto(APP_URL + '/platform', { waitUntil: 'networkidle' })
    await ownerPage.waitForURL(APP_URL + '/')
    if (await ownerPage.getByText('Super Admin Console').count()) fail('a Clinic Owner sees the platform console')
  } finally {
    await owner.context.close()
    shotPage = page
  }
})

await r.step('A Clinic Owner changes a setting of their clinic on the Settings page and puts it back, and saves its banner, each save accepted by the API', async () => {
  if (!created.ownerToken) fail('the new clinic\'s first login could not sign in')
  const owner = await newContext('owner settings')
  const ownerPage = await owner.context.newPage()
  shotPage = ownerPage
  try {
    await signedInAs(ownerPage, created.ownerToken, created.ownerUser)
    await visit(ownerPage, '/settings', 'Settings')
    await changesASetting(ownerPage, () => call(created.ownerToken, 'GET', '/api/settings'))
    if (settingsWrites(owner).length !== 2) fail(`${settingsWrites(owner).length} requests were sent for two saves`)

    // The banner has a save of its own ("Save Banner"), accepted for the same roles.
    const main = ownerPage.locator('main')
    const title = `Web E2E banner ${tail}`
    await field(main, 'Title').fill(title)
    const answered = ownerPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/advertisement' && res.request().method() === 'PUT')
    await button(main, 'Save Banner').click()
    const response = await answered
    if (response.status() !== 200) fail(`saving the banner answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`)
    await sawToast(ownerPage, 'Advertisement updated')
    if ((await call(created.ownerToken, 'GET', '/api/advertisement')).title !== title) fail('the API does not have the banner title the owner saved')
    await until(async () => (await field(main, 'Title').inputValue()) === title || 'the banner form lost the saved title')
  } finally {
    await owner.context.close()
    shotPage = page
  }
})

await stepOn(saPage, 'Super Admin: "Manage" switches into the clinic (its own data, X-Clinic-Id on every request) and "Switch clinic" comes back', async () => {
  if (!created.clinicId) fail('the clinic was not created')
  created.consultantId = (await superApi('POST', '/api/consultants', { name: CLINIC.consultantName, specialty: 'Endodontics', type: 'In-house', status: 'Active' }, created.clinicId)).id
  const from = Date.now()
  await button(clinicCard(CLINIC.name), 'Manage').click()
  await saPage.waitForURL(APP_URL + '/')
  await heading(saPage, /Good (morning|afternoon|evening)/).waitFor({ timeout: 20000 })
  await ready(saPage)
  const banner = saPage.locator('div.bg-ink-900').filter({ hasText: 'Managing' })
  const bannerText = (await banner.innerText()).replace(/\s+/g, ' ')
  if (!bannerText.includes(`Managing ${CLINIC.name}`) || !bannerText.includes(created.code)) fail(`the banner reads "${bannerText}"`)

  const managed = (urlPath) => superApi('GET', urlPath, undefined, created.clinicId)
  await figuresMatch(saPage, () => managed(dashboardPath()), [
    ['total patients', () => statNumber(saPage, 'Total patients'), (api) => api.patients],
    ['appointments today', () => statNumber(saPage, 'Appointments today'), (api) => api.appointmentsToday],
  ])
  if ((await managed(dashboardPath())).patients !== 0) fail('the new clinic is not empty')

  await saPage.locator('aside').getByRole('link', { name: 'Consultants', exact: true }).click()
  await heading(saPage, 'Consultants').waitFor()
  await ready(saPage)
  await figuresMatch(saPage, () => managed('/api/consultants?sort=code&order=asc&limit=200'), [
    ['consultants of this clinic', () => tabCount(saPage, 'All'), (api) => api.total],
    ['its only consultant', async () => (await saPage.locator('main').getByText(/^Dr\. /).first().innerText()).trim(), (api) => api.items[0].name],
  ])
  if ((await managed('/api/consultants')).total !== 1) fail('the managed clinic shows consultants of another clinic')

  await saPage.locator('aside').getByRole('link', { name: 'Staff', exact: true }).click()
  await heading(saPage, 'Staff').waitFor()
  await tab(saPage, 'Logins & app access').click()
  await until(async () => (await saPage.locator('main ul > li').count()) === 1 || `${await saPage.locator('main ul > li').count()} logins listed for a clinic that has one`)
  if (!(await saPage.locator('main ul > li').innerText()).includes(CLINIC.ownerEmail)) fail('the managed clinic lists another clinic\'s logins')

  const scoped = sa.requests.filter((req) => req.at >= from && !req.path.startsWith('/api/platform') && !req.path.startsWith('/api/auth'))
  const wrong = scoped.filter((req) => req.headers['x-clinic-id'] !== created.clinicId)
  if (!scoped.length || wrong.length) fail(`${wrong.length} of ${scoped.length} requests were sent without the managed clinic's id, e.g. ${wrong[0]?.path}`)

  await button(banner, 'Switch clinic').click()
  await saPage.waitForURL(APP_URL + '/platform')
  await heading(saPage, 'Clinics').waitFor()
  await ready(saPage)
  if (await saPage.evaluate(() => localStorage.getItem('dentor.clinic'))) fail('the managed clinic is still remembered after switching back')
})

await stepOn(saPage, 'Super Admin: managing a clinic, changes one of its settings on the Settings page and puts it back, each save accepted by the API for that clinic', async () => {
  if (!created.clinicId) fail('the clinic was not created')
  await settle(saPage)
  try {
    await button(clinicCard(CLINIC.name), 'Manage').click()
    await saPage.waitForURL(APP_URL + '/')
    await saPage.locator('aside').getByRole('link', { name: 'Settings', exact: true }).click()
    await heading(saPage, 'Settings').waitFor({ timeout: 20000 })
    await ready(saPage)
    const from = Date.now()
    const demoBefore = (await deskGet('/api/settings'))[PAGE_SETTING.key]
    await changesASetting(saPage, () => superApi('GET', '/api/settings', undefined, created.clinicId))
    const sent = settingsWrites(sa, from)
    if (sent.length !== 2 || sent.some((req) => req.headers['x-clinic-id'] !== created.clinicId)) fail(`${sent.length} saves were sent, ${sent.filter((req) => req.headers['x-clinic-id'] !== created.clinicId).length} of them not for the managed clinic`)
    if ((await deskGet('/api/settings'))[PAGE_SETTING.key] !== demoBefore) fail('the save changed the demo clinic\'s setting')
    await button(saPage.locator('div.bg-ink-900').filter({ hasText: 'Managing' }), 'Switch clinic').click()
    await saPage.waitForURL(APP_URL + '/platform')
    await heading(saPage, 'Clinics').waitFor()
    await ready(saPage)
  } finally {
    // Whatever happened, the steps that follow start on the console with no clinic chosen.
    if (await saPage.evaluate(() => localStorage.getItem('dentor.clinic')).catch(() => null)) {
      await saPage.evaluate(() => localStorage.removeItem('dentor.clinic'))
      await visit(saPage, '/platform', 'Clinics').catch(() => {})
    }
  }
})

await stepOn(saPage, 'Super Admin: a Consultant login is added with its consultant-profile link, and the profile is then no longer offered', async () => {
  if (!created.consultantId) fail('the clinic has no consultant profile')
  await settle(saPage)
  await clinicCard(CLINIC.name).getByRole('button', { name: /^Users \(/ }).click()
  const users = dialog(saPage, `Logins — ${CLINIC.name}`)
  await users.waitFor()
  await until(async () => (await users.locator('ul > li').count()) === 1 || 'the first login is not listed')
  if (!(await users.locator('ul > li').innerText()).replace(/\s+/g, ' ').includes(`${CLINIC.ownerName} ${CLINIC.ownerEmail} · Clinic Owner Active`)) fail('the first login is not shown with its role and status')

  const openAdd = async () => {
    await button(users, 'Add Login').click()
    const add = dialog(saPage, /^Add Login$/)
    await add.waitFor()
    return add
  }
  await overviewMatches()
  const loginsBefore = (await kpi('Staff logins')).value
  let add = await openAdd()
  const posts = () => sa.requests.filter((req) => req.method === 'POST' && req.path.endsWith('/users')).length
  await field(add, 'Full Name').fill(CLINIC.consultantName)
  await field(add, 'Email').fill(CLINIC.consultantLogin)
  await field(add, 'Initial Password').fill(CLINIC.consultantPassword)
  await field(add, 'Role').selectOption('Consultant')
  await add.getByText('Signs in to the Dentor Consultant app only.').waitFor()
  await until(async () => (await field(add, 'Consultant profile').locator('option').count()) === 2 || 'the clinic\'s consultant profile is not offered')
  const sent = posts()
  await button(add, 'Add Login').click()
  await sawToast(saPage, 'Choose the consultant profile this login belongs to.')
  if (posts() !== sent) fail('the form was sent without a consultant profile')

  await field(add, 'Consultant profile').selectOption(created.consultantId)
  const answered = saPage.waitForResponse((res) => res.url().endsWith(`/api/platform/clinics/${created.clinicId}/users`) && res.request().method() === 'POST')
  await button(add, 'Add Login').click()
  const response = await answered
  if (response.status() !== 201) fail(`adding the login answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`)
  await add.waitFor({ state: 'hidden' })
  await sawToast(saPage, `${CLINIC.consultantName} can sign in now`)
  await until(async () => (await users.locator('ul > li').count()) === 2 || 'the new login is not listed')
  if (!(await users.locator('ul > li').filter({ hasText: CLINIC.consultantLogin }).innerText()).includes('· Consultant')) fail('the new login is not shown as a Consultant')
  // The console's own figures follow without a reload.
  await until(async () => (await kpi('Staff logins')).value !== loginsBefore || `the "Staff logins" tile still shows ${loginsBefore}, the count from before the login was added`, 8000)
  await overviewMatches()

  const saved = (await superApi('GET', `/api/platform/clinics/${created.clinicId}/users`)).items.find((u) => u.email === CLINIC.consultantLogin)
  if (!saved || saved.role !== 'Consultant' || saved.consultant_id !== created.consultantId) fail(`the API saved ${JSON.stringify(saved)}`)
  const profile = (await superApi('GET', `/api/platform/clinics/${created.clinicId}/consultants`)).items.find((c) => c.id === created.consultantId)
  if (!profile?.has_login) fail('the API does not report the consultant profile as linked')
  const linked = await apiSignIn(CLINIC.consultantLogin, CLINIC.consultantPassword, 'consultant')
  if (linked.status !== 200 || linked.data.user.consultant_id !== created.consultantId) fail(`the consultant login does not work in the consultant app: ${linked.status}`)

  add = await openAdd()
  await field(add, 'Role').selectOption('Consultant')
  await add.getByText('Every consultant of this clinic already has a login.').waitFor()
  if ((await field(add, 'Consultant profile').locator('option').count()) !== 1) fail('a consultant who already has a login is offered again')
  await closeDialog(add)
  await closeDialog(users)
  await until(async () => (await clinicCard(CLINIC.name).innerText()).includes('Users (2)') || 'the clinic card does not count the new login')
})

await stepOn(saPage, 'Super Admin: suspending a clinic asks first, then its logins are refused', async () => {
  if (!created.clinicId) fail('the clinic was not created')
  await settle(saPage)
  const card = clinicCard(CLINIC.name)
  await button(card, 'Suspend').click()
  const confirm = dialog(saPage, 'Suspend this clinic?')
  await confirm.waitFor()
  await button(confirm, 'Cancel').click()
  await confirm.waitFor({ state: 'hidden' })
  const status = async () => (await superApi('GET', `/api/platform/clinics?q=${encodeURIComponent(created.code)}`)).items.find((c) => c.id === created.clinicId).status
  if ((await status()) !== 'Active') fail('the clinic was suspended before the confirmation')
  await button(card, 'Suspend').click()
  await button(dialog(saPage, 'Suspend this clinic?'), 'Suspend').click()
  await sawToast(saPage, `${CLINIC.name} suspended`)
  await until(async () => (await status()) === 'Suspended' || 'the API still has the clinic as active')
  await until(async () => (await card.innerText()).includes('Suspended') || 'the card does not show the clinic as suspended')
  if (!(await button(card, 'Manage').isDisabled())) fail('a suspended clinic can still be managed')
  await button(card, 'Activate').waitFor()
  await overviewMatches()
  const refused = await apiSignIn(CLINIC.ownerEmail, CLINIC.ownerPassword)
  if (refused.status !== 403 || !/suspended/i.test(refused.data.detail || '')) fail(`a login of a suspended clinic was answered ${refused.status} ${JSON.stringify(refused.data)}`)
})

/* -------------------------------------------------------------------- PWA */

await r.step('PWA: the manifest is served and valid, and every icon loads at its declared size', async () => {
  const link = await page.locator('link[rel="manifest"]').getAttribute('href')
  if (link !== '/manifest.webmanifest') fail(`the page links the manifest at ${link}`)
  const res = await fetch(APP_URL + link)
  if (res.status !== 200) fail(`the manifest answered ${res.status}`)
  if (!/manifest\+json|application\/json/.test(res.headers.get('content-type') || '')) fail(`the manifest is served as ${res.headers.get('content-type')}`)
  const manifest = await res.json()
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) if (!manifest[key]) fail(`the manifest has no ${key}`)
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) fail(`display "${manifest.display}" does not make the app installable`)
  if (manifest.start_url !== '/' || manifest.scope !== '/') fail(`start_url ${manifest.start_url} / scope ${manifest.scope}`)
  const start = await fetch(APP_URL + manifest.start_url)
  if (start.status !== 200 || !/text\/html/.test(start.headers.get('content-type') || '')) fail('start_url does not answer with the app')
  const sizes = manifest.icons.map((icon) => `${icon.sizes}/${icon.purpose || 'any'}`)
  for (const needed of ['192x192/any', '512x512/any', '512x512/maskable']) if (!sizes.includes(needed)) fail(`the manifest has no ${needed} icon (it has ${sizes.join(', ')})`)
  const icons = [...manifest.icons.map((icon) => ({ src: icon.src, size: Number(icon.sizes.split('x')[0]), type: icon.type })), { src: await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'), size: 180, type: 'image/png' }]
  for (const icon of icons) {
    const loaded = await page.evaluate(async ({ src }) => {
      const answer = await fetch(src)
      const image = new Image()
      const decoded = await new Promise((resolve) => {
        image.onload = () => resolve(true)
        image.onerror = () => resolve(false)
        image.src = src
      })
      return { status: answer.status, type: answer.headers.get('content-type'), decoded, width: image.naturalWidth, height: image.naturalHeight }
    }, icon)
    if (loaded.status !== 200 || !loaded.decoded) fail(`icon ${icon.src} does not load (${loaded.status})`)
    if (!loaded.type?.startsWith(icon.type)) fail(`icon ${icon.src} is served as ${loaded.type}, declared ${icon.type}`)
    if (loaded.width !== icon.size || loaded.height !== icon.size) fail(`icon ${icon.src} is ${loaded.width}×${loaded.height}, declared ${icon.size}×${icon.size}`)
  }
  if (!(await page.locator('meta[name="theme-color"]').getAttribute('content'))) fail('the page has no theme-color')
})

const swState = (target) =>
  target.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    const cached = []
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) cached.push(new URL(request.url).pathname)
    return { scope: registration?.scope, state: registration?.active?.state, script: registration?.active?.scriptURL, controlled: Boolean(navigator.serviceWorker.controller), cached }
  })

await r.step('PWA: the service worker is registered, active and controls the page', async () => {
  await visit(page, '/', `, ${ADMIN.name}`)
  await until(async () => (await swState(page)).state === 'activated' || `the service worker is ${(await swState(page)).state ?? 'not registered'}`)
  const sw = await swState(page)
  if (sw.script !== `${APP_URL}/sw.js`) fail(`the active worker is ${sw.script}`)
  if (sw.scope !== `${APP_URL}/`) fail(`the worker's scope is ${sw.scope}`)
  if (!sw.controlled) fail('the page is not controlled by the service worker')
})

await r.step('PWA: API requests are never answered from the service worker or stored in its cache', async () => {
  const from = Date.now()
  const reloaded = await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  if (!reloaded.fromServiceWorker()) fail('the page itself did not come through the service worker, so this proves nothing')
  const calls = desk.responses.filter((res) => res.at >= from)
  if (!calls.some((res) => res.path.startsWith('/api/dashboard')) || !calls.some((res) => res.path === '/api/notifications')) fail('the reload made no API requests to judge')
  const served = calls.filter((res) => res.fromServiceWorker)
  if (served.length) fail(`answered by the service worker: ${served.map((res) => res.path).join(', ')}`)
  // After a whole run of API traffic, the cache holds only the app's own files.
  const { cached } = await swState(page)
  const leaked = cached.filter((entry) => entry.startsWith('/api'))
  if (leaked.length) fail(`API responses in the cache: ${leaked.join(', ')}`)
  if (!cached.includes('/index.html') || !cached.some((entry) => entry.startsWith('/assets/'))) fail(`the cache does not hold the app shell: ${cached.join(', ')}`)
  const inCache = await page.evaluate(async () => Boolean((await caches.match('/api/health')) || (await caches.match('/api/notifications')) || (await caches.match(`/api/dashboard?date=${new Date().toISOString().slice(0, 10)}`))))
  if (inCache) fail('an API response can be read back from the cache')
  // Offline, an API request fails instead of being answered from somewhere; online again it reaches the API.
  await desk.context.setOffline(true)
  try {
    const offline = await desk.expecting([[0, '/api/health']], () => page.evaluate(() => fetch('/api/health').then((res) => `answered ${res.status}`, () => 'failed')))
    if (offline !== 'failed') fail(`with no connection /api/health was ${offline}`)
  } finally {
    await desk.context.setOffline(false)
  }
  const online = await page.evaluate(() => fetch('/api/health').then((res) => res.json()))
  if (online.ok !== true) fail('back online, /api/health did not reach the API')
})

await r.step('PWA: offline, a reload of the signed-in app still shows the app shell, and it recovers when the connection is back', async () => {
  await visit(page, '/appointments', 'Appointments')
  await desk.context.setOffline(true)
  try {
    await desk.expecting([[0, '/api/']], async () => {
      const response = await page.reload({ waitUntil: 'domcontentloaded' })
      if (!response || response.status() !== 200 || !response.fromServiceWorker()) fail('the reload was not answered by the service worker')
      await page.locator('aside').getByRole('img', { name: /DENTOR/ }).waitFor({ timeout: 15000 })
      await heading(page, 'Appointments').waitFor({ timeout: 15000 })
      if ((await page.locator('aside nav a').count()) !== DESTINATIONS.length + 2) fail('the sidebar is incomplete offline')
      if (!page.url().startsWith(APP_URL)) fail(`offline the browser shows ${page.url()}`)
      // The shell is all the device has: the page says its data could not be loaded, not that the day is empty.
      await saying(page, 'Could not load the appointments').waitFor({ timeout: 15000 })
      if (await page.locator('main').getByText('No appointments on this day').count()) fail('offline, the day is shown as having no appointments')
      await sleep(1500) // let the failed requests settle while they are expected
    })
  } finally {
    await desk.context.setOffline(false)
  }
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  await until(async () => (await statNumber(page, 'Today')) === (await deskGet('/api/appointments?limit=1000')).items.filter((a) => a.date === today).length || 'back online the page does not show live data')
})

/** A browser that has never seen the app: opens it once and waits for the service worker to take over. */
async function firstVisit(label, fn) {
  const fresh = await newContext(label, { width: 390, height: 844 })
  const visitor = await fresh.context.newPage()
  shotPage = visitor
  try {
    await visitor.goto(APP_URL + '/', { waitUntil: 'networkidle' })
    await visitor.getByRole('heading', { name: 'Sign in' }).waitFor()
    await until(async () => ((await swState(visitor)).state === 'activated' && (await swState(visitor)).controlled) || 'the service worker did not take control on the first visit')
    await fn(visitor, fresh)
  } finally {
    await fresh.context.setOffline(false).catch(() => {})
    await fresh.context.close()
    shotPage = page
  }
}

await r.step('PWA: after a first visit, an offline reload shows the sign-in page instead of a blank page', async () => {
  await firstVisit('first visit', async (visitor, fresh) => {
    const before = (await swState(visitor)).cached
    if (!before.includes('/index.html')) fail(`the app shell is not cached after the first visit: ${before.join(', ')}`)
    await fresh.context.setOffline(true)
    const response = await visitor.reload({ waitUntil: 'domcontentloaded' })
    if (!response || response.status() !== 200) fail('offline, the reload shows the browser\'s error page')
    const cached = (await swState(visitor).catch(() => ({ cached: ['unreadable'] }))).cached
    await visitor.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 10000 }).catch(() => fail(`offline after a first visit the page stays blank; the service worker had cached only ${cached.join(', ')}`))
    await visitor.locator('input[autocomplete="username"]').waitFor()
    // A deep link opened offline gets the same shell.
    await visitor.goto(APP_URL + '/patients', { waitUntil: 'domcontentloaded' })
    await visitor.waitForURL(APP_URL + '/login')
    await visitor.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 10000 })
  })
})

await r.step('PWA: offline, a page whose code was never downloaded says so inside the app instead of going blank, and "Try again" opens it once online', async () => {
  await firstVisit('offline page', async (visitor, fresh) => {
    // Only the sign-in page has been opened in this browser, so no other page's code is on the device.
    // The session is one this run already holds; nothing is sent while offline.
    await visitor.evaluate(([token, user]) => {
      localStorage.setItem('dentor.token', token)
      localStorage.setItem('dentor.user', JSON.stringify(user))
    }, [adminToken, adminUser])
    await fresh.context.setOffline(true)
    await fresh.expecting([[0, '/api/'], ['console', /dynamically imported module|Failed to fetch/i]], async () => {
      await visitor.goto(APP_URL + '/patients', { waitUntil: 'domcontentloaded' })
      await visitor.getByText('This page could not be loaded').waitFor({ timeout: 15000 }).catch(async () => fail(`offline, a page that was never opened before shows ${JSON.stringify((await visitor.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80))}`))
      // The rest of the app stays on screen around the message.
      await visitor.getByRole('button', { name: 'Open menu' }).waitFor()
      await visitor.locator('nav.fixed').getByRole('link', { name: 'Appointments' }).waitFor()
      await sleep(1200) // let the failed requests settle while they are expected
    })
    await fresh.context.setOffline(false)
    await visitor.getByRole('button', { name: 'Try again' }).click()
    await heading(visitor, 'Patients').waitFor({ timeout: 20000 })
    await ready(visitor)
    await until(async () => (await statNumber(visitor, 'Total patients')) === (await deskGet('/api/patients')).total || 'after "Try again" the page does not show the API\'s patients')
  })
})

await r.step('PWA: only the app\'s own page is cached as the shell (not an icon opened in a tab, nor the HTML a server sends for a missing file)', async () => {
  await firstVisit('stray navigation', async (visitor, fresh) => {
    const shellType = () => fresh.context.serviceWorkers()[0].evaluate(async () => (await caches.match('/index.html'))?.headers.get('content-type') ?? 'nothing')
    if (!(await shellType()).includes('text/html')) fail(`the cached shell is ${await shellType()} after the first visit`)
    for (const file of ['/icons/icon-192.png', '/manifest.webmanifest']) {
      const response = await visitor.goto(APP_URL + file, { waitUntil: 'load' })
      if (!response.fromServiceWorker()) fail(`${file} did not go through the service worker, so this proves nothing`)
      if (!(await shellType()).includes('text/html')) fail(`after opening ${file} in a tab the cached shell is ${await shellType()}`)
    }
    // A server with a single-page fallback answers a script or icon that does not exist with index.html.
    await visitor.goto(APP_URL + '/login', { waitUntil: 'networkidle' })
    for (const missing of ['/assets/e2e-missing-chunk.js', '/icons/e2e-missing.png']) {
      const stored = await visitor.evaluate(async (url) => {
        await fetch(url)
        return (await caches.match(url))?.headers.get('content-type') ?? ''
      }, missing)
      if (stored.includes('text/html')) fail(`the page the server sent for ${missing} was cached under that name`)
    }
    await fresh.context.setOffline(true)
    await visitor.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' })
    await visitor.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 10000 })
  })
})

await r.step('PWA: "Install app" is only shown while the browser offers installation (offer simulated, see note)', async () => {
  await visit(page, '/', `, ${ADMIN.name}`)
  const menu = page.locator('header div.group')
  // The menu is hidden until hovered, so the entry is looked up in the DOM, not by its accessible role.
  const install = menu.locator('button', { hasText: 'Install app' })
  const offered = await page.evaluate(() => 'onbeforeinstallprompt' in window)
  if (!offered) fail('this browser has no beforeinstallprompt event at all')
  if (await install.count()) fail('"Install app" is rendered although the browser has made no offer')
  // Headless Chromium never fires beforeinstallprompt, so the browser's offer is simulated.
  await page.evaluate(() => {
    const offer = new Event('beforeinstallprompt', { cancelable: true })
    window.__e2eInstall = { prompted: 0, prevented: false }
    offer.prompt = async () => {
      window.__e2eInstall.prompted += 1
    }
    offer.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(offer)
    window.__e2eInstall.prevented = offer.defaultPrevented
  })
  await install.waitFor({ state: 'attached' })
  if (!(await page.evaluate(() => window.__e2eInstall.prevented))) fail('the browser\'s own install banner is not suppressed')
  await menu.hover()
  await install.click()
  await until(async () => (await page.evaluate(() => window.__e2eInstall.prompted)) === 1 || 'the browser\'s install prompt was not opened')
  await until(async () => (await install.count()) === 0 || '"Install app" stays after the offer was used')

  await page.evaluate(() => {
    const offer = new Event('beforeinstallprompt', { cancelable: true })
    offer.prompt = async () => {}
    offer.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(offer)
  })
  await install.waitFor({ state: 'attached' })
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await until(async () => (await install.count()) === 0 || '"Install app" stays after the app was installed')
  await page.mouse.move(640, 500)

  const consoleInstall = saPage.locator('button', { hasText: 'Install app' })
  if (await consoleInstall.count()) fail('the platform console renders "Install app" without an offer')
  await saPage.evaluate(() => {
    const offer = new Event('beforeinstallprompt', { cancelable: true })
    offer.prompt = async () => {}
    offer.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(offer)
  })
  await saPage.locator('header').getByRole('button', { name: 'Install app' }).waitFor()
  await saPage.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await until(async () => (await consoleInstall.count()) === 0 || 'the console keeps "Install app" after installation')
})
r.note('"Install app": a real installation offer cannot be triggered in headless Chromium; the step above dispatches a synthetic beforeinstallprompt/appinstalled event and checks the app\'s reaction to it, not the browser\'s own install flow.')

/* ----------------------------------------------------------------- layout */

const DIALOG = '[role="dialog"]'

// The Settings page as somebody who may not change it. The Receptionist login of this run was
// deactivated above; it is switched on again for these checks and off again by the clean-up.
const reader = await newContext('receptionist, read-only settings')
const readerPage = await reader.context.newPage()
let readerSignedIn = false
await stepOn(readerPage, 'Test setup (API): the Receptionist login is active again and signed in, for the layout checks of the read-only Settings page', async () => {
  if (!deskLogin) fail('the login was not created')
  await deskApi('PATCH', `/api/clinic/users/${deskLogin.id}`, { status: 'Active', role: 'Receptionist' })
  const signedIn = await apiSignIn(DESK_LOGIN.email, DESK_LOGIN.resetPassword)
  if (signedIn.status !== 200 || signedIn.data.user.role !== 'Receptionist') fail(`the Receptionist signed in with ${signedIn.status} and the role ${JSON.stringify(signedIn.data.user?.role)}`)
  await signedInAs(readerPage, signedIn.data.access_token, signedIn.data.user)
  await visit(readerPage, '/settings', 'Settings')
  if ((await readOnlyNote(readerPage).innerText()).trim() !== READ_ONLY) fail('the Receptionist does not get the read-only Settings page')
  readerSignedIn = true
})

await r.step('Sidebar: on a desktop it collapses to its icons (cms.fig 155:7575), every link keeps its name, the page takes the room, links still work, and the choice survives a reload', async () => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await visit(page, '/', null)
  const side = page.getByTestId('desktop-sidebar')
  const toggle = page.getByTestId('sidebar-toggle')
  const width = async () => (await side.boundingBox())?.width ?? 0
  if ((await side.getAttribute('data-collapsed')) !== 'false') await toggle.click() // start expanded
  await until(async () => (await width()) > 200 || `the expanded sidebar is ${await width()}px wide`)
  if ((await toggle.getAttribute('aria-label')) !== 'Collapse sidebar') fail('the toggle does not say what it does')
  await toggle.click()
  await until(async () => (await width()) <= 72 || `the collapsed sidebar is ${await width()}px wide`)
  const links = side.locator('nav a')
  if ((await links.count()) < 5) fail(`the collapsed sidebar has ${await links.count()} links`)
  for (let i = 0; i < (await links.count()); i += 1) {
    const link = links.nth(i)
    const name = ((await link.textContent()) ?? '').trim()
    if (!name) fail(`link ${i} of the collapsed sidebar has no name for screen readers`)
    if ((await link.getAttribute('title')) !== name) fail(`the collapsed "${name}" link has no tooltip`)
    const box = await link.boundingBox()
    if (!box || box.x < 0 || box.x + box.width > 72) fail(`the collapsed "${name}" link sticks out of the rail (${JSON.stringify(box)})`)
  }
  const main = await page.locator('main').boundingBox()
  if (!main || main.x > 140) fail(`the page does not use the room the sidebar gave up (main starts at ${main?.x})`)
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) fail('the page scrolls sideways with the sidebar collapsed')
  await side.getByRole('link', { name: 'Patients' }).click()
  await page.waitForURL(APP_URL + '/patients')
  await page.reload({ waitUntil: 'networkidle' })
  await until(async () => (await side.getAttribute('data-collapsed')) === 'true' || 'the collapsed sidebar opened again after a reload')
  await toggle.click()
  await until(async () => (await width()) > 200 || 'the sidebar did not expand again')
  await page.reload({ waitUntil: 'networkidle' })
  if ((await side.getAttribute('data-collapsed')) !== 'false') fail('the expanded sidebar collapsed again after a reload')
  // phones and tablets keep the drawer: the toggle is a desktop control
  await page.setViewportSize({ width: 768, height: 1024 })
  if (await toggle.isVisible()) fail('the collapse toggle shows below the desktop width')
  await page.setViewportSize({ width: 1280, height: 800 })
})

for (const viewport of VIEWPORTS) {
  await r.step(`Layout fits at ${viewport.width}×${viewport.height}: dashboard, appointments, patient profile, staff logins and platform console (its connected-services status, and its SMS and email warnings) with their dialogs open, every other sidebar page, and the Settings page as a Receptionist reads it`, async () => {
    const problems = new Map() // finding → the screens it was seen on (a header problem shows on all of them)
    const check = async (target, screen, inside) => {
      await sleep(350) // dialogs and sheets slide in
      const shot = () => target.screenshot({ path: path.join(ARTIFACTS, `layout-${viewport.width}-${screen.replace(/[^\w]+/g, '-')}.png`), fullPage: !inside }).catch(() => {})
      if (ARTIFACTS && ALL_SCREENS) await shot()
      await assertNoOverflow(target, screen, inside).catch(async (error) => {
        for (const finding of error.findings ?? [error.message]) problems.set(finding, [...(problems.get(finding) ?? []), screen])
        if (ARTIFACTS) await shot()
      })
    }
    const withDialog = async (target, screen, open, title, prepare) => {
      await open()
      const dlg = dialog(target, title)
      await dlg.waitFor()
      if (prepare) await prepare(dlg)
      await check(target, screen, DIALOG)
      await closeDialog(dlg)
    }
    const mobile = viewport.width < 1024
    // The patient this run registered (long name, email and address); the demo patient if that failed.
    const profile = fixture.patientId
      ? await deskGet(`/api/patients/${fixture.patientId}`)
      : (await deskGet(`/api/patients?q=${DEMO_PATIENT_CODE}`)).items.find((p) => p.code === DEMO_PATIENT_CODE)

    await page.setViewportSize(viewport)
    await visit(page, '/', `, ${ADMIN.name}`)
    await clearToasts(page)
    await check(page, 'dashboard')
    await bell().click()
    await bellPanel().waitFor()
    await check(page, 'notifications open')
    await page.keyboard.press('Escape')
    if (mobile) {
      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.getByRole('button', { name: 'Close menu' }).waitFor()
      await check(page, 'menu open')
      await page.getByRole('button', { name: 'Close menu' }).click()
    }

    await visit(page, '/appointments', 'Appointments')
    await check(page, 'appointments')
    await withDialog(page, 'new appointment', () => button(page.locator('main'), 'New Appointment').click(), 'New Appointment')
    await showDay(fixture.date || today)
    await check(page, 'appointments on a booked day') // an app booking: its badges must leave room for the name
    await button(page.locator('main'), 'All Upcoming').click()
    await ready(page)
    await check(page, 'all upcoming')

    await visit(page, `/patients/${profile.id}`, profile.name)
    await check(page, 'patient profile')
    await withDialog(page, 'edit patient', () => button(page.locator('main'), 'Edit').click(), 'Edit Patient')
    for (const name of ['Treatments', 'Dental Chart', 'Invoices', 'Timeline']) {
      await tab(page, name).click()
      await ready(page)
      await check(page, `patient profile / ${name}`)
    }

    await visit(page, '/staff', 'Staff')
    await check(page, 'staff directory')
    await tab(page, 'Logins & app access').click()
    await button(page.locator('main'), 'Add Login').waitFor()
    await ready(page)
    await check(page, 'staff logins')
    await withDialog(page, 'add login', () => button(page.locator('main'), 'Add Login').click(), 'Add Login', async (dlg) => {
      await field(dlg, 'Role').selectOption('Consultant')
      await field(dlg, 'Consultant profile').waitFor()
    })
    await withDialog(page, 'reset password', () => loginRow(ADMIN.email).getByRole('button', { name: /^Reset password for/ }).click(), 'Reset Password')

    // Every other sidebar destination as it opens. Their figure tiles are one component that sits
    // two to five across, so each page shows it at another width.
    for (const [label, urlPath, title] of DESTINATIONS) {
      if (['Appointments', 'Staff'].includes(label)) continue // above, with their dialogs
      await visit(page, urlPath, title)
      await check(page, label.toLowerCase())
    }

    await onPage(readerPage, async () => {
      if (!readerSignedIn) fail('no Receptionist is signed in to open the read-only Settings page with')
      await readerPage.setViewportSize(viewport)
      await visit(readerPage, '/settings', 'Settings')
      await readOnlyNote(readerPage).waitFor()
      await readerPage.locator('main').getByText('View only', { exact: true }).waitFor()
      if (usable(await settingsControls(readerPage)).join() !== 'Export') fail('the Settings page is not read-only for the Receptionist')
      await check(readerPage, 'settings, read-only')
    })

    await onPage(saPage, async () => {
      await saPage.setViewportSize(viewport)
      // The status of the connected services at its longest: SMS and email off (two warnings) and no push notifications.
      const longest = { sms: false, sms_test_mode: false, email: false, email_test_mode: false, push: false }
      const restore = await rewriteOverview(longest)
      try {
        await visit(saPage, '/platform', 'Clinics')
        await clearToasts(saPage)
        await until(() => servicesShow(longest))
        await check(saPage, 'platform console, SMS and email not connected')
      } finally {
        await restore()
      }
      // And as the server reports it.
      await visit(saPage, '/platform', 'Clinics')
      await clearToasts(saPage)
      await services().waitFor()
      await check(saPage, 'platform console')
      await withDialog(saPage, 'new clinic', () => button(saPage.locator('main'), 'New Clinic').first().click(), 'Onboard New Clinic')
      await clinicCards().first().getByRole('button', { name: /^Users \(/ }).click()
      const users = dialog(saPage, /^Logins — /)
      await users.waitFor()
      await until(async () => (await users.locator('ul > li').count()) > 0 || 'the logins of the first clinic are not listed')
      await check(saPage, 'clinic logins', DIALOG)
      await button(users, 'Add Login').click()
      const add = dialog(saPage, /^Add Login$/)
      await add.waitFor()
      await field(add, 'Role').selectOption('Consultant')
      await field(add, 'Consultant profile').waitFor()
      await check(saPage, 'add clinic login', DIALOG)
      await closeDialog(add)
      await closeDialog(users)
    })

    if (problems.size) fail([...problems].map(([finding, screens]) => `${finding} [${screens.slice(0, 3).join(', ')}${screens.length > 3 ? `, +${screens.length - 3} more` : ''}]`).join(' ‖ '))
  })
}

/* --------------------------------------------------------------- sign out */

await r.step('Signing out returns to the sign-in page and ends the session, in the browser and on the server', async () => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await visit(page, '/', `, ${ADMIN.name}`)
  const signedOutToken = await page.evaluate(() => localStorage.getItem('dentor.token'))
  if (!signedOutToken || signedOutToken !== adminToken) fail('the browser is not using the administrator session it signed in with')
  const menu = page.locator('header div.group')
  await menu.hover()
  await menu.getByText(ADMIN.email).waitFor()
  const told = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/logout' && res.request().method() === 'POST')
  await menu.getByRole('button', { name: 'Sign out' }).click()
  const answer = await told
  if (answer.status() !== 200) fail(`the API answered ${answer.status()} to the sign-out`)
  await page.waitForURL(APP_URL + '/login')
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()
  const left = await page.evaluate(() => [localStorage.getItem('dentor.token'), localStorage.getItem('dentor.user')])
  if (left.some(Boolean)) fail('the session is still stored after signing out')
  await page.goto(APP_URL + '/patients', { waitUntil: 'networkidle' })
  await page.waitForURL(APP_URL + '/login')
  // The server has ended the session as well: the token that was in the browser opens nothing.
  for (const urlPath of ['/api/auth/me', '/api/patients?limit=1', '/api/notifications']) {
    const res = await apiCall('GET', urlPath, undefined, signedOutToken)
    if (res.status !== 401) fail(`the signed-out token still got ${res.status} from ${urlPath}`)
  }
  // A new sign-in is a new session; the clean-up below works with it.
  const again = await apiSignIn(ADMIN.email, ADMIN.password)
  if (again.status !== 200) fail(`signing in again answered ${again.status}`)
  adminToken = again.data.access_token
  if ((await apiCall('GET', '/api/auth/me', undefined, adminToken)).status !== 200) fail('the new session does not work')
})

/* --------------------------------------------------------------- clean-up */

await r.step('Clean-up (API): the test appointments, conversation, patient-app account and patient record are removed', async () => {
  const leftovers = []
  const remove = async (what, urlPath) => {
    const res = await apiCall('DELETE', urlPath, undefined, adminToken)
    if (res.status !== 200 && res.status !== 404) leftovers.push(`${what} (${res.status})`)
  }
  if (fixture.webAppointmentId) await remove('front-desk appointment', `/api/appointments/${fixture.webAppointmentId}`)
  if (fixture.appointmentId) await remove('app appointment', `/api/appointments/${fixture.appointmentId}`)
  if (fixture.conversationId) await remove('conversation', `/api/omni_conversations/${fixture.conversationId}`)
  if (fixture.token) {
    const gone = await patiently(() => apiCall('POST', '/api/patient/account/delete', { password: APP_PATIENT.password }, fixture.token))
    if (gone.status !== 200) leftovers.push(`patient-app account (${gone.status})`)
  }
  if (fixture.patientId) await remove('patient record', `/api/patients/${fixture.patientId}`)
  const settings = await deskGet('/api/settings')
  if (!settings.onlineBooking) leftovers.push('"Patient app booking" is off')
  if (fixture.date) {
    const still = (await deskGet(`/api/appointments?date=${fixture.date}`)).items.filter((a) => [fixture.appointmentId, fixture.webAppointmentId].includes(a.id))
    if (still.length) leftovers.push(`${still.length} appointments on ${fixture.date}`)
  }
  if (fixture.patientId && (await apiCall('GET', `/api/patients/${fixture.patientId}`, undefined, adminToken)).status !== 404) leftovers.push('the patient record is still there')
  if (created.clinicId && superToken) {
    const clinic = (await superApi('GET', `/api/platform/clinics?q=${encodeURIComponent(created.code)}`)).items.find((c) => c.id === created.clinicId)
    if (clinic.status !== 'Suspended') await superApi('PATCH', `/api/platform/clinics/${created.clinicId}`, { status: 'Suspended' })
  }
  if (deskLogin) {
    const login = (await deskGet('/api/clinic/users')).items.find((l) => l.id === deskLogin.id)
    if (login.status !== 'Inactive' || login.role !== 'Receptionist') await deskApi('PATCH', `/api/clinic/users/${deskLogin.id}`, { status: 'Inactive', role: 'Receptionist' })
    const left = (await deskGet('/api/clinic/users')).items.find((l) => l.id === deskLogin.id)
    if (left.status !== 'Inactive' || left.role !== 'Receptionist') leftovers.push(`the test login is ${left.status} with the role ${left.role}`)
  }
  if (leftovers.length) fail(`left behind: ${leftovers.join(', ')}`)
})

const code = r.finish(errors)
await browser.close()
process.exit(code)

// Browser end-to-end check of the Dentor Owner app against the real API.
//
//   node e2e/owner.e2e.mjs
//   APP_URL=http://localhost:8093 API_URL=http://localhost:8000 node e2e/owner.e2e.mjs
//
// It depends only on APP_URL, API_URL and the app's data-testids, so it can be pointed at any
// web build of the app. The API must run against a development database with demo data.
//
// What it leaves behind (the API cannot delete these): one inactive login "E2E Reception <timestamp>",
// one approved sign-up clinic "E2E Smile Studio <timestamp>", one patient "E2E Patient <timestamp>"
// with cancelled appointments, a lab order, a resolved complaint, a recall, a prescription and a
// certificate, and one visiting consultant "Dr. E2E Visitor <timestamp>" with a login and cancelled
// bookings. Clinic rules and the clinic phone are put back as they were.
import { API_URL, VIEWPORTS, apiCall, assertNoOverflow, launch, runner, staffToken } from './helpers.mjs'

const APP_URL = process.env.APP_URL || 'http://localhost:8093'
const OWNER = { email: 'owner@dentor.in', password: 'Owner@2026' }
const FRONT_DESK = { email: 'admin@dentor.in', password: 'Dentor@2026' }
// A consultant works in the Consultant app; the Clinic app refuses the login.
const CONSULTANT_LOGIN = { email: 'kumar@dentor.in', password: 'Consultant@2026' }

const stamp = Date.now()
const NEW_LOGIN = {
  name: `E2E Reception ${stamp}`,
  renamed: `E2E Reception ${stamp} (left)`,
  email: `e2e.owner.${stamp}@dentor.in`,
  weakPassword: 'weakpass1',
  password: 'Front@Desk2026',
  resetPassword: 'Reset@Desk2026',
}

/* ------------------------------------------------------------------ dates */

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (date, days) => {
  const d = parse(date)
  d.setDate(d.getDate() + days)
  return iso(d)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The app counts periods on the device's local calendar; the browser shares this machine's clock.
const today = iso(new Date())
const monthStart = `${today.slice(0, 8)}01`
const lastMonthEnd = addDays(monthStart, -1)
const PERIODS = {
  today: { from: today, to: today },
  last7: { from: addDays(today, -6), to: today },
  month: { from: monthStart, to: today },
  lastMonth: { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
}

/** "13 Oct 2026", "1–13 Oct 2026", "28 Sep – 4 Oct 2026" — how the app words a period. */
function inWords({ from, to }) {
  const a = parse(from)
  const b = parse(to)
  const day = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
  if (from === to) return `${day(b)} ${b.getFullYear()}`
  if (a.getFullYear() !== b.getFullYear()) return `${day(a)} ${a.getFullYear()} – ${day(b)} ${b.getFullYear()}`
  if (a.getMonth() !== b.getMonth()) return `${day(a)} – ${day(b)} ${b.getFullYear()}`
  return `${a.getDate()}–${day(b)} ${b.getFullYear()}`
}
const query = ({ from, to }) => `?date_from=${from}&date_to=${to}`

/* ---------------------------------------------------------------- helpers */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const numberIn = (text) => Number(String(text).replace(/[^\d.-]/g, ''))
const fail = (message) => {
  throw new Error(message)
}

/** Polls `check` until it returns true; a string it returns is the reason it is not true yet. */
async function until(check, timeout = 15000) {
  const deadline = Date.now() + timeout
  for (;;) {
    const result = await check()
    if (result === true) return
    if (Date.now() > deadline) fail(typeof result === 'string' ? result : 'condition not met in time')
    await sleep(250)
  }
}

/** The login endpoints share one per-address rate limit with every other check on this machine. */
async function patiently(call) {
  for (let attempt = 0; ; attempt += 1) {
    const result = await call().catch((error) => ({ status: /\b429\b/.test(String(error)) ? 429 : fail(String(error)) }))
    if (result.status !== 429 || attempt >= 4) return result
    await sleep(15000)
  }
}

const { browser, page, errors } = await launch(APP_URL)
const r = runner('Owner app')

// Tab screens stay mounted side by side, so every lookup is for the element on screen now.
const tid = (id) => page.locator(`[data-testid="${id}"]:visible`)
const textOf = async (id) => (await tid(id).first().innerText()).trim()
const numberOf = async (id) => numberIn(await textOf(id))
const countOf = (id) => tid(id).count()
const shows = async (id, expected) => {
  await until(async () => {
    const actual = (await countOf(id)) ? await textOf(id) : '(not on screen)'
    return actual.includes(expected) || `${id} shows "${actual}", expected "${expected}"`
  })
}

const apiRequests = []
page.on('request', (request) => {
  if (request.url().includes('/api/')) apiRequests.push(`${request.method()} ${request.url()}`)
})

let ownerToken = ''
const ownerApi = async (method, path, body) => {
  const { status, data } = await apiCall(method, path, body, ownerToken)
  if (status >= 400) fail(`${method} ${path} as the owner answered ${status}: ${JSON.stringify(data)}`)
  return data
}
let frontDeskToken = ''
const frontDeskApi = async (method, path) => {
  if (!frontDeskToken) {
    const result = await patiently(() => staffToken(FRONT_DESK.email, FRONT_DESK.password).then((token) => ({ status: 200, token })))
    if (!result.token) fail('could not sign the front desk in through the API (rate limited)')
    frontDeskToken = result.token
  }
  const { status, data } = await apiCall(method, path, undefined, frontDeskToken)
  if (status >= 400) fail(`${method} ${path} as the front desk answered ${status}: ${JSON.stringify(data)}`)
  return data
}
const apiSignIn = (email, password) => patiently(() => apiCall('POST', '/api/auth/login', { email, password, app: 'web' }))

/** Submits the sign-in form and returns what the API answered to it. */
async function submitSignIn(email, password) {
  for (let attempt = 0; ; attempt += 1) {
    await tid('login-email').fill(email)
    await tid('login-password').fill(password)
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST')
    await tid('login-submit').click()
    const response = await answered
    const data = await response.json().catch(() => ({}))
    if (response.status() !== 429 || attempt >= 4) return { status: response.status(), data }
    await sleep(15000)
  }
}

// The bar holds home, accounts, operations and profile; the clinic overview and the team open from the side menu.
const SCREENS = {
  home: { tab: 'tab-index', root: 'home-screen' },
  overview: { menu: 'menu-figures', root: 'overview-screen' },
  finance: { tab: 'tab-finance', root: 'finance-screen' },
  operations: { tab: 'tab-operations', root: 'operations-screen' },
  team: { menu: 'menu-team', root: 'team-screen' },
  appointments: { menu: 'menu-appointments', root: 'appointments-screen' },
  patients: { menu: 'menu-patients', root: 'patients-screen' },
  consult: { menu: 'menu-consult', root: 'consult-screen' },
  labs: { menu: 'menu-labs', root: 'labs-screen' },
  recall: { menu: 'menu-recall', root: 'recall-screen' },
  revisit: { menu: 'menu-revisit', root: 'revisit-screen' },
  rx: { menu: 'menu-rx', root: 'rx-screen' },
  certificates: { menu: 'menu-certificates', root: 'certificates-screen' },
  tariff: { menu: 'menu-tariff', root: 'tariff-screen' },
  accounts: { menu: 'menu-accounts', root: 'accounts-screen' },
  support: { menu: 'menu-support', root: 'support-screen' },
  chat: { menu: 'menu-chat', root: 'chat-list-screen' },
  offers: { menu: 'menu-offers', root: 'offers-screen' },
  wallet: { menu: 'menu-wallet', root: 'wallet-screen' },
  plans: { menu: 'menu-plans', root: 'plans-screen' },
  store: { menu: 'menu-store', root: 'store-screen' },
  jobs: { menu: 'menu-jobs', root: 'jobs-screen' },
  help: { menu: 'menu-help', root: 'help-screen' },
  tracking: { menu: 'menu-tracking', root: 'tracking-screen' },
  more: { tab: 'tab-more', root: 'more-screen' },
}

/** Back to the tabs with nothing open, whatever an earlier step left behind. */
async function settle() {
  for (let i = 0; i < 4 && (await countOf('sheet-close')); i += 1) {
    await tid('sheet-close').last().click()
    await sleep(500)
  }
  for (let i = 0; i < 4 && (await countOf('back')); i += 1) {
    await tid('back').first().click()
    await sleep(400)
  }
}

async function openTab(name) {
  await settle()
  const screen = SCREENS[name]
  if (screen.menu) {
    await tid('tab-index').click()
    await tid('open-menu').click()
    await tid(screen.menu).click()
  } else {
    await tid(screen.tab).click()
  }
  await tid(screen.root).waitFor()
}

async function choosePeriod(scope, key) {
  await tid(`${scope}-period-${key}`).click()
  await shows(`${scope}-period-label`, inWords(PERIODS[key]))
}

/**
 * Waits until every figure on screen equals the API's. Other checks use this database at the
 * same time, so if a figure moved between the app's request and ours the app is reopened once.
 * `figures` is a list of [name, read from screen, pick from the API answer].
 */
async function figuresMatch(fetchExpected, figures, reopen) {
  const compare = async () => {
    const expected = await fetchExpected()
    for (const [name, read, pick] of figures) {
      const onScreen = await read().catch((error) => `unreadable (${String(error).split('\n')[0].slice(0, 80)})`)
      const wanted = pick(expected)
      if (onScreen !== wanted) return `${name}: screen shows ${JSON.stringify(onScreen)}, API says ${JSON.stringify(wanted)}`
    }
    return true
  }
  try {
    await until(compare, 8000)
  } catch (error) {
    if (!reopen) throw error
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await reopen()
    await until(compare, 12000)
  }
}

/* ------------------------------------------------------------- signing in */

await r.step('First launch: permissions (what each is used for), onboarding, the disclaimer, then login; later launches open on login', async () => {
  await tid('welcome-permissions').waitFor({ timeout: 90000 })
  for (const key of ['location', 'camera', 'photos', 'notifications', 'calendar', 'microphone']) await tid(`permission-${key}`).waitFor()
  await tid('welcome-continue').click()
  await tid('welcome-onboarding').waitFor()
  await tid('welcome-login').click()
  await tid('welcome-disclaimer').waitFor()
  await page.getByText('This app is not intended to supplement', { exact: false }).waitFor()
  await tid('welcome-agree').click()
  await tid('login-email').waitFor({ timeout: 15000 })
  await page.reload({ waitUntil: 'networkidle' })
  await tid('login-email').waitFor({ timeout: 60000 })
  if (await tid('welcome-permissions').count()) throw new Error('the first-launch screens came back after agreeing')
})


/* ------------------------------------------- sign-up, forgotten password */

const SUPER_ADMIN = { email: 'superadmin@dentor.in', password: 'SuperAdmin@2026' }
const APPLICANT = { email: `clinic.${stamp}@e2e.test`, password: 'Applicant#2026', newPassword: 'Applicant#2027' }

/** The code the development API hands back (EMAIL_PROVIDER=console), as the screen shows it. */
async function devCode() {
  await tid('dev-code').waitFor({ timeout: 10000 })
  const code = (await textOf('dev-code')).match(/(\d{4})/)?.[1]
  if (!code) fail('no development code on screen')
  return code
}

async function signOutFromMore() {
  await openTab('more')
  await tid('more-sign-out').click()
  await tid('confirm-yes').click()
  await tid('login-email').waitFor({ timeout: 15000 })
}

await r.step('Sign-up: a clinic applies with an emailed code and the four designed steps, then waits for approval', async () => {
  await tid('login-signup').click()
  await tid('signup-screen').waitFor()
  await tid('signup-send').click()
  await page.getByText('Enter a valid email address, like name@example.com.').waitFor()
  await tid('signup-email').fill(APPLICANT.email)
  await tid('signup-send').click()
  await tid('signup-code').waitFor()
  const code = await devCode()
  await tid('code-input').fill(code === '0000' ? '1111' : '0000')
  await tid('signup-verify').click()
  await tid('signup-error').waitFor()
  await tid('code-input').fill(code)
  await tid('signup-verify').click()
  await tid('signup-kyc').waitFor()
  await tid('signup-next').click()
  await page.getByText('Enter your full name.').waitFor()
  await tid('signup-name').fill('Esha Test')
  await tid('signup-clinic_name').fill(`E2E Smile Studio ${stamp}`)
  await tid('signup-mobile').fill('9845011122')
  await tid('signup-aadhaar').fill('1234 5678 9012')
  await tid('signup-next').click()
  await tid('signup-academic').waitFor()
  await tid('signup-institution').fill('Government Dental College')
  await tid('signup-graduation_year').fill('2014')
  await tid('signup-dci_number').fill('DCI-E2E-1')
  await tid('signup-next').click()
  await tid('signup-address').waitFor()
  await tid('signup-area').fill('Indiranagar')
  await tid('signup-pincode').fill('560038')
  await tid('signup-city').fill('Bengaluru')
  await tid('signup-state').fill('Karnataka')
  await tid('signup-next').click()
  await tid('signup-finish').waitFor()
  await tid('signup-password').fill(APPLICANT.password)
  await tid('signup-confirm').fill(APPLICANT.password)
  await tid('signup-submit').click()
  await page.getByText('Accept the terms and conditions to continue.').waitFor()
  await tid('signup-agree').click()
  const sent = page.waitForResponse((response) => response.url().endsWith('/api/auth/signup') && response.request().method() === 'POST')
  await tid('signup-submit').click()
  if ((await sent).status() !== 201) fail(`the application answered ${(await sent).status()}`)
  await tid('signup-ok').waitFor()
  await tid('signup-ok').click()
  await tid('login-email').waitFor()
  const { status, data } = await submitSignIn(APPLICANT.email, APPLICANT.password)
  if (status !== 403 || !/being reviewed/.test(data.detail || '')) fail(`before approval the API answered ${status}: ${JSON.stringify(data)}`)
  await page.getByText(data.detail, { exact: true }).waitFor()
})

await r.step('Sign-up: once Dentor approves it the applicant signs in as the owner of the new clinic', async () => {
  const token = await staffToken(SUPER_ADMIN.email, SUPER_ADMIN.password)
  const { data } = await apiCall('GET', '/api/platform/applications?status=Pending', undefined, token)
  const mine = (data.items || []).find((a) => a.email === APPLICANT.email)
  if (!mine) fail('the application is not in the platform console list')
  if (mine.aadhaar_last4 !== '9012' || JSON.stringify(mine).includes('123456789012')) fail('the full Aadhaar number was kept')
  const approved = await apiCall('POST', `/api/platform/applications/${mine.id}/approve`, {}, token)
  if (approved.status !== 200) fail(`approval answered ${approved.status}: ${JSON.stringify(approved.data)}`)
  const { status } = await submitSignIn(APPLICANT.email, APPLICANT.password)
  if (status !== 200) fail(`after approval sign-in answered ${status}`)
  await tid('home-screen').waitFor({ timeout: 30000 })
  await shows('staff-header', `E2E Smile Studio ${stamp}`)
  // fingerprint sign-in is a phone feature: the browser build says so and offers no switch
  await openTab('more')
  await tid('more-settings').click()
  await tid('setting-biometric').waitFor()
  await page.getByText('Available in the phone app.').waitFor()
  await tid('back').click()
  await signOutFromMore()
  if (await countOf('login-biometric')) fail('the browser build offers fingerprint sign-in')
})

await r.step('Forgot password: an emailed code sets a new password; the old one stops working', async () => {
  await tid('login-forgot').click()
  await tid('forgot-screen').waitFor()
  await tid('forgot-email').fill(APPLICANT.email)
  await tid('forgot-send').click()
  await tid('forgot-code').waitFor()
  await tid('code-input').fill(await devCode())
  await tid('forgot-verify').click()
  await tid('forgot-password').waitFor()
  await tid('forgot-new').fill('weakpass')
  await tid('forgot-confirm').fill('weakpass')
  await tid('forgot-save').click()
  await page.getByText('Use upper and lower case letters, a digit and a symbol.').waitFor()
  await tid('forgot-new').fill(APPLICANT.newPassword)
  await tid('forgot-confirm').fill(APPLICANT.newPassword)
  await tid('forgot-save').click()
  await tid('forgot-login').waitFor()
  await tid('forgot-login').click()
  await tid('login-email').waitFor()
  const old = await apiCall('POST', '/api/auth/login', { email: APPLICANT.email, password: APPLICANT.password, app: 'owner' })
  if (old.status !== 401) fail(`the old password answered ${old.status}`)
  const fresh = await apiCall('POST', '/api/auth/login', { email: APPLICANT.email, password: APPLICANT.newPassword, app: 'owner' })
  if (fresh.status !== 200) fail(`the new password answered ${fresh.status}`)
})

await r.step('Remember me: unticked, the session ends when the app is reloaded', async () => {
  await tid('login-remember').click()
  const { status } = await submitSignIn(APPLICANT.email, APPLICANT.newPassword)
  if (status !== 200) fail(`sign-in answered ${status}`)
  await tid('home-screen').waitFor({ timeout: 30000 })
  await page.reload({ waitUntil: 'networkidle' })
  await tid('login-email').waitFor({ timeout: 30000 })
  if (await countOf('home-screen')) fail('the session survived a reload without "Remember me"')
})

await r.step('A consultant login is refused with the API\'s explanation', async () => {
  const { status, data } = await submitSignIn(CONSULTANT_LOGIN.email, CONSULTANT_LOGIN.password)
  if (status !== 403) fail(`expected the API to answer 403, got ${status}`)
  if (!/cannot use the Dentor Clinic app/i.test(data.detail || '')) fail(`unexpected explanation from the API: ${JSON.stringify(data)}`)
  await page.getByText(data.detail, { exact: true }).waitFor({ timeout: 5000 })
  if (await countOf('home-screen')) fail('a consultant login was let into the Clinic app')
})

await r.step('A wrong password shows the API\'s error', async () => {
  const { status, data } = await submitSignIn(OWNER.email, 'not-the-password')
  if (status !== 401) fail(`expected 401, got ${status}`)
  await page.getByText(data.detail, { exact: true }).waitFor({ timeout: 5000 })
  if (await countOf('home-screen')) fail('a wrong password was accepted')
})

await r.step('The owner signs in to the designed home: clinic, offer banner that flips to today, specialities', async () => {
  const { status, data } = await submitSignIn(OWNER.email, OWNER.password)
  if (status !== 200) fail(`owner sign-in answered ${status}: ${JSON.stringify(data)}`)
  ownerToken = data.access_token
  await tid('home-screen').waitFor({ timeout: 30000 })
  const { clinic } = await ownerApi('GET', '/api/owner/clinic')
  await shows('staff-header', clinic.name)
  if (clinic.city) await shows('home-location', clinic.city)
  // the banner is the clinic's own advertisement (never the design's sample artwork), and it flips to today
  const ad = await ownerApi('GET', '/api/advertisement')
  if (!ad.title || ad.status !== 'Active') fail(`the demo clinic's advertisement is not active: ${JSON.stringify(ad)}`)
  await shows('home-banner', ad.title)
  for (const key of ['General Dentistry', 'Orthodontics', 'Periodontics', 'Endodontics', 'Oral Surgery', 'Prosthodontics']) await tid(`specialty-${key}`).waitFor()
  await tid('home-flip').click()
  await tid('today-strip').waitFor()
  await tid('home-flip').click()
  await shows('home-banner', ad.title)
  // the supplies strip is the store's real catalogue, in rupees
  const catalogue = (await ownerApi('GET', '/api/engage/products')).items
  const cards = page.locator('[data-testid^="home-product-"]').filter({ visible: true })
  await until(async () => (await cards.count()) === Math.min(8, catalogue.length) || `the home shows ${await cards.count()} products, the catalogue has ${catalogue.length}`)
  if (catalogue.length) await shows(`home-product-${catalogue[0].id}`, catalogue[0].name)
  if (await page.getByText('$', { exact: false }).filter({ visible: true }).count()) fail('the home shows a dollar price')
  // the side menu offers the owner every built area
  await tid('open-menu').click()
  for (const key of ['figures', 'accounts', 'operations', 'team', 'clinic-rules']) await tid(`menu-${key}`).waitFor()
  await tid('menu-figures').click()
  await tid('overview-screen').waitFor()
  await tid('kpi-billed-value').waitFor({ timeout: 30000 })
})

/* --------------------------------------------------------------- overview */

const overviewFigures = [
  ['billed', () => numberOf('kpi-billed-value'), (api) => Math.round(api.billed)],
  ['collected', () => numberOf('kpi-collected-value'), (api) => Math.round(api.collected)],
  ['outstanding', () => numberOf('kpi-outstanding-value'), (api) => Math.round(api.outstanding)],
  ['appointments', () => numberOf('kpi-appointments-value'), (api) => api.appointments],
  ['new patients', () => numberOf('kpi-new-patients-value'), (api) => api.patients_new],
  ['average invoice', () => numberOf('kpi-average-invoice-value'), (api) => Math.round(api.average_invoice)],
]
const overviewMatches = (key) =>
  figuresMatch(() => ownerApi('GET', `/api/owner/overview${query(PERIODS[key])}`), overviewFigures, async () => {
    await tid('kpi-billed-value').waitFor({ timeout: 30000 })
    await choosePeriod('overview', key)
  })

await r.step('Overview: billed, collected and the other tiles for "This month" equal the API', async () => {
  await shows('overview-period-label', inWords(PERIODS.month))
  await overviewMatches('month')
  const api = await ownerApi('GET', `/api/owner/overview${query(PERIODS.month)}`)
  if (!(api.billed > 0 && api.collected > 0)) fail('the demo month has no billing to compare (is the demo data loaded?)')
  await shows('kpi-outstanding', 'All-time')
})

await r.step('Overview: the Today strip, both charts and the status breakdown come from the API', async () => {
  await figuresMatch(
    () => ownerApi('GET', `/api/owner/overview${query(PERIODS.month)}`),
    [
      ['today booked', () => numberOf('today-strip-appointments'), (api) => api.today_summary.appointments],
      ['today waiting', () => numberOf('today-strip-waiting'), (api) => api.today_summary.waiting],
      ['today done', () => numberOf('today-strip-completed'), (api) => api.today_summary.completed],
      ['today collected', () => numberOf('today-strip-collected'), (api) => Math.round(api.today_summary.collected)],
      ['statuses listed', () => page.locator('[data-testid^="appointments-by-status-"]:visible').count(), (api) => Object.values(api.appointments_by_status).filter((n) => n > 0).length || 1],
    ],
    async () => tid('kpi-billed-value').waitFor({ timeout: 30000 }),
  )
  const api = await ownerApi('GET', `/api/owner/overview${query(PERIODS.month)}`)
  const peak = api.series.reduce((a, b) => (b.collected > a.collected ? b : a), api.series[0])
  if (peak.collected > 0) await shows('chart-collections', `₹${Math.round(peak.collected).toLocaleString('en-IN')}`)
  else await tid('chart-collections-empty').waitFor()
  await tid('chart-appointments').waitFor()
})

await r.step('Overview: switching the period sends the new dates and shows that period\'s figures', async () => {
  for (const key of ['last7', 'today', 'lastMonth']) {
    const sent = `GET ${API_URL}/api/owner/overview${query(PERIODS[key])}`
    await choosePeriod('overview', key)
    await until(() => apiRequests.includes(sent) || `the app never requested ${sent}`)
    await overviewMatches(key)
  }
  const month = await ownerApi('GET', `/api/owner/overview${query(PERIODS.month)}`)
  const lastMonth = await ownerApi('GET', `/api/owner/overview${query(PERIODS.lastMonth)}`)
  if (month.billed === lastMonth.billed) fail('this month and last month bill the same amount, so the switch proves nothing')
  await choosePeriod('overview', 'month')
  await overviewMatches('month')
})

await r.step('The home bell opens notifications; the overview links open Finance and Operations', async () => {
  await openTab('home')
  await tid('open-notifications').click()
  await until(async () => (await countOf('notification')) + (await countOf('empty')) > 0 || 'notifications did not load')
  await tid('back').click()
  await openTab('overview')
  await tid('link-finance').click()
  await tid('finance-screen').waitFor()
  await openTab('overview')
  await tid('link-operations').click()
  await tid('operations-screen').waitFor()
})

/* ---------------------------------------------------------------- finance */

await r.step('Finance: billed, collected and the outstanding total equal the API', async () => {
  await openTab('finance')
  await shows('finance-period-label', inWords(PERIODS.month))
  const balances = async () => {
    const texts = await tid('outstanding-balance').allInnerTexts()
    return texts.reduce((sum, text) => sum + numberIn(text), 0)
  }
  await figuresMatch(
    () => ownerApi('GET', `/api/owner/finance${query(PERIODS.month)}`),
    [
      ['billed', () => numberOf('fin-billed-value'), (api) => Math.round(api.billed)],
      ['collected', () => numberOf('fin-collected-value'), (api) => Math.round(api.collected)],
      ['outstanding total', () => numberOf('outstanding-total'), (api) => Math.round(api.outstanding_total)],
      ['outstanding invoices counted', () => numberOf('outstanding-count'), (api) => api.outstanding.length],
      [
        'outstanding rows',
        async () => {
          if (await countOf('outstanding-list-toggle')) if ((await textOf('outstanding-list-toggle')).startsWith('Show all')) await tid('outstanding-list-toggle').click()
          return countOf('outstanding-invoice')
        },
        (api) => api.outstanding.length,
      ],
      ['sum of the listed balances', balances, (api) => Math.round(api.outstanding_total)],
    ],
    async () => {
      await openTab('finance')
      await tid('fin-billed-value').waitFor({ timeout: 30000 })
    },
  )
  const api = await ownerApi('GET', `/api/owner/finance${query(PERIODS.month)}`)
  if (api.outstanding.length === 0) fail('the demo data has no outstanding invoice to list')
  const first = api.outstanding[0]
  await shows('outstanding-list', first.patient)
  await shows('outstanding-list', first.number)
  await shows('outstanding-list', first.date_label)
})

await r.step('Finance: breakdowns, recent payments and the invoice detail sheet', async () => {
  const api = await ownerApi('GET', `/api/owner/finance${query(PERIODS.month)}`)
  for (const [card, buckets] of [['by-mode', api.by_mode], ['by-doctor', api.by_doctor], ['by-treatment', api.by_treatment]]) {
    if (buckets.length === 0) await tid(`${card}-empty`).waitFor()
    for (const bucket of buckets) {
      await shows(card, bucket.name)
      await shows(card, `₹${Math.round(bucket.amount).toLocaleString('en-IN')}`)
    }
  }
  if (api.recent_payments.length) await shows('payments-card', api.recent_payments[0].receipt)
  else await tid('payments-empty').waitFor()

  const first = api.outstanding[0]
  await tid('outstanding-invoice').first().click()
  await tid('invoice-sheet').waitFor()
  for (const expected of [first.number, first.patient, first.doctor, first.date_label, `₹${Math.round(first.balance).toLocaleString('en-IN')}`]) {
    await shows('invoice-sheet', expected)
  }
  await tid('invoice-sheet-done').click()
  await tid('invoice-sheet').waitFor({ state: 'hidden' })
})

/* ------------------------------------------------------------- operations */

await r.step('Operations: today\'s appointments, lab orders, low stock, leads and reviews equal the API', async () => {
  await openTab('operations')
  const rows = (id, toggle) => async () => {
    if (toggle && (await countOf(toggle))) if ((await textOf(toggle)).startsWith('Show all')) await tid(toggle).click()
    return countOf(id)
  }
  await figuresMatch(
    () => ownerApi('GET', '/api/owner/operations'),
    [
      ['appointments today', rows('today-appointment', 'today-appointments-list-toggle'), (api) => api.appointments.length],
      ['booked in the patient app', rows('booked-in-app'), (api) => api.appointments.filter((a) => a.source === 'Patient App').length],
      ['lab orders needing attention', rows('lab-attention'), (api) => api.lab.attention.length],
      ['low-stock items', rows('stock-item'), (api) => api.pharmacy_low.length + api.inventory_low.length],
      ['items out of stock', rows('stock-out'), (api) => [...api.pharmacy_low, ...api.inventory_low].filter((item) => item.out).length],
      ['items low but in stock', rows('stock-low'), (api) => [...api.pharmacy_low, ...api.inventory_low].filter((item) => !item.out).length],
      ['leads', () => numberOf('leads-total'), (api) => api.leads.total],
      ['pipeline value', () => numberOf('leads-pipeline'), (api) => Math.round(api.leads.pipeline_value)],
      ['reviews', () => numberOf('reviews-total'), (api) => api.reviews.total],
      ['reviews awaiting moderation', () => numberOf('reviews-pending'), (api) => api.reviews.pending],
    ],
    async () => {
      await openTab('operations')
      await tid('today-appointments').waitFor({ timeout: 30000 })
    },
  )
  const api = await ownerApi('GET', '/api/owner/operations')
  if (api.appointments.length === 0) fail('the demo data has no appointment today')
  if (api.pharmacy_low.length + api.inventory_low.length === 0) fail('the demo data has no low-stock item')
  const first = api.appointments[0]
  for (const expected of [first.time_label, first.patient, first.doctor, first.status]) await shows('today-appointments', expected)
  await shows('pharmacy-low', api.pharmacy_low[0].name)
  await shows('inventory-low', api.inventory_low[0].name)
  await shows('reviews-average', String(api.reviews.average.toFixed(1)))
})

/* ------------------------------------------------------------------- team */

await r.step('Team: doctor performance and the staff directory equal the API', async () => {
  await openTab('team')
  await tid('segment-doctors').click()
  await shows('team-period-label', inWords(PERIODS.month))
  const firstCard = (id) => async () => numberIn(await tid('doctor-card').first().locator(`[data-testid="${id}"]`).innerText())
  await figuresMatch(
    () => ownerApi('GET', `/api/owner/team${query(PERIODS.month)}`),
    [
      ['doctors', () => countOf('doctor-card'), (api) => api.doctors.length],
      ['top doctor', async () => (await tid('doctor-name').first().innerText()).trim(), (api) => api.doctors[0].name],
      ['top doctor appointments', firstCard('doctor-appointments'), (api) => api.doctors[0].appointments],
      ['top doctor completed', firstCard('doctor-completed'), (api) => api.doctors[0].completed],
      ['top doctor billed', firstCard('doctor-billed'), (api) => Math.round(api.doctors[0].billed)],
      ['top doctor collected', firstCard('doctor-collected'), (api) => Math.round(api.doctors[0].collected)],
    ],
    async () => {
      await openTab('team')
      await tid('doctor-list').waitFor({ timeout: 30000 })
    },
  )
  const api = await ownerApi('GET', `/api/owner/team${query(PERIODS.month)}`)
  await tid('segment-staff').click()
  await until(async () => (await countOf('staff-member')) === api.staff.length || `staff rows ${await countOf('staff-member')}, API says ${api.staff.length}`)
  await shows('staff-list', api.staff[0].name)
  await shows('staff-list', api.staff[0].role)
})

const loginRow = (email) => `login-${email}`

await r.step('Logins: every login is listed with role and status; the owner\'s own row cannot be deactivated or re-roled', async () => {
  await openTab('team')
  await tid('segment-logins').click()
  await tid('add-login').waitFor()
  const { items } = await ownerApi('GET', '/api/clinic/users')
  await until(async () => (await page.locator('[data-testid^="login-edit-"]:visible').count()) === items.length || `login rows do not match the API's ${items.length}`)
  for (const login of items.slice(0, 3)) {
    await shows(`login-role-${login.email}`, login.role)
    await shows(`login-status-${login.email}`, login.status)
  }
  await shows(`login-password-${OWNER.email}`, 'Change password')
  await tid(`login-edit-${OWNER.email}`).click()
  await tid('edit-login-sheet').waitFor()
  await tid('edit-login-self-note').waitFor()
  if (await countOf('segment-Inactive')) fail('the owner is offered to deactivate their own login')
  if (await page.locator('[data-testid^="edit-login-role-"]:visible').count()) fail('the owner is offered to change their own role')
  await tid('edit-login-sheet').locator('[data-testid="sheet-close"]').click()
  await tid('edit-login-sheet').waitFor({ state: 'hidden' })
})

const createRequests = () => apiRequests.filter((request) => request.startsWith('POST') && request.endsWith('/api/clinic/users')).length

/** Presses "Create login" and returns the API's answer to it. */
async function submitNewLogin() {
  const answered = page.waitForResponse((response) => response.url().endsWith('/api/clinic/users') && response.request().method() === 'POST')
  await tid('new-login-submit').click()
  const response = await answered
  return { status: response.status(), data: await response.json().catch(() => ({})) }
}

await r.step('Logins: a Consultant login cannot be created without choosing a profile, and taken profiles are not offered', async () => {
  await openTab('team')
  await tid('segment-logins').click()
  await tid('add-login').click()
  await tid('add-login-sheet').waitFor()
  await tid('new-login-name').fill(NEW_LOGIN.name)
  await tid('new-login-email').fill(NEW_LOGIN.email)
  await tid('new-login-password').fill(NEW_LOGIN.password)
  await tid('new-login-role-consultant').click()

  const { items: logins } = await ownerApi('GET', '/api/clinic/users')
  const { items: profiles } = await ownerApi('GET', '/api/consultants')
  const taken = logins.map((login) => login.consultant_id).filter(Boolean)
  const free = profiles.filter((profile) => !taken.includes(profile.id))
  if (taken.length === 0 || free.length === 0) fail('the demo data needs a consultant with a login and one without')
  await tid(`new-login-consultant-${free[0].id}`).waitFor()
  const offered = await page.locator('[data-testid^="new-login-consultant-"]:visible').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')).filter((id) => /consultant-[0-9a-f]{24}$/.test(id)))
  if (offered.length !== free.length) fail(`${offered.length} profiles offered, ${free.length} are free`)
  for (const id of taken) if (offered.includes(`new-login-consultant-${id}`)) fail('a consultant who already has a login is offered')

  const before = createRequests()
  await tid('new-login-submit').click()
  await shows('new-login-error', 'Choose the consultant profile this login belongs to.')
  await sleep(500)
  if (createRequests() !== before) fail('the form was sent without a consultant profile')
  await tid(`new-login-consultant-${free[0].id}`).click()
  await tid('new-login-role-receptionist').click()
  if (await countOf('new-login-consultants')) fail('the profile chooser stays for a role that is not Consultant')
})

await r.step('Logins: a duplicate email and a weak password are refused with the API\'s messages', async () => {
  await tid('add-login-sheet').waitFor()
  await tid('new-login-email').fill(OWNER.email)
  const duplicate = await submitNewLogin()
  if (duplicate.status !== 409) fail(`expected 409 for a duplicate email, got ${duplicate.status}`)
  await shows('new-login-error', duplicate.data.detail)

  await tid('new-login-email').fill(NEW_LOGIN.email)
  await tid('new-login-password').fill(NEW_LOGIN.weakPassword)
  const weak = await submitNewLogin()
  if (weak.status !== 400) fail(`expected 400 for a weak password, got ${weak.status} (is the strong-password rule on?)`)
  if (!/strong password/i.test(weak.data.detail || '')) fail(`unexpected refusal: ${JSON.stringify(weak.data)}`)
  await shows('new-login-error', weak.data.detail)
  const { items } = await ownerApi('GET', '/api/clinic/users')
  if (items.some((login) => login.email === NEW_LOGIN.email)) fail('the login was created despite the weak password')
})

await r.step('Logins: a Receptionist login is added and listed', async () => {
  await tid('add-login-sheet').waitFor()
  await tid('new-login-password').fill(NEW_LOGIN.password)
  const created = await submitNewLogin()
  if (created.status !== 201) fail(`expected 201, got ${created.status}: ${JSON.stringify(created.data)}`)
  await tid('add-login-sheet').waitFor({ state: 'hidden' })
  await tid('toast-success').waitFor()
  await shows(`login-name-${NEW_LOGIN.email}`, NEW_LOGIN.name)
  await shows(`login-role-${NEW_LOGIN.email}`, 'Receptionist')
  await shows(`login-status-${NEW_LOGIN.email}`, 'Active')
  const { items } = await frontDeskApi('GET', '/api/clinic/users')
  const saved = items.find((login) => login.email === NEW_LOGIN.email)
  if (!saved || saved.role !== 'Receptionist' || saved.status !== 'Active') fail(`the API does not list the new login as an active Receptionist: ${JSON.stringify(saved)}`)
})

await r.step('Logins: resetting the password lets the person sign in with the new one', async () => {
  await tid(`login-password-${NEW_LOGIN.email}`).click()
  await tid('reset-password-sheet').waitFor()
  await tid('reset-password-input').fill('short')
  await tid('reset-password-submit').click()
  await shows('reset-password-sheet', 'Use at least 8 characters.')
  await tid('reset-password-input').fill(NEW_LOGIN.resetPassword)
  await tid('reset-password-submit').click()
  await tid('reset-password-sheet').waitFor({ state: 'hidden' })
  const signedIn = await apiSignIn(NEW_LOGIN.email, NEW_LOGIN.resetPassword)
  if (signedIn.status !== 200) fail(`sign-in with the new password answered ${signedIn.status}`)
})

await r.step('Logins: deactivating asks first, then the person can no longer sign in', async () => {
  await tid(`login-edit-${NEW_LOGIN.email}`).click()
  await tid('edit-login-sheet').waitFor()
  await tid('edit-login-name').fill(NEW_LOGIN.renamed)
  await tid('segment-Inactive').click()
  await tid('edit-login-submit').click()
  await tid('confirm-sheet').waitFor()
  let { items } = await ownerApi('GET', '/api/clinic/users')
  if (items.find((login) => login.email === NEW_LOGIN.email)?.status !== 'Active') fail('the login was deactivated before the confirmation')
  await tid('confirm-yes').click()
  await tid('edit-login-sheet').waitFor({ state: 'hidden' })
  await shows(`login-status-${NEW_LOGIN.email}`, 'Inactive')
  await shows(`login-name-${NEW_LOGIN.email}`, NEW_LOGIN.renamed)
  ;({ items } = await ownerApi('GET', '/api/clinic/users'))
  if (items.find((login) => login.email === NEW_LOGIN.email)?.status !== 'Inactive') fail('the API still lists the login as active')
  const refused = await apiSignIn(NEW_LOGIN.email, NEW_LOGIN.resetPassword)
  if (refused.status !== 403 || !/inactive/i.test(refused.data.detail || '')) fail(`a deactivated login could still sign in: ${refused.status} ${JSON.stringify(refused.data)}`)
})

/* ------------------------------------------------------------------- more */

await r.step('More: clinic rules — double booking is saved through the API and put back', async () => {
  const before = await ownerApi('GET', '/api/settings')
  const original = Boolean(before.doubleBooking)
  const label = (on) => (on ? 'On' : 'Off')
  try {
    await openTab('more')
    await shows('account-name', (await ownerApi('GET', '/api/clinic/users')).items.find((login) => login.email === OWNER.email).name)
    await tid('more-clinic-rules').click()
    await tid('clinic-rules-screen').waitFor()
    for (const rule of ['onlineBooking', 'doubleBooking', 'partialPayments', 'roundOff', 'consentRequired', 'financialLock', 'sessionTimeout', 'strongPassword']) {
      await tid(`rule-${rule}`).waitFor()
    }
    await shows('rule-doubleBooking-state', label(original))

    for (const target of [!original, original]) {
      await tid('rule-doubleBooking').click()
      await shows('rule-doubleBooking-state', label(target))
      await until(async () => Boolean((await frontDeskApi('GET', '/api/settings')).doubleBooking) === target || `the API still has doubleBooking=${!target}`)
    }
    const after = await ownerApi('GET', '/api/settings')
    for (const key of ['clinicName', 'timezone', 'currency', 'invoicePrefix', 'receiptPrefix', 'gstin']) {
      if (after[key] !== before[key]) fail(`saving a rule changed "${key}" from ${JSON.stringify(before[key])} to ${JSON.stringify(after[key])}`)
    }
    if (Object.keys(after).length < Object.keys(before).length) fail('saving a rule dropped other settings')
  } finally {
    const now = await ownerApi('GET', '/api/settings')
    if (Boolean(now.doubleBooking) !== original) await ownerApi('PUT', '/api/settings', { values: { ...now, doubleBooking: original } })
  }
})

await r.step('More: clinic profile — read-only identity, validation, and the phone is edited then restored', async () => {
  const { clinic } = await ownerApi('GET', '/api/owner/clinic')
  const original = clinic.phone || ''
  const edited = `+91 90000 ${String(stamp).slice(-5)}`
  const savePhone = async (value) => {
    await tid('clinic-phone').fill(value)
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/owner/clinic') && response.request().method() === 'PATCH')
    await tid('clinic-save').click()
    const response = await answered
    if (response.status() !== 200) fail(`saving the phone answered ${response.status()}`)
    await until(async () => ((await ownerApi('GET', '/api/owner/clinic')).clinic.phone || '') === value || `the API does not have the phone "${value}"`)
  }
  try {
    await openTab('more')
    await tid('more-clinic-profile').click()
    await tid('clinic-profile-screen').waitFor()
    for (const expected of [clinic.name, clinic.code, clinic.plan, clinic.status]) await shows('clinic-identity', expected)
    await until(async () => (await tid('clinic-phone').inputValue()) === original || 'the phone field does not show the saved phone')
    if ((await tid('clinic-email').inputValue()) !== (clinic.email || '')) fail('the email field does not show the saved email')

    const patches = () => apiRequests.filter((request) => request.startsWith('PATCH') && request.endsWith('/api/owner/clinic')).length
    const sentBefore = patches()
    await tid('clinic-phone').fill('12')
    await tid('clinic-save').click()
    await shows('clinic-profile-screen', 'Enter a phone number with 7 to 15 digits')
    await sleep(400)
    if (patches() !== sentBefore) fail('an invalid phone number was sent to the API')

    await savePhone(edited)
    await savePhone(original)
  } finally {
    const now = (await ownerApi('GET', '/api/owner/clinic')).clinic
    if ((now.phone || '') !== original) await ownerApi('PATCH', '/api/owner/clinic', { phone: original })
  }
})

await r.step('More: notifications open, and the change-password form checks its input without changing anything', async () => {
  await openTab('more')
  await tid('more-notifications').click()
  const { items } = await ownerApi('GET', '/api/notifications')
  await until(async () => (await countOf('notification')) === items.length || `notifications on screen do not match the API's ${items.length}`)
  if (items.length === 0) await tid('empty').waitFor()
  await tid('back').click()
  await tid('more-settings').click()
  await tid('settings-change-password').click()
  await tid('change-password-submit').click()
  await page.getByText('Enter your current password.', { exact: true }).waitFor()
  await tid('back').click()
  await tid('settings-screen').waitFor()
  await tid('back').click()
  await tid('more-screen').waitFor()
})

/* ------------------------------------------------- appointments, patients */

const NEW_PATIENT = { name: `E2E Patient ${stamp}`, mobile: `98${String(stamp).slice(-8)}` }
const booked = []
let newPatientId = ''
const clinicApi = (method, path, body) => ownerApi(method, `/api/clinic-app${path}`, body)
const inDays = (n) => addDays(today, n)
async function firstFree(doctor, from) {
  for (let i = 0; i < 30; i += 1) {
    const date = inDays(from + i)
    const { slots } = await clinicApi('GET', `/slots?date=${date}&doctor=${encodeURIComponent(doctor)}`)
    const free = slots.filter((s) => s.available).map((s) => s.time)
    if (free.length >= 2) return { date, time: free[free.length - 1], other: free[free.length - 2] }
  }
  fail(`no free day for ${doctor}`)
}
/** A fresh load of the home screen: nothing left open by an earlier step. */
async function freshHome() {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await tid('home-screen').waitFor({ timeout: 30000 })
}
async function pickDate(date) {
  const cell = tid(`date-${date}`)
  await cell.scrollIntoViewIfNeeded()
  await cell.click()
}

await r.step('Patients: the figures equal the API; adding checks the form and opens the new dashboard', async () => {
  await openTab('patients')
  const { figures } = await clinicApi('GET', '/patients')
  await until(async () => (await numberOf('patients-total')) === figures.total || `total ${await textOf('patients-total')} vs ${figures.total}`)
  await tid('add-patient').click()
  await tid('add-patient-screen').waitFor()
  await tid('patient-save').click()
  await page.getByText("Enter the patient's full name.").filter({ visible: true }).first().waitFor()
  await tid('patient-name').fill(NEW_PATIENT.name)
  await tid('patient-mobile').fill(NEW_PATIENT.mobile)
  await tid('patient-bp').fill('high')
  await tid('patient-save').click()
  await page.getByText('Write it like 120/80.').filter({ visible: true }).first().waitFor()
  await tid('patient-bp').fill('124/82')
  await tid('patient-dob').fill('1990-05-06')
  await tid('gender-Female').click()
  await tid('patient-visit_reason').fill('Bleeding gums')
  await tid('patient-save').click()
  await tid('patient-screen').waitFor({ timeout: 20000 })
  await shows('patient-name', NEW_PATIENT.name)
  const found = (await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)).items[0]
  if (!found) fail('the new patient is not in the API')
  newPatientId = found.id
  await tid('segment-profile').click()
  await page.getByText('124/82 mmHg').filter({ visible: true }).first().waitFor()
  // the owner sees the accounts tab
  await tid('segment-accounts').waitFor()
})

await r.step('Patients: adding the same name and number again warns before creating a second record', async () => {
  await freshHome()
  await openTab('patients')
  await tid('add-patient').click()
  await tid('patient-name').fill(NEW_PATIENT.name)
  await tid('patient-mobile').fill(NEW_PATIENT.mobile)
  await tid('patient-save').click()
  await page.getByText('This patient may already exist').filter({ visible: true }).first().waitFor()
  await tid('confirm-no').click()
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  if (items.length !== 1) fail(`expected one record, the API has ${items.length}`)
})

let doctorName = ''
let first = null
await r.step('Appointments: booking needs a patient, a doctor and a free time; the booked slot is then taken', async () => {
  await freshHome()
  await openTab('appointments')
  await tid('new-appointment').click()
  await tid('new-appointment-screen').waitFor()
  await tid('book-submit').click()
  await page.getByText('Choose the patient.').filter({ visible: true }).first().waitFor()
  await tid('choose-patient').click()
  await tid('patient-search').fill(NEW_PATIENT.name)
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  await tid(`pick-${items[0].code}`).click()
  const doctors = (await clinicApi('GET', '/doctors')).items
  doctorName = doctors.find((d) => d.kind === 'in-house').name
  await tid(`doctor-${doctorName}`).click()
  first = await firstFree(doctorName, 10)
  await pickDate(first.date)
  await tid(`slot-${first.time}`).click()
  await tid('book-treatment').fill('Scaling')
  await tid('book-submit').click()
  await tid('appointment-screen').waitFor({ timeout: 20000 })
  const list = await clinicApi('GET', `/appointments?scope=upcoming&q=${encodeURIComponent(NEW_PATIENT.name)}`)
  const mine = list.items.find((a) => a.date === first.date && a.time === first.time)
  if (!mine || mine.source !== 'Clinic App') fail(`the API does not have the booking: ${JSON.stringify(list.items)}`)
  booked.push(mine.id)
  first.id = mine.id
  const { slots } = await clinicApi('GET', `/slots?date=${first.date}&doctor=${encodeURIComponent(doctorName)}`)
  if (slots.find((s) => s.time === first.time).available) fail('the booked slot is still offered')
  await page.getByText('Case summary').filter({ visible: true }).first().waitFor()
})

await r.step('Appointments: rescheduling needs a reason; the original and new dates are shown', async () => {
  await tid('detail-reschedule').click()
  await tid('reschedule-screen').waitFor()
  const next = await firstFree(doctorName, 14)
  await pickDate(next.date)
  await tid(`slot-${next.time}`).click()
  await tid('reschedule-submit').click()
  await page.getByText('Give a reason for rescheduling.').filter({ visible: true }).first().waitFor()
  await tid('reason-Patient request').click()
  await tid('reschedule-submit').click()
  await tid('appointment-screen').waitFor()
  await page.getByText('Original date').filter({ visible: true }).first().waitFor({ timeout: 15000 })
  const detail = await clinicApi('GET', `/appointments/${first.id}`)
  if (detail.date !== next.date || detail.rescheduled_from?.date !== first.date || detail.reschedule_reason !== 'Patient request') fail(`unexpected: ${JSON.stringify(detail).slice(0, 300)}`)
  Object.assign(first, next)
})

await r.step('Appointments: time swap exchanges two bookings of the same day', async () => {
  const second = await clinicApi('POST', '/appointments', { patient_id: newPatientId, doctor: doctorName, date: first.date, time: first.other, treatment: 'Review' })
  booked.push(second.id)
  await page.reload({ waitUntil: 'networkidle' })
  await tid('appointment-screen').waitFor({ timeout: 30000 })
  await tid('detail-swap').click()
  await tid('swap-screen').waitFor()
  await tid(`appointment-${second.id}`).click()
  await tid('confirm-yes').click()
  await tid('appointment-screen').waitFor()
  const a = await clinicApi('GET', `/appointments/${first.id}`)
  const b = await clinicApi('GET', `/appointments/${second.id}`)
  if (a.time !== first.other || b.time !== first.time) fail(`times not swapped: ${a.time} / ${b.time}`)
  first.secondId = second.id
})

await r.step('Appointments: cancelling asks for a reason and keeps the refund note (no payment is made)', async () => {
  await page.goto(`${APP_URL}/appointments/${first.secondId}`, { waitUntil: 'networkidle' })
  await tid('appointment-screen').waitFor({ timeout: 30000 })
  await tid('detail-cancel').click()
  await tid('cancel-sheet').waitFor()
  await tid('cancel-confirm').click()
  await page.getByText('Give a reason for cancelling.').filter({ visible: true }).first().waitFor()
  await tid('cancel-reason').fill('Clinic closed')
  await tid('cancel-refund').fill('Advance of 500 to return at the desk')
  await tid('cancel-confirm').click()
  await tid('cancel-sheet').waitFor({ state: 'hidden' })
  const b = await clinicApi('GET', `/appointments/${first.secondId}`)
  if (b.status !== 'Cancelled' || b.refund_note !== 'Advance of 500 to return at the desk') fail(JSON.stringify(b).slice(0, 200))
  await page.getByText('Refund note').filter({ visible: true }).first().waitFor()
})

await r.step('Appointments: a draft holds no slot and is booked later', async () => {
  await freshHome()
  await openTab('appointments')
  await tid('new-appointment').click()
  await tid('choose-patient').click()
  await tid('patient-search').fill(NEW_PATIENT.name)
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  await tid(`pick-${items[0].code}`).click()
  await tid(`doctor-${doctorName}`).click()
  await tid('book-treatment').fill('Implant review')
  await tid('book-draft').click()
  await tid('appointment-screen').waitFor({ timeout: 20000 })
  await page.getByText('Not booked yet (draft)').waitFor()
  const drafts = await clinicApi('GET', '/appointments?scope=drafts')
  const draft = drafts.items.find((a) => a.treatment === 'Implant review' && a.patient === NEW_PATIENT.name)
  if (!draft) fail('the draft is not in the API')
  booked.push(draft.id)
  await tid('detail-reschedule').click()
  const slot = await firstFree(doctorName, 18)
  await pickDate(slot.date)
  await tid(`slot-${slot.time}`).click()
  await tid('reschedule-submit').click()
  await tid('appointment-screen').waitFor()
  await until(async () => (await clinicApi('GET', `/appointments/${draft.id}`)).status === 'Scheduled' || 'the draft was not booked')
})

await r.step('Appointments: the monthly view shows the API\'s count for each day; a day opens its list', async () => {
  await freshHome()
  await openTab('appointments')
  await tid('open-month').click()
  await tid('month-screen').waitFor()
  const month = first.date.slice(0, 7)
  for (let i = 0; i < 3 && !(await textOf('month-label')).includes(month.slice(0, 4)); i += 1) await sleep(200)
  // move to the month of the first booking
  const now = today.slice(0, 7)
  const steps = (Number(month.slice(0, 4)) - Number(now.slice(0, 4))) * 12 + Number(month.slice(5)) - Number(now.slice(5))
  for (let i = 0; i < steps; i += 1) await tid('month-next').click()
  const view = await clinicApi('GET', `/appointments/month?month=${month}`)
  const count = view.days[first.date] ?? 0
  if (count < 1) fail('the API has no appointment on the day of the booking')
  await until(async () => (await tid(`day-${first.date}`).innerText()).includes(String(count)) || `day cell shows ${await tid(`day-${first.date}`).innerText()}`)
  await tid(`day-${first.date}`).click()
  await tid(`appointment-${first.id}`).waitFor()
})

await r.step('Appointments: clean up what this run booked', async () => {
  if (process.env.E2E_DEBUG) console.log('console errors so far:', errors)
  for (const id of booked) {
    const a = await clinicApi('GET', `/appointments/${id}`)
    if (a.status === 'Scheduled' || a.status === 'Waiting') await clinicApi('POST', `/appointments/${id}/cancel`, { reason: 'E2E clean-up' })
  }
})

/* ------------------------------------------------------ book a consultant */

const VISITOR = { name: `Dr. E2E Visitor ${stamp}`, email: `visitor.${stamp}@e2e.test`, password: 'Visitor#2026x', id: '', code: '', token: '' }
const consultIds = []
const workdayAfter = (n) => { for (let i = n; ; i += 1) { const d = inDays(i); if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) return d } }

await r.step('Book a consultant: the case form checks its input; own choice offers the consultant\'s free slots; the request is sent', async () => {
  const made = await ownerApi('POST', '/api/consultants', { name: VISITOR.name, specialty: 'Orthodontics', type: 'Visiting', fee: 1500, status: 'Active', location: 'Trichy' })
  VISITOR.id = made.id
  VISITOR.code = made.code
  await ownerApi('POST', '/api/clinic/users', { name: VISITOR.name, email: VISITOR.email, password: VISITOR.password, role: 'Consultant', consultant_id: made.id })
  await freshHome()
  await tid('specialty-Orthodontics').click()
  await tid('consult-book-case').waitFor()
  await tid('consult-next').click()
  await page.getByText('Choose the patient.').filter({ visible: true }).first().waitFor()
  await tid('consult-choose-patient').click()
  await tid('patient-search').fill(NEW_PATIENT.name)
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  await tid(`pick-${items[0].code}`).click()
  await tid('treatment-Fixed Braces').click()
  await tid('tooth-11').click()
  await tid('tooth-21').click()
  await tid('quadrant-1').click()
  await tid('consult-bp').fill('high')
  await tid('consult-next').click()
  await page.getByText('Write it like 120/80.').filter({ visible: true }).first().waitFor()
  await tid('consult-bp').fill('128/84')
  await tid('consult-next').click()
  await tid('consult-book-choice').waitFor()
  // the speciality from the home screen narrows the list
  if ((await tid('consult-specialty').inputValue()) !== 'Orthodontics') fail('the speciality chosen on the home screen was not carried over')
  await tid(`consultant-${VISITOR.code}`).click()
  const day = workdayAfter(4)
  await pickDate(day)
  await tid('consult-slot-10:00').click()
  await tid('consult-submit').click()
  await page.getByText('Confirm the declaration to send the request.').filter({ visible: true }).first().waitFor()
  await tid('consult-declaration').click()
  await tid('consult-submit').click()
  await tid('consult-sent-ok').click()
  await tid('consult-request-screen').waitFor()
  const list = (await clinicApi('GET', '/consult/requests?scope=active')).items
  const mine = list.find((b) => b.consultant === VISITOR.name && b.date === day && b.time === '10:00')
  if (!mine || mine.status !== 'Requested' || mine.teeth.join() !== '11,21' || mine.vitals.bp !== '128/84') fail(`the API has ${JSON.stringify(mine).slice(0, 300)}`)
  consultIds.push(mine.id)
  VISITOR.request = mine.id
})

await r.step('Book a consultant: the consultant confirms; the clinic sees the start code and the consultant arriving', async () => {
  VISITOR.token = await staffToken(VISITOR.email, VISITOR.password, 'consultant')
  const accepted = await apiCall('POST', `/api/consultant/requests/${VISITOR.request}/accept`, {}, VISITOR.token)
  if (accepted.status !== 200) fail(`accept answered ${accepted.status}: ${JSON.stringify(accepted.data)}`)
  await page.reload({ waitUntil: 'networkidle' })
  await tid('start-code-card').waitFor({ timeout: 20000 })
  const { start_code: code } = await clinicApi('GET', `/consult/requests/${VISITOR.request}`)
  await shows('start-code', code.split('').join(' '))
  await apiCall('POST', `/api/consultant/requests/${VISITOR.request}/track`, { status: 'Arrived' }, VISITOR.token)
  await page.reload({ waitUntil: 'networkidle' })
  await shows('consult-timeline', 'Arrived')
  // the confirmed visit is on the clinic's day as a Dentor (consultant) appointment
  const { date } = await clinicApi('GET', `/consult/requests/${VISITOR.request}`)
  const day = await clinicApi('GET', `/appointments?date=${date}&kind=consultant`)
  if (!day.items.some((a) => a.doctor === VISITOR.name && a.chair === 'Consultation Room')) fail('the consultant visit is not on the clinic\'s day')
})

await r.step('Book a consultant: Dentor choice offers only evening times for a peak-hour visit and is received', async () => {
  await freshHome()
  await openTab('consult')
  await tid('consult-book').click()
  await tid('consult-choose-patient').click()
  await tid('patient-search').fill(NEW_PATIENT.name)
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  await tid(`pick-${items[0].code}`).click()
  await tid('consult-treatment').fill('Implant')
  await tid('consult-next').click()
  await tid('segment-dentor').click()
  await tid('dentor-type-peak').click()
  if (await countOf('dentor-time-10:00')) fail('a morning time is offered for a peak-hour visit')
  await tid('dentor-time-18:00').click()
  await tid('consult-declaration').click()
  await tid('consult-submit').click()
  await page.getByText('BOOKING CONFIRMED').filter({ visible: true }).first().waitFor()
  await tid('consult-sent-ok').click()
  const list = (await clinicApi('GET', '/consult/requests?scope=active')).items
  const mine = list.find((b) => b.choice === 'dentor' && b.treatment === 'Implant' && b.patient === NEW_PATIENT.name)
  if (!mine || mine.dentor_type !== 'peak' || mine.time !== '18:00') fail(`the API has ${JSON.stringify(mine).slice(0, 200)}`)
  consultIds.push(mine.id)
})

await r.step('Book a consultant: clean up what this run booked', async () => {
  for (const id of consultIds) {
    const b = await clinicApi('GET', `/consult/requests/${id}`)
    if (!['Completed', 'Cancelled', 'Declined', 'Started'].includes(b.status)) await clinicApi('POST', `/consult/requests/${id}/cancel`, { reason: 'E2E clean-up' })
  }
})

/* -------------------------------------------- labs, recall, rx, certificates */

const pickPatient = async (opener) => {
  await tid(opener).click()
  await tid('patient-search').fill(NEW_PATIENT.name)
  const { items } = await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)
  await tid(`pick-${items[0].code}`).click()
  return items[0]
}

await r.step('Labs: a dental lab order with teeth and shade passes the checks and the preview, and reaches the lab board', async () => {
  await freshHome()
  await openTab('labs')
  const { counts } = await clinicApi('GET', '/labs')
  await shows('labs-Dental', String(counts.Dental))
  await tid('labs-Dental').click()
  const lab = (await clinicApi('GET', '/labs?type=Dental')).items[0]
  await tid(`lab-${lab.name}`).click()
  await tid('lab-book').click()
  await tid('lab-book-screen').waitFor()
  await tid('lab-preview').click()
  await page.getByText('Choose the patient.').filter({ visible: true }).first().waitFor()
  await pickPatient('lab-choose-patient')
  await tid('work-Crown').click()
  await tid('lab-tooth-36').click()
  await tid('shade-A2').click()
  await tid('lab-preview').click()
  await page.getByText('Confirm the declaration to send the request.').filter({ visible: true }).first().waitFor()
  await tid('lab-declaration').click()
  await tid('lab-preview').click()
  await tid('lab-submit').click()
  await tid('lab-sent-ok').click()
  await tid('lab-orders-screen').waitFor()
  const orders = (await clinicApi('GET', `/lab-orders?scope=ongoing&q=${encodeURIComponent(NEW_PATIENT.name)}`)).items
  const mine = orders.find((o) => o.caseType === 'Crown' && o.teeth === '36' && o.shade === 'A2')
  if (!mine || mine.stage !== 'Order Received' || mine.lab !== lab.name) fail(`the API has ${JSON.stringify(orders).slice(0, 300)}`)
  await tid(`lab-order-${mine.code}`).waitFor()
  const board = await ownerApi('GET', `/api/lab_orders?q=${mine.code}`)
  if (!board.items.some((o) => o.code === mine.code)) fail('the web app\'s lab board does not have the order')
  NEW_PATIENT.labCode = mine.code
})

await r.step('Labs: a complaint is raised on that case and marked resolved', async () => {
  await freshHome()
  await openTab('labs')
  await tid('labs-complaints').click()
  await tid('complaints-screen').waitFor()
  await tid('complaint-new').click()
  await tid('complaint-submit').click()
  await page.getByText('Choose the case and the type, and describe the problem.').filter({ visible: true }).first().waitFor()
  await tid(`complaint-order-${NEW_PATIENT.labCode}`).click()
  await tid('complaint-type-Fit issue').click()
  await tid('complaint-description').fill('Crown margin is open on the distal side')
  await tid('complaint-submit').click()
  await tid('complaint-done-ok').click()
  const fresh = (await clinicApi('GET', '/lab-complaints?status=New')).items.find((c) => c.order_code === NEW_PATIENT.labCode)
  if (!fresh) fail('the complaint is not in the API')
  await tid(`complaint-${fresh.code}`).click()
  await tid('complaint-resolve').click()
  await page.getByText('This complaint has been successfully marked as resolved.').filter({ visible: true }).first().waitFor()
  await tid('complaint-done-ok').click()
  const after = (await clinicApi('GET', '/lab-complaints?status=Resolved')).items.find((c) => c.code === fresh.code)
  if (!after) fail('the complaint was not resolved')
})

await r.step('Re-Visit (dentor.fig 3879:2429): each treated patient once with the latest completed visit, as the API lists them; search narrows; a card opens the patient', async () => {
  await freshHome()
  await openTab('revisit')
  const { items } = await clinicApi('GET', '/revisits')
  if (!items.length) fail('the demo clinic has no completed visits to list')
  await until(async () => (await page.locator('[data-testid^="revisit-"][role="button"]').filter({ visible: true }).count()) === items.length || `the screen does not show the API's ${items.length} patients`)
  const first = items[0]
  await shows(`revisit-${first.patient_code}`, first.patient)
  await shows(`revisit-${first.patient_code}`, first.treatment)
  await shows(`revisit-last-${first.patient_code}`, `Last visit on ${first.last_visit_label}`)
  await tid('revisit-search').fill(first.patient_code)
  await until(async () => (await page.locator('[data-testid^="revisit-"][role="button"]').filter({ visible: true }).count()) === 1 || 'search did not narrow the list to one patient')
  await tid(`revisit-${first.patient_code}`).click()
  await tid('patient-screen').waitFor()
})

await r.step('Recall: a template fills the message; a patient without the app is reported back for a call', async () => {
  await freshHome()
  await openTab('recall')
  await pickPatient('recall-choose-patient')
  await tid('template-Routine Hygiene Recall').click()
  if (!(await tid('recall-message').inputValue()).includes('[Patient Name]')) fail('the template did not fill the message')
  await tid('recall-send').click()
  await page.getByText('does not use the Dentor patient app', { exact: false }).filter({ visible: true }).first().waitFor()
  await tid('recall-done-ok').click()
  const history = (await clinicApi('GET', `/recall?patient_id=${newPatientId}`)).items
  if (!history.length || history[0].delivered !== false || !history[0].message.startsWith(`Hi ${NEW_PATIENT.name}`)) fail(`the API has ${JSON.stringify(history[0])}`)
})

await r.step('E-prescription: drugs from the list and a copied prescription, preview, then signed for the patient', async () => {
  await freshHome()
  await openTab('rx')
  await tid('rx-preview-open').click()
  await page.getByText('Choose the patient.').filter({ visible: true }).first().waitFor()
  await pickPatient('rx-choose-patient')
  await tid('rx-diagnosis').fill('Irreversible pulpitis 36')
  const { drugs, recent } = await clinicApi('GET', '/rx/catalog')
  await tid('rx-drug-search').fill(drugs[0].name.slice(0, 5))
  await tid(`drug-${drugs[0].name}`).click()
  await tid('segment-copy').click()
  await tid(`copy-${recent[0].code}`).click()
  await tid('rx-advice').fill('Warm saline rinses twice a day')
  await tid('rx-preview-open').click()
  await tid('rx-preview').waitFor()
  await tid('rx-submit').click()
  await tid('rx-saved-ok').click()
  const list = (await clinicApi('GET', `/prescriptions?patient_id=${newPatientId}`)).items
  if (!list.length || list[0].diagnosis !== 'Irreversible pulpitis 36' || !list[0].meds.some((m) => m.drug === drugs[0].name)) fail(`the API has ${JSON.stringify(list[0]).slice(0, 300)}`)
})

await r.step('Certificates: a fitness certificate needs findings and fitness, then shows on its preview', async () => {
  await freshHome()
  await openTab('certificates')
  await tid('certificate-add').click()
  await tid('certificate-kind-fitness').click()
  await tid('certificate-new-screen').waitFor()
  await pickPatient('certificate-choose-patient')
  await tid('certificate-generate').click()
  await page.getByText('Give the findings and the fitness opinion.').filter({ visible: true }).first().waitFor()
  await tid('certificate-findings').fill('Good oral hygiene, no caries')
  await tid('fitness-Fit for dental treatment').click()
  await tid('certificate-generate').click()
  await tid('certificate-screen').waitFor({ timeout: 20000 })
  await page.getByText('Fit for dental treatment').filter({ visible: true }).first().waitFor()
  const certs = (await clinicApi('GET', `/certificates?type=Fitness&q=${encodeURIComponent(NEW_PATIENT.name)}`)).items
  if (!certs.length || certs[0].details.fitness !== 'Fit for dental treatment') fail('the API does not have the certificate')
})

await r.step('Tariff: each speciality lists the API\'s treatments and fees', async () => {
  await freshHome()
  await openTab('tariff')
  const { groups } = await clinicApi('GET', '/tariff')
  const endo = groups.find((g) => g.category === 'Endodontics')
  await tid('tariff-cat-Endodontics').click()
  for (const t of endo.items.slice(0, 3)) await shows(`tariff-${t.code}`, Math.round(t.price).toLocaleString('en-IN'))
})

/* --------------------------------------------------------------- accounts */

await r.step('Accounts: revenue, expenses and each category for this month equal the API', async () => {
  await freshHome()
  await openTab('accounts')
  await tid('accounts-period-month').click()
  const range = PERIODS.month
  const s = await ownerApi('GET', `/api/clinic-app/accounts/summary${query(range)}`)
  await tid('accounts-revenue-value').waitFor({ timeout: 20000 })
  await until(async () => (await numberOf('accounts-revenue-value')) === Math.round(s.collected) || `revenue ${await textOf('accounts-revenue-value')} vs ${s.collected}`)
  await until(async () => (await numberOf('accounts-expenses-value')) === Math.round(s.expenses) || `expenses ${await textOf('accounts-expenses-value')} vs ${s.expenses}`)
  for (const c of s.categories) await until(async () => (await textOf(`expense-cat-${c.category}`)).includes(`${c.entries} entr`) || `${c.category}: ${await textOf(`expense-cat-${c.category}`)}`)
})

await r.step('Accounts: an expense is checked, recorded and counted in its category', async () => {
  await tid('expense-cat-Domestic').click()
  await tid('expenses-screen').waitFor()
  await tid('expense-add').click()
  await tid('expense-save').click()
  await page.getByText('Enter the amount.').filter({ visible: true }).first().waitFor()
  await tid('expense-amount').fill('1234')
  await tid('expense-payee').fill(`E2E Electricity ${stamp}`)
  await tid('expense-description').fill('Electricity bill')
  await tid('expense-save').click()
  await tid('expense-sheet').waitFor({ state: 'hidden' })
  const { items } = await ownerApi('GET', `/api/clinic-app/accounts/expenses?category=Domestic${query(PERIODS.month).replace('?', '&')}`)
  const mine = items.find((x) => x.payee === `E2E Electricity ${stamp}`)
  if (!mine || mine.amount !== 1234) fail('the expense is not in the API')
  await tid(`expense-${mine.code}`).waitFor()
})

await r.step('Accounts: invoices open with their receipts; the statement balances received against paid out', async () => {
  await freshHome()
  await openTab('accounts')
  await tid('accounts-invoices').click()
  await tid('account-invoices-screen').waitFor()
  await tid('invoices-period-month').click()
  const { items } = await ownerApi('GET', `/api/clinic-app/accounts/invoices${query(PERIODS.month)}`)
  if (items.length) {
    await tid(`invoice-${items[0].number}`).click()
    await tid('invoice-screen').waitFor()
    await page.getByText(items[0].number).filter({ visible: true }).first().waitFor()
  }
  await freshHome()
  await openTab('accounts')
  await tid('accounts-statement').click()
  await tid('statement-generate').click()
  await tid('statement-rows').waitFor()
  const st = await ownerApi('GET', `/api/clinic-app/accounts/statement?date_from=${monthStart}&date_to=${today}`)
  await page.getByText(Math.abs(Math.round(st.net)).toLocaleString('en-IN'), { exact: false }).filter({ visible: true }).first().waitFor()
})

/* -------------------------------------------------- engagement and support */

const SUPER = { email: 'superadmin@dentor.in', password: 'SuperAdmin@2026' }
const engageApi = (method, path, body) => ownerApi(method, `/api/engage${path}`, body)

await r.step('Support: a ticket is raised and Dentor\'s answer appears on it', async () => {
  await freshHome()
  await openTab('support')
  await tid('ticket-raise').click()
  await tid('ticket-submit').click()
  await page.getByText('Choose the type, give a subject and describe the problem.').filter({ visible: true }).first().waitFor()
  await tid('ticket-type-Technical').click()
  await tid('ticket-subject').fill(`E2E ticket ${stamp}`)
  await tid('ticket-description').fill('The figures did not refresh after a payment.')
  await tid('ticket-submit').click()
  await tid('ticket-done-ok').click()
  const mine = (await engageApi('GET', '/tickets')).items.find((t) => t.subject === `E2E ticket ${stamp}`)
  if (!mine) fail('the ticket is not in the API')
  const sa = await staffToken(SUPER.email, SUPER.password)
  const answered = await apiCall('POST', `/api/platform/tickets/${mine.id}/answer`, { text: 'Fixed on our side, please refresh.', status: 'Resolved' }, sa)
  if (answered.status !== 200) fail(`answer: ${answered.status}`)
  await page.reload({ waitUntil: 'networkidle' })
  await tid('segment-closed').click()
  await tid(`ticket-${mine.code}`).click()
  await page.getByText('Fixed on our side, please refresh.', { exact: false }).filter({ visible: true }).first().waitFor()
})

await r.step('Chat: a message to a consultant gets the consultant\'s reply in the thread', async () => {
  await freshHome()
  await openTab('chat')
  await tid('chat-new').click()
  await tid(`chat-to-${VISITOR.name}`).click()
  await tid('chat-subject').fill(`Implant case ${stamp}`)
  await tid('chat-first').fill('Please review the HbA1c report before the visit.')
  await tid('chat-start').click()
  await tid('chat-screen').waitFor()
  const threads = (await apiCall('GET', '/api/engage/chats', undefined, VISITOR.token)).data.items
  const thread = threads.find((t) => t.subject === `Implant case ${stamp}`)
  if (!thread || thread.unread !== 1) fail('the consultant does not have the message')
  await apiCall('POST', `/api/engage/chats/${thread.id}/messages`, { text: 'Seen. Please upload the intra-oral pictures.' }, VISITOR.token)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Seen. Please upload the intra-oral pictures.').filter({ visible: true }).first().waitFor({ timeout: 20000 })
  await tid('chat-input').fill('Uploaded.')
  await tid('chat-send').click()
  await until(async () => (await apiCall('GET', `/api/engage/chats/${thread.id}`, undefined, VISITOR.token)).data.messages.length === 3 || 'the reply did not reach the consultant')
})

await r.step('Offers: an offer is posted to patients; the patient app sees it and the view is counted', async () => {
  await freshHome()
  await openTab('offers')
  await tid('offer-new').click()
  await tid('offer-new-screen').waitFor()
  await tid('offer-post').click()
  await page.getByText('Give the offer a title.').filter({ visible: true }).first().waitFor()
  await tid('offer-title').fill(`E2E Cleaning ${stamp}`)
  const { groups } = await clinicApi('GET', '/tariff')
  const treatment = groups[0].items[0].name
  await tid(`offer-treatment-${treatment}`).click()
  await tid('offer-value').fill('15')
  await tid('offer-post').click()
  await tid('offer-done-ok').click()
  await tid('offers-screen').waitFor()
  const offer = (await engageApi('GET', '/offers')).items.find((o) => o.title === `E2E Cleaning ${stamp}`)
  if (!offer || offer.status !== 'Sent' || offer.label !== '15% off') fail(`the API has ${JSON.stringify(offer)}`)
  const patient = await apiCall('POST', '/api/patient/auth/login', { identifier: '9876543210', password: 'Patient@2026' })
  const seen = (await apiCall('GET', '/api/patient/offers', undefined, patient.data.access_token)).data.items
  if (!seen.some((o) => o.id === offer.id)) fail('the patient app does not see the offer')
  await apiCall('POST', `/api/patient/offers/${offer.id}/view`, {}, patient.data.access_token)
  await page.reload({ waitUntil: 'networkidle' })
  await shows(`offer-E2E Cleaning ${stamp}`, '1 viewed')
})

await r.step('Rating: once a consultant visit is completed the clinic rates the consultant', async () => {
  const patient = (await clinicApi('GET', `/patients?q=${encodeURIComponent(NEW_PATIENT.name)}`)).items[0]
  const day = workdayAfter(6)
  const req = await clinicApi('POST', '/consult/requests', { patient_id: patient.id, choice: 'own', consultant_id: VISITOR.id, date: day, time: '11:00', treatment: 'Clear Aligners', declaration: true })
  await apiCall('POST', `/api/consultant/requests/${req.id}/accept`, {}, VISITOR.token)
  const code = (await clinicApi('GET', `/consult/requests/${req.id}`)).start_code
  await apiCall('POST', `/api/consultant/requests/${req.id}/start`, { code }, VISITOR.token)
  await apiCall('POST', `/api/consultant/requests/${req.id}/complete`, { treatment_provided: 'Aligners delivered' }, VISITOR.token)
  await page.goto(`${APP_URL}/consult/${req.id}`, { waitUntil: 'networkidle' })
  await tid('rate-consultant').click()
  await tid('rate-submit').click()
  await page.getByText('Choose the stars.').filter({ visible: true }).first().waitFor()
  await tid('star-4').click()
  await tid('recommend-yes').click()
  await tid('rate-text').fill('On time and careful')
  await tid('rate-submit').click()
  await tid('rate-sheet').waitFor({ state: 'hidden' })
  const reviews = (await apiCall('GET', '/api/engage/reviews/mine', undefined, VISITOR.token)).data
  if (!reviews.items.some((x) => x.text === 'On time and careful' && x.rating === 4)) fail('the consultant does not see the rating')
})

await r.step('Settings, wallet, plans, store, jobs and help do what they say', async () => {
  await freshHome()
  await openTab('more')
  // design order (dentor.fig 233, 281): More › Settings › Notification Setting
  for (const row of ['more-clinic-profile', 'more-offer', 'more-settings', 'more-help']) await tid(row).waitFor()
  await tid('more-settings').click()
  for (const row of ['settings-notification-settings', 'settings-change-password', 'setting-biometric', 'settings-privacy', 'settings-terms', 'settings-help']) await tid(row).waitFor()
  await tid('settings-notification-settings').click()
  await tid('notification-settings-screen').waitFor()
  // the design's messages for the mute switch (dentor.fig 289)
  await tid('pref-mute').click()
  await page.getByText('Notification Muted Successfully', { exact: true }).waitFor()
  await tid('pref-mute').click()
  await page.getByText('Notification Unmuted Successfully', { exact: true }).waitFor()
  if ((await engageApi('GET', '/prefs')).mute) fail('mute is still on after switching it off')
  await tid('silence-30').click()
  await until(async () => Boolean((await engageApi('GET', '/prefs')).muted_until) || 'silencing was not saved')
  await freshHome()
  await openTab('wallet')
  const w = await engageApi('GET', '/wallet')
  await shows('wallet-code', w.code)
  await shows('wallet-points', `${w.points} Pts`)
  await freshHome()
  await openTab('plans')
  await tid('plan-elite_pro').waitFor()
  await freshHome()
  await openTab('store')
  const products = (await engageApi('GET', '/products')).items
  await tid(`product-${products[0].name}`).click()
  await tid('enquiry-send').click()
  await tid('enquiry-sheet').waitFor({ state: 'hidden' })
  const enquiries = (await engageApi('GET', '/tickets')).items.filter((t) => t.type === 'Store enquiry' && t.subject.startsWith(products[0].name))
  if (!enquiries.length) fail('the store enquiry did not reach Dentor')
  await freshHome()
  await openTab('jobs')
  await tid('job-new').click()
  await tid('job-title').fill(`E2E Endodontist ${stamp}`)
  await tid('job-description').fill('Two mornings a week, Trichy. Rotary experience preferred.')
  await tid('job-submit').click()
  await tid('job-sheet').waitFor({ state: 'hidden' })
  const posts = (await engageApi('GET', '/jobs?mine=true')).items
  const post = posts.find((j) => j.title === `E2E Endodontist ${stamp}`)
  if (!post || post.kind !== 'hiring') fail('the job post is not in the API')
  await engageApi('POST', `/jobs/${post.id}/close`)
  await freshHome()
  await openTab('help')
  await tid('faq-0').click()
  await page.getByText('pick a speciality', { exact: false }).filter({ visible: true }).first().waitFor()
})

/* ----------------------------------------------------------------- layout */

/** A tab's content must end where the tab bar begins. */
async function assertAboveTabBar(name) {
  const screen = await tid(SCREENS[name].root).boundingBox()
  const bar = await tid('tab-index').boundingBox() // every button of the bar sits at the same height
  if (!screen || !bar) fail(`cannot measure ${name}`)
  if (screen.y + screen.height > bar.y + 1) fail(`${name} runs ${Math.round(screen.y + screen.height - bar.y)}px under the tab bar`)
}

for (const viewport of VIEWPORTS) {
  await r.step(`Layout fits at ${viewport.width}×${viewport.height}`, async () => {
    await settle()
    await page.setViewportSize(viewport)
    const at = (screen) => `${screen} @${viewport.width}`
    for (const name of ['home', 'finance', 'operations', 'more']) {
      await openTab(name)
      await sleep(250)
      await assertNoOverflow(page, at(name))
      await assertAboveTabBar(name)
    }
    // the clinic overview opens from the menu as a screen of its own, and the menu itself must fit
    await openTab('overview')
    await sleep(250)
    await assertNoOverflow(page, at('overview'))
    await openTab('home')
    await tid('open-menu').click()
    await tid('side-menu').waitFor()
    // the menu is a panel at the screen's edge, not part of the content column: only page overflow counts
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) fail(`the menu overflows ${at('menu')}`)
    await page.mouse.click(8, viewport.height / 2) // the dimmed page beside the panel closes it
    await tid('side-menu').waitFor({ state: 'hidden' })
    // the appointments, patients and consultant-booking screens from the menu
    for (const name of ['appointments', 'patients', 'consult', 'labs', 'recall', 'rx', 'certificates', 'tariff', 'accounts', 'support', 'chat', 'offers', 'wallet', 'plans', 'store', 'jobs', 'help', 'tracking']) {
      await openTab(name)
      await sleep(300)
      await assertNoOverflow(page, at(name))
    }
    for (const path of ['/appointments/new', '/appointments/month', '/patients/new', '/consult/book']) {
      await page.goto(APP_URL + path, { waitUntil: 'networkidle' })
      await sleep(300)
      await assertNoOverflow(page, at(path))
    }
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await tid('home-screen').waitFor({ timeout: 30000 })
    await openTab('team')
    for (const segment of ['doctors', 'staff', 'logins']) {
      await tid(`segment-${segment}`).click()
      await sleep(250)
      await assertNoOverflow(page, at(`team/${segment}`))
    }
    await assertAboveTabBar('team')
    await tid('add-login').click()
    await tid('add-login-sheet').waitFor()
    await tid('new-login-role-consultant').click()
    await page.locator('[data-testid^="new-login-consultant-"]:visible').first().waitFor()
    await sleep(400)
    await assertNoOverflow(page, at('add login'))
    await tid('add-login-sheet').locator('[data-testid="sheet-close"]').click()
    await tid('add-login-sheet').waitFor({ state: 'hidden' })
    await tid(`login-edit-${FRONT_DESK.email}`).click()
    await tid('edit-login-sheet').waitFor()
    await sleep(400)
    await assertNoOverflow(page, at('edit login'))
    await tid('edit-login-sheet').locator('[data-testid="sheet-close"]').click()
    await tid('edit-login-sheet').waitFor({ state: 'hidden' })
    await openTab('finance')
    await tid('outstanding-invoice').first().click()
    await tid('invoice-sheet').waitFor()
    await sleep(400)
    await assertNoOverflow(page, at('invoice'))
    await tid('invoice-sheet-done').click()
    await tid('invoice-sheet').waitFor({ state: 'hidden' })
    for (const [row, screen] of [['more-clinic-profile', 'clinic-profile-screen'], ['more-clinic-rules', 'clinic-rules-screen']]) {
      await openTab('more')
      await tid(row).click()
      await tid(screen).waitFor()
      await sleep(250)
      await assertNoOverflow(page, at(screen))
    }
  })
}

/* --------------------------------------------------------------- sign out */

await r.step('Signing out asks first and returns to the sign-in screen', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openTab('more')
  await tid('more-sign-out').click()
  await tid('confirm-sheet').waitFor()
  await tid('confirm-no').click()
  await tid('confirm-sheet').waitFor({ state: 'hidden' })
  await tid('more-screen').waitFor()
  await tid('more-sign-out').click()
  await tid('confirm-yes').click()
  await tid('login-email').waitFor({ timeout: 15000 })
  if (await countOf('more-screen')) fail('the app is still open after signing out')
})

const code = r.finish(errors)
await browser.close()
process.exit(code)

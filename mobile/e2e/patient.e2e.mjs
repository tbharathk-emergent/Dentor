// End-to-end check of the Dentor Patient app in a browser.
//
//   node e2e/patient.e2e.mjs
//   APP_URL=http://localhost:8091 API_URL=http://localhost:8000 node e2e/patient.e2e.mjs
//   SHOTS_DIR=/some/folder node e2e/patient.e2e.mjs            # also save screenshots of the main screens (390 px)
//   SHOTS_DIR=/some/folder SHOTS_WIDTHS=320,390,768 node e2e/patient.e2e.mjs
//
// It drives the app only through what a patient can see and tap (data-testid) and checks the
// result through the API the way the front desk would see it. It needs the development
// database with demo data. Everything it creates is marked "E2E" and removed again, so the
// demo clinic looks the same afterwards and the script can run again and again.
//
// SMS codes (the API allows 5 per number per hour): each run signs up a new random number
// and requests 4 codes for it (sign-up, code login, password reset and one resend). The demo
// number 9876543210 is never sent a code: its one sign-up attempt is refused before that.
import { API_URL, VIEWPORTS, apiCall, assertNoOverflow, launch, runner, staffToken } from './helpers.mjs'

const APP_URL = process.env.APP_URL || 'http://localhost:8091'
const SHOTS_DIR = process.env.SHOTS_DIR || ''
const SHOTS_WIDTHS = (process.env.SHOTS_WIDTHS || '390').split(',').map(Number)

const DEMO = { mobile: '9876543210', password: 'Patient@2026', code: 'DEN-1001' }
const STAFF = { email: 'admin@dentor.in', password: 'Dentor@2026' }

const startedAt = new Date().toISOString()
const stamp = Date.now().toString(36)
const MARK = `E2E ${stamp}` // every record this run creates carries it
const WALK_IN = 'E2E Walk-in' // the other patient who "takes" a slot
const FRESH = {
  name: `E2E Patient ${stamp}`,
  mobile: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
  password: `Passw0rd${stamp}`,
  changedPassword: `Chang3d${stamp}`,
  resetPassword: `Res3t${stamp}xyz`,
  emailPassword: `Ema1l${stamp}xyz`,
  email: `fresh.${stamp}@e2e.test`,
  age: '31',
  child: `E2E Child ${stamp}`,
  code: '',
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG })
const hugeFile = (megabytes) => ({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(megabytes * 1024 * 1024, 7) })

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAhead = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}
const dayOfMonth = (date) => date.slice(8)
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const run = runner('Patient app')
const { browser, page, errors } = await launch(APP_URL)
page.setDefaultTimeout(20000)

/* ------------------------------------------------------------ page helpers */

const sel = (id) => `[data-testid="${id}"]`
/** Visible elements with this test id (screens kept alive underneath are ignored). */
const el = (id) => page.locator(sel(id)).filter({ visible: true })
const startingWith = (prefix) => page.locator(`[data-testid^="${prefix}"]`).filter({ visible: true })
const see = (id, timeout = 20000) => el(id).first().waitFor({ state: 'visible', timeout })
const gone = (id, timeout = 20000) => el(id).first().waitFor({ state: 'hidden', timeout })
const shown = async (id) => (await el(id).count()) > 0
const tap = (id) => el(id).last().click()
const type = (id, value) => el(id).last().fill(value)
const read = async (id) => (await el(id).last().innerText()).trim()
const valueOf = (id) => el(id).last().inputValue()
/** Waits until some visible element with this test id contains all the given texts. */
const seeText = (id, texts, timeout = 20000) =>
  page.waitForFunction(
    ([s, wanted]) => [...document.querySelectorAll(s)].some((n) => n.getClientRects().length > 0 && wanted.every((t) => n.textContent.includes(t))),
    [sel(id), [].concat(texts)],
    { timeout },
  )

/** Waits until a chat message has left the device: its bubble shows the text and no longer says "Sending…". */
const seeSent = (text) =>
  page.waitForFunction(
    ([s, wanted]) => [...document.querySelectorAll(s)].some((n) => n.getClientRects().length > 0 && n.textContent.includes(wanted) && !n.textContent.includes('Sending')),
    [sel('message-mine'), text],
  )

/** Wait for a toast of this kind, return its text and dismiss it so it covers nothing. */
async function toast(kind = 'success') {
  await see(`toast-${kind}`)
  const text = await read(`toast-${kind}`)
  await el(`toast-${kind}`).last().click()
  await gone(`toast-${kind}`)
  return text
}

/** Back out of whatever is open until the tab bar shows, then open the Home tab with fresh data. */
async function goHome() {
  for (let i = 0; i < 6 && !(await shown('tab-index')); i += 1) await tap('back')
  await tap('tab-profile') // returning to Home is what makes it reload
  await see('profile-screen')
  await tap('tab-index')
  await see('home-screen')
  await see('modules')
}

async function openModule(key, screen) {
  await goHome()
  await tap(`module-${key}`)
  await see(screen)
}

async function logIn(mobile, password) {
  await see('login-screen')
  await type('login-mobile', mobile)
  await type('login-password', password)
  await tap('login-submit')
}

async function logOut() {
  await goHome()
  await tap('tab-profile')
  await see('profile-screen')
  await tap('menu-logout')
  await tap('confirm-yes')
  await see('login-screen')
}

/** Reads the code the development server shows instead of sending an SMS. */
async function enterCode({ wrongFirst = false } = {}) {
  await see('otp-code')
  const code = await read('otp-dev-code')
  assert(/^\d{6}$/.test(code), `expected a 6-digit dev code, got "${code}"`)
  if (wrongFirst) {
    await type('otp-code', String((Number(code) + 1) % 1000000).padStart(6, '0'))
    await tap('otp-submit')
    await seeText('otp-error', 'Incorrect code')
  }
  await type('otp-code', code)
  await tap('otp-submit')
}

async function chooseFile(trigger, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap(trigger)])
  await chooser.setFiles(file)
}

const freeSlots = () => page.locator('[data-testid^="slot-"]:not([aria-disabled="true"])').filter({ visible: true })

/** Picks the first free slot on a day in the open slot picker and returns its time (HH:MM). */
async function pickSlot(date) {
  await tap(`date-${date}`)
  await see('time-slots')
  await freeSlots().first().waitFor({ state: 'visible' })
  const time = (await freeSlots().first().getAttribute('data-testid')).replace('slot-', '')
  await freeSlots().first().click()
  return time
}

/** Answers the app's next calls to one API path itself, to see how the app copes. Returns the undo. */
async function intercept(path, method, respond) {
  const url = `${API_URL}${path}`
  const handler = (route) => (route.request().method() === method ? respond(route) : route.fallback())
  await page.route(url, handler)
  return () => page.unroute(url, handler)
}
const answer = (status, body) => (route) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
const refuse = (status, detail) => answer(status, { detail })
const dropConnection = (route) => route.abort('connectionfailed')

/* ------------------------------------------------------------- API helpers */

let staff = ''
const staffGet = async (path) => (await apiCall('GET', path, undefined, staff)).data
const staffList = async (resource, filters) => (await staffGet(`/api/${resource}?${new URLSearchParams(filters)}`)).items ?? []
const staffDelete = (resource, id) => apiCall('DELETE', `/api/${resource}/${id}`, undefined, staff)
const staffCreate = async (resource, body) => {
  const res = await apiCall('POST', `/api/${resource}`, body, staff)
  assert(res.status === 201, `front desk could not create ${resource}: ${res.status} ${JSON.stringify(res.data)}`)
  return res.data
}
const isMine = (value) => String(value ?? '').startsWith('E2E ')
const conversationOf = async (code) => (await staffList('omni_conversations', { patientId: code, channel: 'Patient App' }))[0]

/** Removes what this script (this run or an earlier, interrupted one) left in the demo clinic. */
async function tidyUp() {
  for (const a of [...(await staffList('appointments', { patientCode: DEMO.code })), ...(await staffList('appointments', { patient: WALK_IN }))]) {
    if (isMine(a.notes)) await staffDelete('appointments', a.id)
  }
  for (const r of await staffList('reviews', { patientId: DEMO.code, source: 'patient-app' })) {
    if (isMine(r.text)) await staffDelete('reviews', r.id)
  }
  for (const c of await staffList('patient_consents', { patientId: DEMO.code })) {
    if (isMine(c.title)) await staffDelete('patient_consents', c.id)
  }
  for (const f of await staffList('patient_files', { patientId: DEMO.code, uploadedBy: 'patient' })) {
    if (isMine(f.name)) await staffDelete('patient_files', f.id)
  }
  for (const i of await staffList('invoices', { doctor: 'E2E Doctor' })) await staffDelete('invoices', i.id)
  for (const c of await staffList('omni_conversations', { channel: 'Patient App' })) {
    const kept = (c.messages ?? []).filter((m) => !isMine(m?.[1]))
    if (isMine(c.name) || kept.length === 0) await staffDelete('omni_conversations', c.id)
    else if (kept.length !== c.messages.length) await apiCall('PATCH', `/api/omni_conversations/${c.id}`, { messages: kept }, staff)
  }
  for (const p of await staffList('patients', { source: 'Patient App' })) {
    if (isMine(p.name)) await staffDelete('patients', p.id)
  }
  // What an interrupted run may have left changed rather than added: the demo patient's
  // profile (those fields are empty in the demo data) and the clinic's announcement.
  const demo = (await staffList('patients', { code: DEMO.code }))[0]
  if (demo) {
    const undo = {}
    if (isMine(demo.address)) undo.address = ''
    if (isMine(demo.emergencyName)) Object.assign(undo, { emergencyName: '', emergencyMobile: '' })
    if (/^e2e\./.test(demo.email ?? '')) undo.email = ''
    if (Object.keys(undo).length) await apiCall('PATCH', `/api/patients/${demo.id}`, { ...undo, photo: '' }, staff)
  }
  const ad = await staffGet('/api/advertisement')
  if (ad?.e2eOriginal) await apiCall('PUT', '/api/advertisement', { values: ad.e2eOriginal }, staff)
  // The clinic's activity feed: this run's patient-app lines, and any "E2E …" line left by an earlier one.
  for (const a of await staffList('activities', { user: 'patient-app' })) {
    if (isMine(a.message) || a.at >= startedAt) await staffDelete('activities', a.id)
  }
}

/* ------------------------------------------------------------------- setup */

let demoPatient = null
let consent = null // the pending consent the demo patient signs
let consentIsSeeded = false
let booked = null

await run.step('test data is ready (front-desk API)', async () => {
  staff = await staffToken(STAFF.email, STAFF.password)
  await tidyUp()
  demoPatient = (await staffList('patients', { code: DEMO.code }))[0]
  assert(demoPatient, 'the demo patient DEN-1001 is missing: is this the demo database?')

  // The demo patient needs a pending consent and an upcoming visit, whatever day this runs on.
  const consents = await staffList('patient_consents', { patientId: DEMO.code })
  consent = consents.find((c) => c.status === 'Pending')
  if (!consent) {
    // An interrupted run may have left the demo consent signed: make it pending again.
    consent = consents.find((c) => c.signedVia === 'Patient App')
    if (consent) await apiCall('PATCH', `/api/patient_consents/${consent.id}`, { status: 'Pending', signedAt: '', signedVia: '', signedBy: '' }, staff)
  }
  consentIsSeeded = !!consent
  consent ??= await staffCreate('patient_consents', { patientId: DEMO.code, title: `${MARK} consent`, date: daysAhead(0), status: 'Pending', notes: 'Created by the end-to-end check.' })
  const upcoming = (await staffList('appointments', { patientCode: DEMO.code })).some((a) => ['Scheduled', 'Waiting'].includes(a.status) && a.date >= daysAhead(0))
  if (!upcoming) {
    await staffCreate('appointments', {
      patient: demoPatient.name, patientCode: DEMO.code, date: daysAhead(1), time: '16:30', doctor: 'Dr. Kumar', chair: 'Chair 02',
      treatment: 'Review', duration: '30 min', status: 'Scheduled', notes: `${MARK} upcoming visit`,
    })
  }
})

/* ------------------------------------------------- sign up → clinic → home */

await run.step('first visit: splash, the permissions list (what each is for), then three onboarding slides', async () => {
  await see('welcome-permissions', 60000)
  for (const key of ['location', 'camera', 'photos', 'notifications', 'calendar', 'microphone']) await see(`permission-${key}`)
  await assertNoOverflow(page, 'permissions')
  await tap('welcome-continue')
  await see('onboarding')
  const first = await read('onboarding-title')
  await tap('onboarding-next')
  await tap('onboarding-next')
  assert((await read('onboarding-title')) !== first, 'the slide did not change')
  await see('onboarding-start')
  await see('onboarding-login')
  await assertNoOverflow(page, 'onboarding')
})

await run.step('sign-up form says what to fix', async () => {
  await tap('onboarding-start')
  // The design's disclaimer: Agree works only once "I understand" is ticked.
  await see('disclaimer')
  await assertNoOverflow(page, 'disclaimer')
  assert(await el('disclaimer-agree').last().isDisabled(), 'Agree must wait for "I understand"')
  await tap('disclaimer-understand')
  await tap('disclaimer-agree')
  await see('signup-screen')
  await tap('signup-submit')
  await seeText('signup-screen', ['Enter your full name.', 'Enter your 10-digit mobile number.', 'Choose a password.', 'Please accept the terms'])
  await type('signup-password', 'short')
  await type('signup-confirm', 'different')
  await type('signup-email', 'nobody@nowhere')
  await tap('signup-submit')
  await seeText('signup-screen', ['at least 8 characters', 'The two passwords do not match.', 'Enter a valid email address'])
  // the account gets an email, so it can also reset its password by email (step below)
  await type('signup-email', FRESH.email)
  await tap('signup-read-terms')
  await seeText('legal-sheet', ['Health information and emergencies', 'Last updated'])
  await tap('sheet-close')
  await gone('legal-sheet')
})

await run.step('sign up a new number with the SMS code (wrong code first) → welcome screen', async () => {
  await type('signup-name', FRESH.name)
  await type('signup-mobile', FRESH.mobile)
  await tap('signup-gender-Male')
  await type('signup-age', FRESH.age)
  await type('signup-password', FRESH.password)
  await type('signup-confirm', FRESH.password)
  await tap('signup-terms')
  // A server without an SMS provider answers 503: the form must say so in plain words.
  const restore = await intercept('/api/patient/auth/otp/request', 'POST', refuse(503, 'Verification codes are not available yet: this server has no SMS provider configured.'))
  await tap('signup-submit')
  await seeText('signup-notice', 'Verification codes are not available on this server yet')
  await restore()
  await tap('signup-submit')
  await see('signup-otp')
  assert((await read('otp-mobile')).replace(/\D/g, '').endsWith(FRESH.mobile), 'the code screen shows another number')
  await see('otp-resend-wait')
  await enterCode({ wrongFirst: true })
  await see('signup-success')
  assert(!(await shown('setup-screen')), 'the welcome screen was skipped')
  await tap('signup-continue')
  await see('setup-screen')
})

await run.step('clinic chooser: sign out and back in, empty directory, search, confirm details → home', async () => {
  await tap('setup-signout')
  // No clinic accepting app registrations: say so, and let the patient check again.
  const restore = await intercept('/api/patient/clinics', 'GET', answer(200, { items: [] }))
  await logIn(FRESH.mobile, FRESH.password)
  await see('setup-screen')
  await seeText('clinics-empty', 'No clinic accepts app registrations yet')
  assert(await el('setup-continue').last().isDisabled(), 'Continue must be off until a clinic is chosen')
  await restore()
  await el('clinics-empty').getByRole('button', { name: 'Check again' }).click()
  await see('clinics')
  await type('search-clinics', 'zzzz-no-such-clinic')
  await see('clinics-empty')
  await type('search-clinics', 'dentor')
  await see('clinics')
  await startingWith('clinic-option-').first().click()
  await tap('setup-continue')
  await see('setup-details')
  assert((await valueOf('setup-name')) === FRESH.name, 'the name is not prefilled from the account')
  assert((await valueOf('setup-age')) === FRESH.age, 'the age typed at sign-up is not prefilled')
  await tap('setup-join')
  await see('home-screen')
  await see('home-no-appointment')
  await see('modules')
  const record = (await staffList('patients', { mobile: FRESH.mobile }))[0]
  assert(record?.source === 'Patient App' && record.name === FRESH.name && String(record.age) === FRESH.age && record.gender === 'Male', 'the clinic did not get the new patient as entered')
  FRESH.code = record.code
})

await run.step('new patient: a bill shows as a balance notice, in Payments and as a notification', async () => {
  const bill = await staffCreate('invoices', {
    patientCode: FRESH.code, patient: FRESH.name, date: daysAhead(0), treatment: `${MARK} filling`, doctor: 'E2E Doctor',
    items: [{ name: 'Composite filling', qty: 1, price: 900, tax: 0 }], subtotal: 900, discount: 0, tax: 0, total: 900, paid: 0, balance: 900, status: 'Pending', notes: '',
  })
  await goHome()
  await seeText('home-outstanding', '₹900')
  await tap('home-outstanding')
  await see('payments-screen')
  await seeText('summary-outstanding', '₹900')
  await seeText(`invoice-card-${bill.id}`, ['₹900 to pay', bill.number])
  await goHome()
  await seeText('home-bell', '1')
  await tap('home-bell')
  await seeText('notification', 'New bill')
  await el('notification').first().click()
  await see('invoice-screen')
  await seeText('invoice-number', bill.number)
  await seeText('invoice-screen', ['Still to pay', 'Composite filling', 'No payment has been recorded'])
})

await run.step('new patient: chat starts empty; the clinic\'s reply arrives by itself and is counted as unread', async () => {
  await openModule('chat', 'chat-screen')
  await see('chat-empty')
  const hello = `${MARK} first message`
  await type('chat-input', hello)
  await tap('chat-send')
  await seeSent(hello)
  const thread = await conversationOf(FRESH.code)
  assert(thread?.messages?.some((m) => m[0] === 'in' && m[1] === hello), 'reception did not receive the message')
  const reply = `${MARK} reply from reception`
  const answered = await apiCall('PATCH', `/api/omni_conversations/${thread.id}`, { messages: [...thread.messages, ['out', reply, '10:00 AM', new Date().toISOString()]] }, staff)
  assert(answered.status === 200, `reception could not reply: ${answered.status}`)
  await seeText('message-clinic', reply, 30000) // the thread polls every 15 s
  // A second reply while the patient is elsewhere shows up as a badge on the Chat tile.
  await goHome()
  const later = await conversationOf(FRESH.code)
  await apiCall('PATCH', `/api/omni_conversations/${later.id}`, { messages: [...later.messages, ['out', `${MARK} see you soon`, '10:05 AM', new Date().toISOString()]] }, staff)
  await goHome()
  await seeText('badge-chat', '1')
})

await run.step('notifications: unread badge, mark all read, opening one leads to its screen', async () => {
  await tap('home-bell')
  await see('notification')
  assert((await el('notifications-day').first().innerText()) === 'Today', 'the newest notifications are not under a Today heading')
  await seeText('mark-all-read', 'Mark all')
  await tap('mark-all-read')
  await gone('mark-all-read')
  await el('notification').first().click() // the newest is the clinic's chat message
  await see('chat-screen')
  await goHome()
  assert(!/\d/.test(await el('home-bell').last().innerText()), 'the bell still shows unread notifications')
})

await run.step('family: add a member, switch to them (screens already open follow) and back', async () => {
  await tap('tab-profile')
  await see('profile-summary')
  assert((await read('profile-code')) === FRESH.code, 'the profile tab shows another patient code')
  await tap('menu-family')
  await see('family-screen')
  await see(`profile-row-${FRESH.code}`)
  await tap('family-add')
  await tap('family-submit')
  await seeText('family-sheet', 'Enter their full name.')
  await type('family-name', FRESH.child)
  await tap('family-relation-Child')
  await type('family-age', '7')
  await tap('family-submit')
  await toast()
  await startingWith('profile-switch-').first().waitFor({ state: 'visible' })
  const childCode = (await startingWith('profile-switch-').first().getAttribute('data-testid')).replace('profile-switch-', '')
  await startingWith('profile-switch-').first().click()
  await toast()
  await see('profile-screen')
  await seeText('profile-name', FRESH.child)
  assert((await read('profile-code')) === childCode, 'the profile tab still shows the previous patient code')
  // The child has no bill: the balance notice and the payments of the parent must be gone.
  await tap('tab-index')
  await see('home-no-appointment')
  assert(!(await shown('home-outstanding')), 'the home screen still shows the other profile\'s balance')
  await tap('module-payments')
  await see('invoices-empty')
  await goHome()
  await tap('tab-profile')
  await tap('menu-family')
  await tap(`profile-switch-${FRESH.code}`)
  await toast()
  await seeText('profile-name', FRESH.name)
  await tap('tab-index')
  await see('home-outstanding')
  for (const bill of await staffList('invoices', { patientCode: FRESH.code })) await staffDelete('invoices', bill.id)
})

await run.step('change password', async () => {
  await tap('tab-profile')
  await tap('menu-password')
  await type('current-password', FRESH.password)
  await type('new-password', FRESH.changedPassword)
  await type('confirm-password', FRESH.changedPassword)
  await tap('change-password-submit')
  await toast()
  await see('profile-screen')
})

await run.step('log out (with confirmation) → login; onboarding is not shown again', async () => {
  await logOut()
  assert(!(await shown('onboarding')), 'onboarding was shown again')
})

await run.step('log in with a one-time code', async () => {
  await tap('login-otp')
  await see('otp-login-screen')
  assert((await valueOf('otp-mobile-input')) === FRESH.mobile, 'the number used on the login screen was not carried over')
  await type('otp-mobile-input', '')
  await tap('otp-send')
  await seeText('otp-login-screen', 'Enter your 10-digit mobile number.')
  await type('otp-mobile-input', FRESH.mobile)
  await tap('otp-send')
  await see('otp-login-code')
  await enterCode()
  await see('home-screen')
  await logOut()
})

await run.step('forgot password: resend the code, new password, "please wait" on asking again, log in', async () => {
  await type('login-mobile', FRESH.mobile)
  await tap('login-forgot')
  await see('forgot-screen')
  assert((await valueOf('otp-mobile-input')) === FRESH.mobile, 'the number typed on the login screen was not carried over')
  await tap('otp-send')
  await see('forgot-otp')
  // After the countdown a new code can be requested; the old one stops working.
  const firstCode = await read('otp-dev-code')
  await seeText('otp-resend-wait', 'new code in')
  await see('otp-resend', 45000)
  await tap('otp-resend')
  await page.waitForFunction(([s, old]) => [...document.querySelectorAll(s)].some((n) => /^\d{6}$/.test(n.textContent) && n.textContent !== old), [sel('otp-dev-code'), firstCode])
  await see('otp-resend-wait')
  await type('otp-code', firstCode)
  await tap('otp-submit')
  await seeText('otp-error', 'Incorrect code')
  await enterCode()
  await see('forgot-password')
  await type('reset-password', 'weak')
  await type('reset-confirm', 'weak')
  await tap('reset-submit')
  await seeText('forgot-password', 'at least 8 characters')
  await type('reset-password', FRESH.resetPassword)
  await type('reset-confirm', FRESH.resetPassword)
  await tap('reset-submit')
  await see('reset-success')
  await tap('reset-login')
  await see('login-screen')
  assert((await valueOf('login-mobile')) === FRESH.mobile, 'the login screen lost the number')
  // Asking for another code straight away: the server says how long to wait, and the app shows it.
  await tap('login-forgot')
  await tap('otp-send')
  await seeText('otp-request-problem', 'Please wait')
  const wait = Number(/(\d+) second/.exec(await read('otp-request-problem'))?.[1])
  assert(wait > 0 && wait <= 30, 'the wait is not shown in seconds')
  await tap('forgot-login')
  await see('login-screen')
  await type('login-password', FRESH.changedPassword)
  await tap('login-submit')
  await see('login-error') // the old password no longer works
  await type('login-password', FRESH.resetPassword)
  await tap('login-submit')
  await see('home-screen')
})

await run.step('forgot password by email: a 4-digit code, a new password, then log in with the email', async () => {
  await logOut()
  await tap('login-forgot')
  await see('forgot-screen')
  await tap('forgot-by-email')
  await see('forgot-email')
  await type('forgot-email', FRESH.email)
  await tap('forgot-send')
  await see('forgot-code')
  const code = /(\d{4})/.exec(await read('dev-code'))?.[1]
  assert(code, 'no development code on screen')
  await type('code-input', code)
  await tap('forgot-verify')
  await see('forgot-new')
  await type('forgot-new', 'weak')
  await type('forgot-confirm', 'weak')
  await tap('forgot-save')
  await seeText('forgot-password', 'at least 8 characters')
  await type('forgot-new', FRESH.emailPassword)
  await type('forgot-confirm', FRESH.emailPassword)
  await tap('forgot-save')
  await see('forgot-login')
  await tap('forgot-login')
  await see('login-screen')
  await type('login-mobile', FRESH.email)
  await type('login-password', FRESH.resetPassword)
  await tap('login-submit')
  await see('login-error') // the password before the reset no longer works
  await type('login-password', FRESH.emailPassword)
  await tap('login-submit')
  await see('home-screen')
  FRESH.resetPassword = FRESH.emailPassword // what the account deletion below confirms with
})

await run.step('delete the account (password + confirmation) → signed out, login no longer works', async () => {
  await tap('tab-profile')
  await tap('menu-delete')
  await see('delete-account-screen')
  await tap('delete-submit')
  await seeText('delete-account-screen', 'Enter your password')
  await type('delete-password', 'Wrong-pass1')
  await tap('delete-submit')
  await tap('confirm-yes')
  await seeText('delete-account-screen', 'Password is incorrect')
  await type('delete-password', FRESH.resetPassword)
  await tap('delete-submit')
  await tap('confirm-yes')
  await see('login-screen')
  await logIn(FRESH.mobile, FRESH.resetPassword)
  await see('login-error')
})

await run.step('signing up a registered number offers to log in instead', async () => {
  await tap('login-signup')
  await see('signup-screen')
  await type('signup-name', 'Someone Else')
  await type('signup-mobile', DEMO.mobile)
  await tap('signup-gender-Female')
  await type('signup-age', '40')
  await type('signup-password', FRESH.password)
  await type('signup-confirm', FRESH.password)
  await tap('signup-terms')
  await tap('signup-submit')
  await seeText('signup-notice', 'already registered')
  await tap('signup-login-instead')
  await see('login-screen')
  assert((await valueOf('login-mobile')) === DEMO.mobile, 'the number was not carried to the login screen')
})

/* --------------------------------------------------------- the demo patient */

await run.step('log in as the demo patient; home shows the next appointment and the module grid', async () => {
  await logIn(DEMO.mobile, DEMO.password)
  await see('home-screen')
  await see('home-next-appointment')
  assert((await read('home-next-treatment')).length > 0, 'the next appointment has no title')
  assert(/\d{4}/.test(await read('home-next-date')) && /[AP]M/.test(await read('home-next-time')), 'the next appointment has no date or time')
  await see('home-consents')
  for (const key of ['records', 'reports', 'cbct', 'book', 'appointments', 'payments', 'reviews', 'prescriptions', 'chat', 'consents', 'fetch', 'offers']) await see(`module-${key}`)
  assert((await startingWith('module-').count()) === 12, 'the home grid should have twelve tiles (the design\'s eight that work, and the app\'s own four)')
  await tap('home-next-appointment')
  await see('appointment-screen')
  await tap('back')
})

await run.step('the clinic announcement appears on home while it is active', async () => {
  const before = await staffGet('/api/advertisement')
  const put = (values) => apiCall('PUT', '/api/advertisement', { values }, staff)
  try {
    // `e2eOriginal` lets a later run put the announcement back if this one is cut short.
    const set = await put({ ...before, title: `${MARK} free check-up week`, subtitle: 'Book before Sunday.', audience: 'Patients', status: 'Active', e2eOriginal: before })
    assert(set.status === 200, `the announcement could not be set: ${set.status}`)
    await goHome()
    await seeText('home-announcement', [`${MARK} free check-up week`, 'Book before Sunday.'])
  } finally {
    await put(before)
  }
  await goHome()
  await gone('home-announcement') // switched off again by the clinic
})

await run.step('book: the slot is taken meanwhile (409) → pick another → success → it is under Upcoming', async () => {
  await goHome()
  await tap('module-book')
  await see('book-screen')
  const doctor = await startingWith('doctor-option-').first().getAttribute('aria-label')
  await startingWith('doctor-option-').first().click()
  await tap('booking-next')
  const date = daysAhead(3)
  const taken = await pickSlot(date)
  await tap('booking-next')
  await tap('reason-Check-up')
  await type('booking-notes', `${MARK} booking`)
  await tap('booking-next')
  await seeText('booking-summary', ['Check-up', doctor, `${MARK} booking`])
  // Someone at the front desk books the same slot for another patient before the patient confirms.
  await staffCreate('appointments', {
    patient: WALK_IN, date, time: taken, doctor, chair: 'Chair 03', treatment: 'Consultation', duration: '30 min', status: 'Scheduled', notes: `${MARK} clash`,
  })
  await tap('booking-confirm')
  await seeText('book-screen', ['That slot was just taken', 'Pick a date and time'])
  await page.locator(`${sel(`slot-${taken}`)}[aria-disabled="true"]`).filter({ visible: true }).waitFor({ state: 'visible' })
  const time = (await freeSlots().first().getAttribute('data-testid')).replace('slot-', '')
  await freeSlots().first().click()
  await tap('booking-next')
  await tap('booking-next')
  await tap('booking-confirm')
  await see('booking-success')
  await tap('booking-view')
  await see('appointment-screen')
  const code = await read('appointment-code')
  booked = (await staffList('appointments', { patientCode: DEMO.code, code }))[0]
  assert(booked, `front desk cannot find ${code}`)
  assert(booked.source === 'Patient App', `source is "${booked.source}", expected "Patient App"`)
  assert(booked.status === 'Scheduled' && booked.date === date && booked.time === time && booked.doctor === doctor, 'the stored appointment differs from what was booked')
  assert(booked.notes === `${MARK} booking` && booked.treatment === 'Check-up', 'reason or notes were not stored')
  await tap('back')
  await tap('tab-appointments')
  await see('appointments-upcoming')
  await see(`appointment-card-${booked.id}`)
})

await run.step('reschedule it (date + slot sheet)', async () => {
  await tap(`appointment-card-${booked.id}`)
  await see('appointment-reschedule')
  await tap('appointment-reschedule')
  await see('reschedule-sheet')
  const date = daysAhead(5)
  const time = await pickSlot(date)
  await tap('reschedule-confirm')
  await toast()
  const moved = (await staffList('appointments', { code: booked.code }))[0]
  assert(moved.date === date && moved.time === time && moved.status === 'Scheduled', `front desk still sees ${moved.date} ${moved.time}`)
  await seeText('appointment-date', dayOfMonth(date))
})

await run.step('cancel it (confirmation with a reason)', async () => {
  await tap('appointment-cancel')
  await see('cancel-sheet')
  await tap('confirm-no')
  await gone('cancel-sheet')
  await seeText('appointment-status', 'Scheduled')
  await tap('appointment-cancel')
  await type('cancel-reason', `${MARK} cancel`)
  await tap('confirm-yes')
  await toast()
  await seeText('appointment-status', 'Cancelled')
  assert(!(await shown('appointment-cancel')) && !(await shown('appointment-reschedule')), 'a cancelled visit still offers actions')
  const cancelled = (await staffList('appointments', { code: booked.code }))[0]
  assert(cancelled.status === 'Cancelled' && cancelled.cancelReason === `${MARK} cancel`, 'front desk does not see the cancellation')
  await tap('back')
  await see('appointments-screen')
  await gone(`appointment-card-${booked.id}`)
  await tap('segment-past')
  await see(`appointment-card-${booked.id}`)
})

await run.step('when the clinic has turned online booking off (403) the app explains and offers the call', async () => {
  const restore = await intercept('/api/patient/appointments', 'POST', refuse(403, 'Online booking is turned off for this clinic. Please call the clinic.'))
  try {
    await goHome()
    await tap('module-book')
    await see('doctors')
    await startingWith('doctor-option-').first().click()
    await tap('booking-next')
    await pickSlot(daysAhead(4))
    await tap('booking-next')
    await tap('booking-next')
    await tap('booking-confirm')
    await seeText('booking-closed', 'Online booking is turned off')
    await seeText('booking-closed-call', 'Call +91')
  } finally {
    await restore()
  }
})

await run.step('a screen that cannot load says so and recovers with "Try again"; open a prescription', async () => {
  const restore = await intercept('/api/patient/prescriptions', 'GET', dropConnection)
  await goHome()
  await tap('module-prescriptions')
  await see('prescriptions-screen')
  await seeText('error', 'Cannot reach the clinic server')
  await restore()
  await el('error').getByRole('button', { name: 'Try again' }).click()
  await startingWith('prescription-card-').first().click()
  await see('prescription-screen')
  assert((await read('prescription-doctor')).startsWith('Dr.'), 'the prescription has no doctor')
  assert(/\d{4}/.test(await read('prescription-date')), 'the prescription has no date')
  await see('medicine-table')
  assert((await el('medicine-row').count()) >= 1, 'no medicines listed')
  await seeText('prescription-screen', ['Diagnosis', 'Medicines', 'Follow-up'])
})

await run.step('dental records: treatments, procedures, lab work and the 32-tooth chart', async () => {
  await goHome()
  await tap('module-records') // the design's LAB tile: records, opened on lab work
  await see('records-screen')
  await see('lab-list')
  await tap('segment-treatments')
  await see('treatments-list')
  await tap('segment-procedures')
  await see('procedures-list')
  await tap('segment-lab')
  await see('lab-list')
  await tap('segment-chart')
  await see('dental-chart')
  assert((await startingWith('tooth-').count()) === 32, 'the chart does not show 32 teeth')
  await tap('tooth-46')
  assert((await read('chart-condition')) === 'Root Canal', 'tooth 46 should be charted as Root Canal')
  assert((await read('chart-note')).includes('RCT'), 'the note for tooth 46 is missing')
  await tap('tooth-11')
  assert((await read('chart-condition')) === 'Healthy', 'an uncharted tooth should read Healthy')
})

await run.step('sign the pending consent', async () => {
  await goHome()
  await tap('home-consents')
  await see('consents-screen')
  await tap(`consent-sign-${consent.id}`)
  await tap('confirm-no')
  await seeText(`consent-status-${consent.id}`, 'Pending')
  await tap(`consent-sign-${consent.id}`)
  await tap('confirm-yes')
  await toast()
  await seeText(`consent-status-${consent.id}`, 'Signed')
  assert(!(await shown(`consent-sign-${consent.id}`)), 'a signed consent still offers to sign')
  const stored = await staffGet(`/api/patient_consents/${consent.id}`)
  assert(stored.status === 'Signed' && stored.signedVia === 'Patient App', 'front desk does not see the signature')
})

await run.step('clinic information: details, and the call / email actions do not fail', async () => {
  await goHome()
  await tap('tab-profile')
  await tap('menu-clinic')
  await seeText('clinic-screen', ['DENTOR Dental Clinic', 'Manaparai', '+91 73392 99339', 'admin@dentor.in', 'accepts bookings made in the app'])
  const popups = []
  page.context().on('page', (popup) => popups.push(popup))
  await tap('clinic-call')
  await tap('clinic-email')
  await page.waitForTimeout(800)
  assert(!(await shown('toast-error')), 'the call / email action reported a failure')
  for (const popup of popups) await popup.close()
})

await run.step('home: who is signed in, the clinic with a call button, a dental tip', async () => {
  await goHome()
  await seeText('patient-header', ['Hi, WelcomeBack', DEMO.code])
  await seeText('home-call-clinic', 'Call Clinic')
  assert((await read('home-tip')).length > 60, 'the dental tip is missing')
})

await run.step('payments: summary, pay-at-clinic note, open an invoice', async () => {
  await openModule('payments', 'payments-screen')
  await see('money-summary')
  assert((await read('summary-paid')).startsWith('₹') && (await read('summary-outstanding')).startsWith('₹'), 'the paid and pending totals are missing')
  await seeText('money-summary', ['Total Paid', 'Total Pending'])
  await type('invoice-search', 'no such bill')
  await see('invoices-no-match')
  await type('invoice-search', '')
  await seeText('pay-at-clinic', 'Bills are paid at the clinic')
  await seeText('pay-call', 'Call +91')
  await startingWith('invoice-card-').first().click()
  await see('invoice-screen')
  assert((await read('invoice-number')).length > 3, 'the invoice number is missing')
  assert((await el('invoice-line').count()) >= 1, 'the invoice has no line items')
  assert((await read('invoice-balance')).startsWith('₹'), 'the balance is missing')
  assert((await el('payment-row').count()) >= 1, 'the payments made against the invoice are missing')
  await seeText('pay-at-clinic', 'Bills are paid at the clinic')
})

await run.step('chat: a message that fails is taken back; one that is sent reaches reception', async () => {
  await openModule('chat', 'chat-screen')
  const lost = `${MARK} this one fails`
  const restore = await intercept('/api/patient/chat', 'POST', dropConnection)
  await type('chat-input', lost)
  await tap('chat-send')
  await toast('error')
  await restore()
  assert((await valueOf('chat-input')) === lost, 'the unsent text was not given back')
  assert(!(await page.locator(sel('message-mine')).filter({ visible: true, hasText: lost }).count()), 'the unsent bubble is still shown')
  const hello = `${MARK} hello`
  await type('chat-input', hello)
  await tap('chat-send')
  await seeSent(hello)
  assert((await valueOf('chat-input')) === '', 'the composer was not cleared')
  const thread = await conversationOf(DEMO.code)
  assert(thread?.messages?.some((m) => m[0] === 'in' && m[1] === hello), 'reception did not receive the message')
  assert(!thread.messages.some((m) => m[1] === lost), 'the failed message reached reception anyway')
})

await run.step('ratings & reviews: write one, it is listed as Pending', async () => {
  await openModule('reviews', 'reviews-screen')
  await tap('review-write')
  await see('review-form')
  await tap('review-submit')
  await seeText('review-form', ['Tap a star to give your rating.', 'Write a few words'])
  await tap('subject-clinic')
  await tap('star-5')
  assert((await read('rating-word')) === 'Excellent', 'the rating is not put into words')
  const text = `${MARK} review: friendly and on time.`
  await tap('review-tag-Friendly Doctor')
  await tap('review-tag-On time service')
  await tap('star-1')
  await seeText('review-form', 'What Went Wrong?')
  await tap('star-2')
  await seeText('review-form', 'What Can We Improve?')
  await tap('star-5')
  await tap('review-recommend-Yes, I recommend')
  await type('review-text', text)
  await tap('review-submit')
  await toast()
  await see('reviews-screen')
  await seeText('review', [text, 'Pending'])
  const stored = (await staffList('reviews', { patientId: DEMO.code, source: 'patient-app' })).find((r) => r.text === text)
  assert(stored && stored.rating === 5 && stored.status === 'Pending' && stored.type === 'Clinic', 'the clinic does not see the review')
  assert(stored.recommend === true && stored.tags.join() === 'Friendly Doctor,On time service', 'the quick tags and the recommendation were not stored')
  await seeText('review', ['Friendly Doctor', 'Recommends the clinic'])
  // The clinic approves and answers: the patient sees both.
  await apiCall('PATCH', `/api/reviews/${stored.id}`, { status: 'Approved', response: 'Thank you, see you soon!' }, staff)
  await goHome()
  await tap('module-reviews')
  await seeText('review', [text, 'Approved', 'Thank you, see you soon!'])
})

await run.step('edit the profile: validation, photo (size limit), save', async () => {
  await goHome()
  await tap('tab-profile')
  await tap('menu-edit')
  await see('edit-profile-screen')
  await see('profile-save')
  await type('profile-email', 'not-an-email')
  await type('profile-emergency-mobile', '12345')
  await tap('profile-save')
  await toast('error')
  await seeText('edit-profile-screen', ['Enter a valid email address', 'A mobile number has 10 digits.'])
  await chooseFile('photo-choose', hugeFile(2))
  await seeText('photo-problem', 'under 1.5 MB')
  await chooseFile('photo-choose', pngFile('me.png'))
  await see('photo-remove')
  await type('profile-email', `e2e.${stamp}@example.com`)
  await type('profile-address', `${MARK} Street`)
  await type('profile-emergency-name', 'E2E Contact')
  await type('profile-emergency-mobile', '9123456780')
  await tap('profile-save')
  await toast()
  await see('profile-screen')
  const saved = (await staffList('patients', { code: DEMO.code }))[0]
  assert(saved.address === `${MARK} Street` && saved.emergencyMobile === '9123456780' && saved.email === `e2e.${stamp}@example.com`, 'front desk does not see the changes')
  assert(saved.photo?.startsWith('data:image/png;base64,'), 'the photo was not stored')
  await tap('menu-edit')
  await tap('photo-remove')
  await tap('profile-save')
  await toast()
  assert((await staffList('patients', { code: DEMO.code }))[0].photo === '', 'the photo was not removed')
})

await run.step('reports: view the X-ray, upload a photo and a PDF (5 MB limit), delete own files only', async () => {
  await openModule('reports', 'reports-screen')
  await startingWith('report-card-').first().waitFor({ state: 'visible' })
  await tap('reports-upload')
  await chooseFile('upload-photo', hugeFile(6))
  await seeText('upload-problem', '5 MB or smaller')
  await chooseFile('upload-photo', pngFile('e2e-photo.png'))
  await see('upload-chosen')
  await type('upload-name', '')
  await tap('upload-submit')
  await seeText('upload-sheet', 'Give the file a name')
  await type('upload-name', `${MARK} photo`)
  await tap('upload-submit')
  await toast()
  await tap('reports-upload')
  await chooseFile('upload-pdf', { name: 'e2e-letter.pdf', mimeType: 'application/pdf', buffer: PDF })
  await see('upload-chosen')
  await type('upload-name', `${MARK} letter`)
  await tap('upload-submit')
  await toast()
  const files = await staffList('patient_files', { patientId: DEMO.code })
  const photo = files.find((f) => f.name === `${MARK} photo`)
  const letter = files.find((f) => f.name === `${MARK} letter`)
  const fromClinic = files.find((f) => f.uploadedBy !== 'patient')
  assert(photo?.dataUrl?.startsWith('data:image/png;base64,') && letter?.dataUrl?.startsWith('data:application/pdf;base64,'), 'the clinic did not receive the files')
  // the clinic's file: viewable, not deletable
  await tap(`report-card-${fromClinic.id}`)
  await see('report-image')
  assert(!(await shown('report-delete')), 'a clinic file must not be deletable')
  await tap('back')
  // own photo: view, then delete after confirming
  await seeText(`report-card-${photo.id}`, 'Uploaded by you')
  await tap(`report-card-${photo.id}`)
  await see('report-image')
  await tap('report-delete')
  await tap('confirm-yes')
  await toast()
  await see('reports-screen')
  await gone(`report-card-${photo.id}`)
  // own PDF: a plain "no preview yet" message; delete
  await tap(`report-card-${letter.id}`)
  await seeText('report-no-preview', 'PDF preview is not available in the app yet')
  await tap('report-delete')
  await tap('confirm-yes')
  await toast()
  await gone(`report-card-${letter.id}`)
  assert(!(await staffList('patient_files', { patientId: DEMO.code })).some((f) => isMine(f.name)), 'deleted files are still stored')
})

/* ----------------------------------------------------- layout at every size */

const captured = new Set()
/** No sideways scroll or clipped control at any supported width; optional screenshots. */
async function checkLayout(name) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(150)
    await assertNoOverflow(page, `${name} @${viewport.width}`)
    const shot = `${name}${viewport.width === 390 ? '' : `@${viewport.width}`}`
    if (SHOTS_DIR && SHOTS_WIDTHS.includes(viewport.width) && !captured.has(shot)) {
      captured.add(shot)
      await page.screenshot({ path: `${SHOTS_DIR}/${shot}.png` })
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

const OWNER_LOGIN = { email: 'owner@dentor.in', password: 'Owner@2026' }
let ownerTok = ''
const asOwner = async (method, path, body) => {
  if (!ownerTok) ownerTok = await staffToken(OWNER_LOGIN.email, OWNER_LOGIN.password, 'owner')
  const res = await apiCall(method, path, body, ownerTok)
  assert(res.status < 400, `${method} ${path} answered ${res.status}: ${JSON.stringify(res.data)}`)
  return res.data
}

await run.step('offers: a clinic offer is listed, opening it books with the offer and the clinic counts both', async () => {
  const till = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10)
  const offer = await asOwner('POST', '/api/engage/offers', { title: `E2E Smile ${stamp}`, kind: 'general', category: 'General', discount_type: 'amount', value: 300, valid_till: till })
  await openModule('offers', 'offers-screen')
  await see(`offer-${offer.id}`)
  await seeText(`offer-${offer.id}`, '₹300 off')
  await tap(`offer-book-${offer.id}`)
  await see('book-screen')
  await see('booking-offer')
  const viewed = await asOwner('GET', `/api/engage/offers/${offer.id}`)
  assert(viewed.viewed === 1, `the clinic sees ${viewed.viewed} views`)
  await tap('back')
})

await run.step('scheduler: a callback request reaches the clinic once', async () => {
  await openModule('book', 'book-screen')
  await tap('booking-callback')
  await see('callback-sheet')
  for (const c of (await asOwner('GET', '/api/clinic-app/callbacks')).items.filter((x) => x.patient_code === DEMO.code)) await asOwner('POST', `/api/clinic-app/callbacks/${c.id}/done`)
  await type('callback-note', 'About my next sitting')
  await tap('callback-send')
  await gone('callback-sheet')
  const notes = await asOwner('GET', '/api/notifications')
  assert(notes.items.some((n) => n.title === 'Callback requested' && n.body.includes('About my next sitting')), 'the front desk was not told')
  await tap('booking-callback')
  await tap('callback-send')
  await seeText('callback-error', 'already has your callback request')
  await tap('sheet-close')
  await gone('callback-sheet')
  // the front desk marks the call made (Clinic app), so the next request is accepted again
  for (const c of (await asOwner('GET', '/api/clinic-app/callbacks')).items.filter((x) => x.patient_code === DEMO.code)) await asOwner('POST', `/api/clinic-app/callbacks/${c.id}/done`)
})

await run.step('settings: notification settings switch phone alerts by kind', async () => {
  await goHome()
  await tap('tab-profile')
  await tap('menu-settings')
  await see('settings-screen')
  await tap('menu-notification-settings')
  await see('notification-settings-screen')
  await tap('pref-medicine_alerts')
  await page.waitForTimeout(500)
  const login = await apiCall('POST', '/api/patient/auth/login', { identifier: DEMO.mobile, password: DEMO.password })
  const prefs = (await apiCall('GET', '/api/patient/account/prefs', undefined, login.data.access_token)).data
  assert(prefs.medicine_alerts === false, 'the switch was not saved')
  await tap('pref-medicine_alerts')
  await page.waitForTimeout(500)
  await goHome()
})

await run.step('fetch: a record under another number joins the profiles after its code', async () => {
  const child = await asOwner('POST', '/api/clinic-app/patients', { name: `E2E Child Fetch ${stamp}`, mobile: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, allow_duplicate: true })
  await openModule('fetch', 'fetch-screen')
  await type('fetch-code', 'DEN-99999')
  await tap('fetch-send')
  await seeText('fetch-error', 'No patient with that ID')
  await type('fetch-code', child.code)
  await tap('fetch-send')
  await see('fetch-dev-code')
  const code = /(\d{6})/.exec(await read('fetch-dev-code'))[1]
  await type('fetch-otp', code)
  await tap('fetch-verify')
  await see('home-screen')
  const login = await apiCall('POST', '/api/patient/auth/login', { identifier: DEMO.mobile, password: DEMO.password })
  assert(login.data.profiles.some((p) => p.code === child.code), 'the fetched record is not among the profiles')
  // back to the demo patient's own record for the steps that follow (the account remembers the last profile)
  const own = login.data.profiles.find((p) => p.code === DEMO.code)
  await apiCall('POST', '/api/patient/profiles/select', { clinic_id: own.clinic_id, patient_id: own.patient_id }, login.data.access_token)
  await logOut()
  await logIn(DEMO.mobile, DEMO.password)
  await see('home-screen')
})

await run.step(`no overflow on the signed-in screens at ${VIEWPORTS.map((v) => v.width).join(' / ')}`, async () => {
  await goHome()
  await checkLayout('home')
  await tap('tab-appointments')
  await tap('segment-upcoming')
  await startingWith('appointment-card-').first().waitFor({ state: 'visible' })
  await checkLayout('appointments')
  await startingWith('appointment-card-').first().click()
  await see('appointment-screen')
  await see('appointment-clinic-call')
  await checkLayout('appointment')
  await tap('back')
  await tap('tab-records')
  await tap('segment-treatments')
  await see('treatments-list')
  await checkLayout('records-treatments')
  await tap('segment-chart')
  await see('dental-chart')
  await tap('tooth-46')
  await checkLayout('records-chart')
  await tap('segment-lab')
  await see('lab-list')
  await checkLayout('records-lab')
  await tap('tab-profile')
  await see('profile-summary')
  await checkLayout('profile')
  for (const [menu, screen, name] of [
    ['menu-edit', 'profile-emergency-mobile', 'edit-profile'],
    ['menu-family', 'profile-list', 'family'],
    ['menu-clinic', 'clinic-name', 'clinic'],
    ['menu-password', 'change-password-submit', 'change-password'],
    ['menu-delete', 'delete-account-screen', 'delete-account'],
  ]) {
    await tap(menu)
    await see(screen)
    await checkLayout(name)
    await tap('back')
    await see('profile-screen')
  }
  // Settings (the header gear and the profile row) holds the privacy policy and the terms.
  await tap('menu-settings')
  await see('settings-screen')
  await checkLayout('settings')
  for (const [menu, screen, name] of [['menu-terms', 'terms-screen', 'terms'], ['menu-privacy', 'privacy-screen', 'privacy']]) {
    await tap(menu)
    await see(screen)
    await checkLayout(name)
    await tap('back')
    await see('settings-screen')
  }
  await tap('back')
  await see('profile-screen')
  await tap('menu-logout')
  await see('confirm-sheet')
  await checkLayout('logout-confirm')
  await tap('confirm-no')
  await goHome()
  await tap('module-book')
  await see('doctors')
  await checkLayout('book-doctor')
  await startingWith('doctor-option-').first().click()
  await tap('booking-next')
  await pickSlot(daysAhead(2))
  await checkLayout('book-slot')
  await tap('booking-next')
  await checkLayout('book-details')
  await tap('booking-next')
  await checkLayout('book-review')
  for (const [key, screen] of [
    ['prescriptions', 'prescription-list'], ['reports', 'report-list'], ['payments', 'invoice-list'],
    ['chat', 'message-mine'], ['reviews', 'review-list'], ['consents', 'consent-list'],
  ]) {
    await openModule(key, screen)
    await checkLayout(key)
  }
  await openModule('prescriptions', 'prescription-list')
  await startingWith('prescription-card-').first().click()
  await see('medicine-table')
  await checkLayout('prescription')
  await openModule('payments', 'invoice-list')
  await startingWith('invoice-card-').first().click()
  await see('invoice-lines')
  await checkLayout('invoice')
  await openModule('reviews', 'review-list')
  await tap('review-write')
  await see('subject-clinic')
  await checkLayout('review-form')
  await openModule('reports', 'report-list')
  await tap('reports-upload')
  await see('upload-photo')
  await checkLayout('report-upload')
  await tap('sheet-close')
  await startingWith('report-card-').first().click()
  await see('report-image')
  await checkLayout('report')
  await goHome()
  await tap('home-bell')
  await page.locator(`${sel('notification')}, ${sel('empty')}`).filter({ visible: true }).first().waitFor({ state: 'visible' })
  await checkLayout('notifications')
})

await run.step('no overflow on the signed-out screens; a wrong password shows the error', async () => {
  await logOut()
  await checkLayout('login')
  await tap('login-signup')
  await see('signup-screen')
  await checkLayout('signup')
  await tap('back')
  await tap('login-forgot')
  await see('forgot-screen')
  await checkLayout('forgot')
  await tap('back')
  await tap('login-otp')
  await see('otp-login-screen')
  await checkLayout('otp-login')
  await tap('back')
  await logIn(DEMO.mobile, 'Wrong-password1')
  await seeText('login-error', 'Incorrect mobile number or password')
  assert(!(await shown('home-screen')), 'a wrong password must not sign in')
  await checkLayout('login-error')
})

/* ----------------------------------------------------------------- tidy up */

await run.step('the demo clinic is back as it was (front-desk API)', async () => {
  await tidyUp()
  if (consentIsSeeded) await apiCall('PATCH', `/api/patient_consents/${consent.id}`, { status: 'Pending', signedAt: '', signedVia: '', signedBy: '' }, staff)
  const restore = {}
  for (const key of ['email', 'address', 'emergencyName', 'emergencyMobile', 'photo']) restore[key] = demoPatient[key] ?? ''
  const restored = await apiCall('PATCH', `/api/patients/${demoPatient.id}`, restore, staff)
  assert(restored.status === 200, `could not restore the demo patient: ${restored.status}`)
  assert((await staffList('patients', { source: 'Patient App' })).every((p) => !isMine(p.name)), 'test patients were left behind')
  assert((await staffList('patient_consents', { patientId: DEMO.code, status: 'Pending' })).length >= 1, 'the demo patient has no pending consent left')
})

await browser.close()
process.exit(run.finish(errors))

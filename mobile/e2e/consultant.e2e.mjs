// Browser end-to-end check of the Dentor Consultant app (web build).
//
//   node e2e/consultant.e2e.mjs
//   APP_URL=http://localhost:8092 API_URL=http://localhost:8000 node e2e/consultant.e2e.mjs
//
// Needs only the app's URL, the API's URL and the app's data-testids. Everything it checks
// it sets up itself through the API (as the front desk), so it can be run again and again
// against the same development database. What it leaves behind: one completed and one
// cancelled test appointment, and one prescription for DEN-1001, per run.
import { apiCall, assertNoOverflow, launch, runner, staffToken, VIEWPORTS } from './helpers.mjs'

const APP_URL = process.env.APP_URL || 'http://localhost:8092'
const DOCTOR = 'Dr. Kumar'
const CONSULTANT = { email: 'kumar@dentor.in', password: 'Consultant@2026' }
const FRONT_DESK = { email: 'admin@dentor.in', password: 'Dentor@2026' }
// Outside the clinic's bookable hours (09:00–17:30), so these never take a slot another check wants.
const SPARE_TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '07:00', '07:30', '08:00', '08:30']
const STAMP = Date.now().toString(36)

const { browser, page, errors } = await launch(APP_URL)
const run = runner('Consultant app')

/* ---------------------------------------------------------------- helpers */

/** The visible element(s) with this test id (screens underneath the current one stay mounted). */
const t = (id) => page.locator(`[data-testid="${id}"]`).filter({ visible: true })
const textOf = async (id) => ((await t(id).first().textContent()) ?? '').trim()
const settle = () => page.waitForLoadState('networkidle')

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

async function expectText(id, expected, timeout = 15000) {
  const locator = t(id).first()
  await locator.waitFor({ timeout })
  const deadline = Date.now() + timeout
  let last = ''
  while (Date.now() < deadline) {
    last = ((await locator.textContent().catch(() => '')) ?? '').trim()
    if (expected instanceof RegExp ? expected.test(last) : last.includes(expected)) return last
    await page.waitForTimeout(150)
  }
  throw new Error(`"${id}" shows "${last.slice(0, 80)}", expected ${expected}`)
}

/** Leaves any detail screens and opens a tab. */
async function openTab(name) {
  for (let i = 0; i < 6 && (await t('back').count()) > 0; i += 1) {
    await t('back').last().click()
    await page.waitForTimeout(250)
    // A form with unsaved input asks before it closes.
    if ((await t('confirm-yes').count()) > 0) await t('confirm-yes').click()
  }
  await t(`tab-${name}`).click()
  await t(`screen-${name === 'index' ? 'today' : name}`).waitFor()
  await settle()
}

const back = async () => {
  await t('back').last().click()
  await page.waitForTimeout(250)
}

/** What follows `prefix` in the test ids of the visible elements named `${prefix}${suffix}`. */
const idsAfter = (prefix, suffix) =>
  page.evaluate(
    ([p, s]) => {
      const pattern = new RegExp(`^${p}${s}$`)
      return [...document.querySelectorAll(`[data-testid^="${p}"]`)]
        .filter((el) => el.getClientRects().length > 0 && pattern.test(el.getAttribute('data-testid')))
        .map((el) => el.getAttribute('data-testid').slice(p.length))
    },
    [prefix, suffix],
  )
/** Record ids of the visible rows whose test id is `${prefix}<record id>`. */
const rowIds = (prefix) => idsAfter(prefix, '[0-9a-f]{24}')

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

const rupees = (text) => Number(text.replace(/[^\d.]/g, ''))

/* ------------------------------------------------- API side of the checks */

let desk = '' // front-desk token: sets data up and reads back what the clinic sees
let doctor = '' // consultant token: reads the consultant's own API for comparisons
let today = '' // the clinic's date
const patients = {} // code → patient record id
const created = { todayAppt: null, laterAppt: null, treatmentIds: [], availability: null }

const deskGet = async (path) => {
  const res = await apiCall('GET', path, undefined, desk)
  expect(res.status === 200, `GET ${path} → ${res.status}`)
  return res.data
}

/** Books Dr. Kumar through the front-desk API at the first free spare time on `date`. */
async function bookWithDoctor(date, patientCode, patientName, treatment) {
  for (const time of SPARE_TIMES) {
    for (const chair of ['Chair 03', 'Chair 02', 'Chair 01']) {
      const res = await apiCall('POST', '/api/appointments', {
        patientId: patients[patientCode], patient: patientName, patientCode, date, time, treatment,
        doctor: DOCTOR, chair, duration: '30 min', status: 'Scheduled', notes: '',
      }, desk)
      if (res.status === 201) return res.data
      if (res.status !== 409) throw new Error(`could not book ${date} ${time}: ${res.status} ${JSON.stringify(res.data)}`)
      // The doctor is busy at this time (a leftover of an interrupted run): another chair will not help.
      if (String(res.data.detail).includes(`${DOCTOR} already has`)) break
    }
  }
  throw new Error(`no free spare slot for ${DOCTOR} on ${date}`)
}

/* ------------------------------------------------------------------ steps */

await run.step('First launch: permissions (what each is used for), onboarding, the disclaimer, then login; later launches open on login', async () => {
  await t('welcome-permissions').waitFor({ timeout: 90000 })
  for (const key of ['location', 'camera', 'photos', 'notifications', 'calendar', 'microphone']) await t(`permission-${key}`).waitFor()
  await t('welcome-continue').click()
  await t('welcome-onboarding').waitFor()
  await t('welcome-login').click()
  await t('welcome-disclaimer').waitFor()
  await page.getByText('This app is not intended to supplement', { exact: false }).waitFor()
  await t('welcome-agree').click()
  await t('login-email').waitFor({ timeout: 15000 })
  await page.reload({ waitUntil: 'networkidle' })
  await t('login-email').waitFor({ timeout: 60000 })
  if (await t('welcome-permissions').count()) throw new Error('the first-launch screens came back after agreeing')
})

const applicant = { email: `consultant.${STAMP}@e2e.test`, password: 'Consult#2026x', name: `Dr. E2E Ortho ${STAMP}`, id: '' }
const OWNER = { email: 'owner@dentor.in', password: 'Owner@2026' }
let ownerToken = ''
const clinicApi = async (method, path, body) => {
  if (!ownerToken) ownerToken = await staffToken(OWNER.email, OWNER.password, 'owner')
  const res = await apiCall(method, `/api/clinic-app${path}`, body, ownerToken)
  if (res.status >= 400) throw new Error(`${method} ${path} answered ${res.status}: ${JSON.stringify(res.data)}`)
  return res.data
}
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** A day `from` days ahead or later that is not a Sunday (the default hours are Monday to Saturday). */
const workday = (from) => { for (let i = from; ; i += 1) { const d = addDays(localToday(), i); if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) return d } }

await run.step('sign-up: a consultant applies (code, KYC, academic, address, finish), is approved into a clinic and signs in', async () => {
  await t('login-email').waitFor({ timeout: 90000 })
  await t('login-signup').click()
  await t('signup-email').fill(applicant.email)
  await t('signup-send').click()
  await t('dev-code').waitFor({ timeout: 15000 })
  await t('code-input').fill(/(\d{4})/.exec(await textOf('dev-code'))[1])
  await t('signup-verify').click()
  await t('signup-kyc').waitFor()
  expect((await t('signup-clinic_name').count()) === 0, 'a consultant is asked for a clinic name')
  await t('signup-name').fill(`Dr. E2E Ortho ${STAMP}`)
  await t('signup-mobile').fill('9845033344')
  await t('signup-next').click()
  await t('signup-institution').fill('Manipal College of Dental Sciences')
  await t('signup-graduation_year').fill('2012')
  await t('signup-dci_number').fill(`DCI-${STAMP}`)
  await t('signup-specialisation').fill('Orthodontics')
  await t('signup-next').click()
  await t('signup-area').fill('Jayanagar')
  await t('signup-pincode').fill('560041')
  await t('signup-city').fill('Bengaluru')
  await t('signup-state').fill('Karnataka')
  await t('signup-next').click()
  await t('signup-password').fill(applicant.password)
  await t('signup-confirm').fill(applicant.password)
  await t('signup-agree').click()
  await t('signup-submit').click()
  await t('signup-ok').click()
  await t('login-email').waitFor()
  const superToken = await staffToken('superadmin@dentor.in', 'SuperAdmin@2026')
  const pending = (await apiCall('GET', '/api/platform/applications?status=Pending', undefined, superToken)).data.items || []
  const mine = pending.find((a) => a.email === applicant.email)
  expect(mine && mine.kind === 'consultant' && mine.profile.specialisation === 'Orthodontics', 'the application did not reach the platform console')
  const clinics = (await apiCall('GET', '/api/platform/clinics?q=CLN-0001', undefined, superToken)).data.items || []
  const clinic = clinics[0] ?? (await apiCall('GET', '/api/platform/clinics', undefined, superToken)).data.items[0]
  const approved = await apiCall('POST', `/api/platform/applications/${mine.id}/approve`, { clinic_id: clinic.id }, superToken)
  expect(approved.status === 200, `approval answered ${approved.status}: ${JSON.stringify(approved.data)}`)
  await t('login-email').fill(applicant.email)
  await t('login-password').fill(applicant.password)
  await t('login-submit').click()
  await t('screen-today').waitFor({ timeout: 30000 })
  await expectText('screen-today', `Dr. E2E Ortho ${STAMP}`)
  await t('tab-profile').click()
  await t('open-settings').click()
  await t('setting-biometric').waitFor()
  await back()
  const found = (await clinicApi('GET', '/consult/consultants')).items.find((c) => c.name === applicant.name)
  expect(found, 'the approved consultant is not offered to the clinic')
  applicant.id = found.id
})

await run.step('availability: hours for one day are saved and become the slots a clinic can book', async () => {
  await t('open-availability').click()
  await t('availability-screen').waitFor()
  await t('segment-custom').click()
  const day = workday(3)
  await t(`custom-${day}`).click()
  await t('custom-from').fill('10:00')
  await t('custom-to').fill('12:00')
  await t('custom-add').click()
  await t('availability-save').click()
  await page.getByText('Confirm that your hours are accurate', { exact: false }).filter({ visible: true }).first().waitFor()
  await t('availability-agree').click()
  await t('availability-save').click()
  await t('availability-ok').click()
  const { slots } = await clinicApi('GET', `/consult/consultants/${applicant.id}/slots?date=${day}`)
  expect(slots.map((x) => x.time).join(',') === '10:00,10:30,11:00,11:30', `the clinic sees ${slots.map((x) => x.time)}`)
})

let consultReq = null
await run.step('a clinic request is accepted, tracked, started with the clinic\'s code and completed with a next sitting', async () => {
  const day = workday(3)
  const patient = (await clinicApi('GET', '/patients?q=DEN-1001')).items[0]
  consultReq = await clinicApi('POST', '/consult/requests', { patient_id: patient.id, choice: 'own', consultant_id: applicant.id, date: day, time: '10:00',
    treatment: 'Fixed Braces', diagnosis: 'Crowding', teeth: ['11', '21'], quadrants: ['1'], history: ['Diabetes'], bp: '120/80', declaration: true })
  await t('tab-index').click()
  await t('pending-requests').click()
  await t('requests-screen').waitFor()
  await t(`request-${consultReq.id}`).click()
  await t('request-screen').waitFor()
  await expectText('request-screen', 'Fixed Braces')
  expect((await clinicApi('GET', `/consult/requests/${consultReq.id}`)).status === 'Viewed', 'opening it did not mark it viewed for the clinic')
  await t('request-accept').click()
  await t('request-done-ok').click()
  const confirmed = await clinicApi('GET', `/consult/requests/${consultReq.id}`)
  expect(confirmed.status === 'Confirmed' && confirmed.start_code?.length === 4, `the clinic sees ${confirmed.status}`)
  await t('track-on-the-way').click()
  await page.waitForTimeout(600)
  await t('track-arrived').click()
  await page.waitForTimeout(600)
  expect((await clinicApi('GET', `/consult/requests/${consultReq.id}`)).status === 'Arrived', 'the clinic does not see Arrived')
  await t('request-start').click()
  await t('start-code-input').fill(confirmed.start_code === '0000' ? '1111' : '0000')
  await t('start-confirm').click()
  await page.getByText("That is not the clinic's code", { exact: false }).filter({ visible: true }).first().waitFor()
  await t('start-code-input').fill(confirmed.start_code)
  await t('start-confirm').click()
  await t('request-complete').waitFor()
  await t('request-complete').click()
  await t('complete-confirm').click()
  await page.getByText('Say what treatment was provided.').filter({ visible: true }).first().waitFor()
  await t('complete-provided').fill('Brackets bonded, upper arch')
  await t('next-yes').click()
  const next = workday(10)
  await t(`pick-date-${next}`).click()
  await t('pick-slot-10:00').click()
  await t('complete-confirm').click()
  await t('request-done-ok').click()
  const done = await clinicApi('GET', `/consult/requests/${consultReq.id}`)
  expect(done.status === 'Completed' && done.next_visit?.date === next, `after completing: ${done.status} ${JSON.stringify(done.next_visit)}`)
  await clinicApi('POST', `/consult/requests/${done.next_visit.id}/cancel`, { reason: 'E2E clean-up' })
})

await run.step('earnings: the completed clinic visit is in the earnings history under Completed', async () => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await t('tab-earnings').click()
  await t('visits-completed').click()
  const done = await clinicApi('GET', `/consult/requests/${consultReq.id}`)
  await t(`visit-${done.code}`).waitFor({ timeout: 15000 })
  await t('visits-cancelled').click()
  await t(`visit-${done.code}`).waitFor({ state: 'detached', timeout: 15000 }).catch(() => undefined)
  expect((await t(`visit-${done.code}`).count()) === 0, 'a completed visit is listed as cancelled')
})

await run.step('rating: the consultant rates the clinic once after the completed visit', async () => {
  await page.goto(`${APP_URL}/requests/${consultReq.id}`, { waitUntil: 'networkidle' })
  await t('rate-clinic').click()
  await t('star-5').click()
  await t('rate-text').fill('Patient was well prepared')
  await t('rate-submit').click()
  await t('rate-sheet').waitFor({ state: 'hidden' })
  const owner = ownerToken || (ownerToken = await staffToken(OWNER.email, OWNER.password, 'owner'))
  const clinicReviews = (await apiCall('GET', '/api/engage/reviews/mine', undefined, owner)).data.items
  expect(clinicReviews.some((x) => x.text === 'Patient was well prepared' && x.rating === 5), 'the clinic does not see the rating')
  await page.reload({ waitUntil: 'networkidle' })
  expect((await t('rate-clinic').count()) === 0, 'the clinic can be rated twice')
})

await run.step('chat: a message from the clinic is answered in the app', async () => {
  const owner = ownerToken || (ownerToken = await staffToken(OWNER.email, OWNER.password, 'owner'))
  const started = await apiCall('POST', '/api/engage/chats', { consultant_id: applicant.id, subject: `Case ${STAMP}`, text: 'Can you see the patient at 10?' }, owner)
  expect(started.status === 201, `the clinic could not start a chat: ${started.status}`)
  await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
  await t(`chat-${started.data.id}`).click()
  await page.getByText('Can you see the patient at 10?').filter({ visible: true }).first().waitFor()
  await t('chat-input').fill('Yes, I will be there by 9:45.')
  const sent = page.waitForResponse((r) => r.url().includes(`/api/engage/chats/${started.data.id}/messages`) && r.request().method() === 'POST')
  await t('chat-send').click()
  const answer = await sent
  expect(answer.status() === 201, `sending answered ${answer.status()}: ${await answer.text()}`)
  await page.getByTestId('message-1').filter({ hasText: 'Yes, I will be there by 9:45.' }).waitFor()
  const thread = (await apiCall('GET', `/api/engage/chats/${started.data.id}`, undefined, owner)).data
  expect(thread.messages.at(-1).from === 'consultant', `the clinic sees ${JSON.stringify(thread.messages.at(-1))}`)
})

await run.step('inventory: an item is added and used against a case', async () => {
  await page.goto(`${APP_URL}/inventory`, { waitUntil: 'networkidle' })
  await t('inventory-add').click()
  await t('inventory-name').fill(`Protaper Gold ${STAMP}`)
  await t('inventory-stock').fill('4')
  await t('inventory-save').click()
  await t('inventory-sheet').waitFor({ state: 'hidden' })
  await t(`stock-Protaper Gold ${STAMP}`).click()
  await t('adjust--2').click()
  await t('adjust-case').fill('CNS-E2E')
  await t('adjust-save').click()
  await t('adjust-sheet').waitFor({ state: 'hidden' })
  await expectText(`stock-Protaper Gold ${STAMP}`, '2 pcs')
  await t('segment-usage').click()
  await page.getByText('Case CNS-E2E', { exact: false }).filter({ visible: true }).first().waitFor()
})

await run.step('offering other times: the clinic sees them and confirms one', async () => {
  const day = workday(3)
  const patient = (await clinicApi('GET', '/patients?q=DEN-1001')).items[0]
  const req = await clinicApi('POST', '/consult/requests', { patient_id: patient.id, choice: 'own', consultant_id: applicant.id, date: day, time: '10:30', treatment: 'Clear Aligners', declaration: true })
  await page.goto(`${APP_URL}/requests/${req.id}`, { waitUntil: 'networkidle' })
  await t('request-propose').click()
  await t(`pick-date-${day}`).click()
  await t('pick-slot-11:30').click()
  await t('propose-add').click()
  await t('propose-note').fill('Busy at 10:30')
  await t('propose-send').click()
  await t('propose-sheet').waitFor({ state: 'hidden' })
  const proposed = await clinicApi('GET', `/consult/requests/${req.id}`)
  expect(proposed.status === 'Proposed' && proposed.proposals[0]?.time === '11:30', `the clinic sees ${proposed.status}`)
  const chosen = await clinicApi('POST', `/consult/requests/${req.id}/accept-proposal`, { index: 0 })
  expect(chosen.status === 'Confirmed' && chosen.time === '11:30', 'the offered time was not confirmed')
  await clinicApi('POST', `/consult/requests/${req.id}/cancel`, { reason: 'E2E clean-up' })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await t('tab-profile').click()
  await t('sign-out').click()
  await t('confirm-yes').click()
  await t('login-email').waitFor({ timeout: 15000 })
})

await run.step('front-desk login is refused with the API explanation', async () => {
  await t('login-email').fill(FRONT_DESK.email)
  await t('login-password').fill(FRONT_DESK.password)
  await t('login-submit').click()
  await page.getByText('This login is not a consultant account.').waitFor({ timeout: 15000 })
  expect((await t('login-submit').count()) === 1, 'left the login screen')
})

await run.step('wrong password shows the error', async () => {
  await t('login-email').fill(CONSULTANT.email)
  await t('login-password').fill('not-the-password')
  await t('login-submit').click()
  await page.getByText('Incorrect email or password.').waitFor({ timeout: 15000 })
})

await run.step('sign in as Dr. Kumar', async () => {
  await t('login-email').fill(CONSULTANT.email)
  await t('login-password').fill(CONSULTANT.password)
  await t('login-submit').click()
  await t('screen-today').waitFor({ timeout: 30000 })
  await expectText('screen-today', DOCTOR)
  await t('stat-total').waitFor()
})

await run.step('API access for setup and comparison', async () => {
  desk = await staffToken(FRONT_DESK.email, FRONT_DESK.password)
  doctor = await staffToken(CONSULTANT.email, CONSULTANT.password, 'consultant')
  const dash = await apiCall('GET', '/api/consultant/dashboard', undefined, doctor)
  expect(dash.status === 200, `dashboard → ${dash.status}`)
  today = dash.data.date
  const mine = await apiCall('GET', '/api/consultant/patients', undefined, doctor)
  for (const p of mine.data.items) patients[p.code] = p.id
  for (const code of ['DEN-1001', 'DEN-1003', 'DEN-1006']) expect(patients[code], `demo patient ${code} is not one of ${DOCTOR}'s patients`)
})

await run.step('Today lists only his appointments', async () => {
  await openTab('schedule')
  await openTab('index') // coming back to Today reloads it
  let all = (await deskGet(`/api/appointments?date=${today}&limit=2000`)).items
  if (!all.some((a) => a.doctor !== DOCTOR)) {
    // The demo appointments are dated from the day the database was seeded: give another doctor one today.
    for (const time of SPARE_TIMES) {
      const res = await apiCall('POST', '/api/appointments', { patientId: patients['DEN-1003'], patient: 'Anjali Devi', patientCode: 'DEN-1003', date: today, time,
        treatment: `E2E other doctor ${STAMP}`, doctor: 'Dr. Anitha', chair: 'Chair 03', duration: '30 min', status: 'Scheduled', notes: '' }, desk)
      if (res.status === 201) { created.otherDoctorAppt = res.data.id; break }
    }
    await openTab('schedule')
    await openTab('index')
    all = (await deskGet(`/api/appointments?date=${today}&limit=2000`)).items
  }
  const his = all.filter((a) => a.doctor === DOCTOR)
  expect(all.some((a) => a.doctor !== DOCTOR), 'the clinic has no appointment with another doctor today, so this check proves nothing')
  const shown = await rowIds('appt-')
  for (const id of shown) {
    const match = all.find((a) => a.id === id)
    expect(match, `row ${id} is not a clinic appointment for ${today}`)
    expect(match.doctor === DOCTOR, `row ${id} belongs to ${match.doctor}`)
  }
  expect(shown.length === his.length, `Today shows ${shown.length} rows, the clinic has ${his.length} for ${DOCTOR}`)
  expect(Number(await textOf('stat-total-value')) === his.length, 'the Total counter does not match the list')
})

await run.step('a new appointment appears on Today', async () => {
  created.todayAppt = await bookWithDoctor(today, 'DEN-1003', 'Anjali Devi', `E2E review ${STAMP}`)
  await openTab('schedule')
  await openTab('index')
  await expectText(`appt-${created.todayAppt.id}-patient`, 'Anjali Devi')
  await expectText(`appt-${created.todayAppt.id}-status`, 'Scheduled')
})

await run.step('check in from Today', async () => {
  const id = created.todayAppt.id
  await t(`appt-${id}-waiting`).click()
  await expectText(`appt-${id}-status`, 'Waiting')
  await t('toast-success').waitFor()
  expect((await deskGet(`/api/appointments/${id}`)).status === 'Waiting', 'the clinic does not see the patient as waiting')
  expect((await t(`appt-${id}-waiting`).count()) === 0, 'Check in is still offered for a waiting patient')
})

await run.step('complete with visit notes from the appointment', async () => {
  const id = created.todayAppt.id
  await t(`appt-${id}-open`).click()
  await t('screen-appointment').waitFor()
  await expectText('appointment-treatment', `E2E review ${STAMP}`)
  await expectText('appointment-patient-name', 'Anjali Devi')
  expect((await t('allergy-banner').count()) === 0, 'an allergy banner is shown for a patient without an allergy')
  await t('visit-notes').fill(`Reviewed, healing well (${STAMP}).`)
  await t('appointment-completed').click()
  await expectText('appointment-status', 'Completed')
  const saved = await deskGet(`/api/appointments/${id}`)
  expect(saved.status === 'Completed', `the clinic sees status ${saved.status}`)
  expect(saved.notes === `Reviewed, healing well (${STAMP}).`, `notes saved as "${saved.notes}"`)
  expect((await t('appointment-completed').count()) === 0 && (await t('appointment-cancelled').count()) === 0, 'status actions remain after completion')
  await back()
  await expectText(`appt-${id}-status`, 'Completed')
})

await run.step('Schedule shows another day', async () => {
  const date = addDays(today, 2)
  created.laterAppt = await bookWithDoctor(date, 'DEN-1006', 'Joseph Antony', `E2E consult ${STAMP}`)
  await openTab('schedule')
  for (let i = 0; i < 3 && (await t(`day-${date}`).count()) === 0; i += 1) await t('week-next').click()
  await t(`day-${date}`).click()
  await expectText(`day-appt-${created.laterAppt.id}-patient`, 'Joseph Antony')
  const his = (await deskGet(`/api/appointments?date=${date}&limit=2000`)).items.filter((a) => a.doctor === DOCTOR)
  const shown = await rowIds('day-appt-')
  expect(shown.length === his.length, `Schedule shows ${shown.length} rows for ${date}, the clinic has ${his.length}`)
  expect((await t('bookings-empty').count()) + (await t('bookings-list').count()) === 1, 'the referral bookings section did not load')
})

await run.step('cancel asks first, then cancels', async () => {
  const id = created.laterAppt.id
  await t(`day-appt-${id}-open`).click()
  await t('screen-appointment').waitFor()
  await t('appointment-cancelled').click()
  await t('confirm-sheet').waitFor()
  await t('confirm-no').click()
  expect((await deskGet(`/api/appointments/${id}`)).status === 'Scheduled', 'declining the confirmation still changed the appointment')
  await t('appointment-cancelled').click()
  await t('confirm-yes').click()
  await expectText('appointment-status', 'Cancelled')
  expect((await deskGet(`/api/appointments/${id}`)).status === 'Cancelled', 'the clinic does not see the cancellation')
  await back()
  await expectText(`day-appt-${id}-status`, 'Cancelled')
  await t('week-today').click()
  await t(`day-appt-${created.todayAppt.id}`).waitFor()
})

await run.step('Patients search finds Ravi Kumar', async () => {
  await openTab('patients')
  await t('patient-list').waitFor()
  expect((await t('patient-DEN-1003').count()) === 1, 'the unfiltered list does not include DEN-1003')
  await t('patient-search').fill('Ravi')
  await t('patient-DEN-1001').waitFor()
  await page.waitForFunction(() => !document.querySelector('[data-testid="patient-DEN-1003"]'), null, { timeout: 10000 })
  await expectText('patient-DEN-1001', 'Ravi Kumar')
  await t('patient-DEN-1001-allergy').waitFor()
})

await run.step('patient detail shows the allergy banner', async () => {
  await t('patient-DEN-1001').click()
  await t('screen-patient').waitFor()
  await expectText('patient-name', 'Ravi Kumar')
  await expectText('allergy-banner', 'Penicillin')
  await expectText('patient-history', 'Diabetes')
  for (const [segment, proof] of [['treatments', 'treatment-list'], ['prescriptions', 'patient-rx-list'], ['files', 'file-list'], ['chart', 'tooth-46']]) {
    await t(`segment-${segment}`).click()
    await t(proof).waitFor()
  }
  const teeth = (await idsAfter('tooth-', '\\d\\d')).join(' ')
  const fdi = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].join(' ')
  expect(teeth === fdi, `the chart shows teeth in the order ${teeth}`)
  await t('tooth-46').click()
  await expectText('tooth-note', 'Root Canal')
  await t('tooth-11').click()
  await expectText('tooth-note', 'Healthy')
})

await run.step('an image file opens in the app', async () => {
  await t('segment-files').click()
  await t('file-list').locator('[role="button"]').first().click()
  await t('screen-file').waitFor()
  await t('file-image').waitFor()
  await back()
  await t('screen-patient').waitFor()
})

let prescription = null
await run.step('write a prescription', async () => {
  const diagnosis = `E2E pulpitis ${STAMP}`
  await t('write-prescription').click()
  await t('screen-prescribe').waitFor()
  await expectText('allergy-banner', 'Penicillin')

  // Nothing filled in: the form says what to fix and does not move on.
  await t('rx-review').click()
  await page.getByText('Enter the diagnosis.').first().waitFor()
  await page.getByText('Enter the medicine name, or remove this row.').first().waitFor()
  expect((await t('rx-issue').count()) === 0, 'an empty prescription reached the review step')

  await t('rx-diagnosis-input').fill(diagnosis)
  await t('rx-complaint').fill('Pain on biting')
  await t('med-0-drug').fill('zero')
  await t('med-0-drug-suggestion-0').click()
  expect((await t('med-0-drug').inputValue()) === 'Zerodol SP', 'picking a suggestion did not fill the medicine')
  await t('med-0-dose').fill('1 tablet')
  await t('med-0-freq-bd').click()
  await t('med-0-days').fill('3')
  await t('rx-add-medicine').click()
  await t('med-1-drug').fill('Chlorhexidine Mouthwash')
  await t('med-1-dose').fill('10 ml')
  await t('med-1-instruction-as-directed').click()
  await t('rx-add-medicine').click()
  await t('med-2-drug').waitFor()
  await t('med-2-remove').click()
  expect((await t('med-2-drug').count()) === 0, 'the third medicine row was not removed')
  await t('rx-advice').fill('Soft diet for two days.')
  await t('rx-followup-1-week').click()
  await expectText('rx-followup-date-value', /\d{2} \w{3} \d{4}/)
  await t('rx-followup-date-clear').click()
  await expectText('rx-followup-date-value', 'No follow-up')
  await t('rx-followup-2-weeks').click()

  await t('rx-review').click()
  await t('rx-issue').waitFor()
  await expectText('rx-diagnosis', diagnosis)
  await expectText('rx-med-0', 'Zerodol SP')
  await expectText('rx-med-1', 'Chlorhexidine Mouthwash')
  await t('rx-issue').click()

  await t('screen-prescription').waitFor({ timeout: 20000 })
  await expectText('rx-diagnosis', diagnosis)
  await expectText('rx-doctor', DOCTOR)
  await expectText('rx-patient', 'Ravi Kumar')

  const found = (await deskGet('/api/prescriptions?patientCode=DEN-1001&limit=2000')).items.filter((p) => p.diagnosis === diagnosis)
  expect(found.length === 1, `the clinic has ${found.length} prescriptions with this diagnosis for DEN-1001`)
  prescription = found[0]
  expect(prescription.doctor === DOCTOR, `prescribed by ${prescription.doctor}`)
  expect(prescription.meds.length === 2 && prescription.meds[0].drug === 'Zerodol SP' && prescription.meds[0].freq === 'BD' && prescription.meds[0].days === '3', `medicines saved as ${JSON.stringify(prescription.meds)}`)
  expect(prescription.meds[1].instruction === 'As directed', 'the instruction chip was not saved')
  expect(prescription.followUp === addDays(today, 14), `follow-up saved as ${prescription.followUp}`)

  // Back from the new prescription returns to the patient, whose record now lists it.
  await back()
  await t('screen-patient').waitFor()
  await t('segment-prescriptions').click()
  await t(`rx-${prescription.id}`).waitFor()
})

await run.step('consent rule is shown as the API states it', async () => {
  await openTab('patients')
  await t('patient-search').fill('DEN-1006')
  await t('patient-DEN-1006').click()
  await t('screen-patient').waitFor()
  await expectText('patient-name', 'Joseph Antony')
  expect((await t('allergy-banner').count()) === 0, 'an allergy banner is shown for a patient without an allergy')
  await t('add-treatment').click()
  await t('screen-treatment').waitFor()
  await t('treatment-submit').click()
  await page.getByText('Enter the treatment name.').first().waitFor()
  await t('treatment-name').fill('Simple Extraction')
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/consultant/patients/${patients['DEN-1006']}/treatments`)),
    t('treatment-submit').click(),
  ])
  const answer = await response.json()
  if (response.status() === 400) {
    // DEN-1006 has no signed consent and the clinic requires one: the app repeats the API's words.
    expect(/consent/i.test(answer.detail), `unexpected refusal: ${answer.detail}`)
    await expectText('treatment-error', answer.detail)
    const records = (await deskGet('/api/patient_treatments?patientId=DEN-1006&limit=2000')).items
    expect(!records.some((r) => r.name === 'Simple Extraction' && r.doctor === DOCTOR), 'a treatment was saved despite the consent rule')
  } else {
    // The clinic has switched the rule off, or recorded a consent since: the treatment is simply added.
    expect(response.status() === 201, `treatments → ${response.status()} ${JSON.stringify(answer)}`)
    created.treatmentIds.push(answer.id)
    await t('screen-patient').waitFor()
  }
})

await run.step('add a treatment', async () => {
  const notes = `E2E treatment ${STAMP}`
  await openTab('patients')
  await t('patient-search').fill('Anjali')
  await t('patient-DEN-1003').click()
  await t('screen-patient').waitFor()
  await t('add-treatment').click()
  await t('screen-treatment').waitFor()
  await t('treatment-name').fill('scal')
  await t('treatment-name-suggestion-0').click()
  expect((await t('treatment-name').inputValue()) === 'Scaling & Polishing', 'picking a suggestion did not fill the treatment')
  expect((await t('treatment-cost').inputValue()) === '1500', 'the list price was not filled in')
  await t('treatment-tooth').fill('Full mouth')
  await t('treatment-status-in-progress').click()
  await t('treatment-notes').fill(notes)
  await t('treatment-submit').click()
  await t('screen-patient').waitFor({ timeout: 20000 })
  await t('toast-success').waitFor()

  const saved = (await deskGet('/api/patient_treatments?patientId=DEN-1003&limit=2000')).items.filter((r) => r.notes === notes)
  expect(saved.length === 1, `the clinic has ${saved.length} treatments with these notes`)
  created.treatmentIds.push(saved[0].id)
  expect(saved[0].doctor === DOCTOR && saved[0].status === 'In Progress' && Number(saved[0].cost) === 1500 && saved[0].tooth === 'Full mouth', `saved as ${JSON.stringify(saved[0])}`)
  await t('segment-treatments').click()
  await expectText(`treatment-${saved[0].id}`, notes)
})

await run.step('Earnings shows billed for Last 30 days', async () => {
  await openTab('earnings')
  await t('period-last-30').click()
  await settle()
  await t('earn-billed-value').waitFor()
  const api = await apiCall('GET', `/api/consultant/earnings?date_from=${addDays(today, -29)}&date_to=${today}`, undefined, doctor)
  const billed = rupees(await textOf('earn-billed-value'))
  expect(billed > 0, `billed shows ${billed}`)
  expect(billed === Math.round(api.data.billed), `billed shows ${billed}, the API says ${api.data.billed}`)
  expect(rupees(await textOf('earn-collected-value')) === Math.round(api.data.collected), 'collected does not match the API')
  expect(rupees(await textOf('earn-outstanding-value')) === Math.round(api.data.outstanding), 'outstanding does not match the API')
  expect(Number(await textOf('earn-visits-value')) === api.data.completed_visits, 'completed visits do not match the API')
  expect((await rowIds('invoice-')).length === api.data.items.length, 'the invoice list does not match the API')
  await t('by-treatment').waitFor()
  await t('period-last-month').click()
  await settle()
  await t('earn-billed-value').waitFor()
})

await run.step('a failed request shows the error state and recovers', async () => {
  const earnings = '**/api/consultant/earnings**'
  await page.route(earnings, (route) => route.abort())
  await t('period-last-7').click()
  await expectText('error', 'Cannot reach the clinic server', 20000)
  expect((await t('earn-billed-value').count()) === 0, 'figures are shown although the request failed')
  await page.unroute(earnings)
  await t('error').locator('[role="button"]').click()
  await t('earn-billed-value').waitFor()
})

await run.step('edit availability', async () => {
  const before = await apiCall('GET', '/api/consultant/me', undefined, doctor)
  created.availability = before.data.profile.availability
  const next = `Mon–Fri · 10 AM–4 PM (${STAMP})`
  await openTab('profile')
  await expectText('profile-name', DOCTOR)
  await expectText('profile-clinic', before.data.clinic.name)
  await expectText('profile-specialty', before.data.profile.specialty)
  await t('edit-profile').click()
  await t('screen-edit-profile').waitFor()
  await t('profile-availability-input').fill(next)
  await t('profile-phone-input').fill('12')
  await t('profile-save').click()
  await page.getByText('Enter a phone number with at least 7 digits.', { exact: false }).first().waitFor()
  await t('profile-phone-input').fill(before.data.profile.phone || '')
  await t('profile-save').click()
  await t('screen-profile').waitFor()
  await expectText('profile-availability', next)
  const after = await apiCall('GET', '/api/consultant/me', undefined, doctor)
  expect(after.data.profile.availability === next, `the API has "${after.data.profile.availability}"`)
})

await run.step('notifications open and lead to the appointment', async () => {
  await openTab('index')
  await t('open-notifications').click()
  const mine = t('notification').filter({ hasText: `E2E consult ${STAMP}` }).first()
  await mine.waitFor({ timeout: 15000 })
  await mine.click()
  await t('screen-appointment').waitFor()
  await expectText('appointment-treatment', `E2E consult ${STAMP}`)
  await back()
  await back()
  await t('screen-today').waitFor()
})

await run.step('my prescriptions and change password open', async () => {
  await openTab('profile')
  await t('open-prescriptions').click()
  await t('screen-prescriptions').waitFor()
  expect(prescription, 'no prescription was written earlier in this run')
  await expectText(`rx-${prescription.id}`, 'Ravi Kumar')
  await t(`rx-${prescription.id}`).click()
  await expectText('rx-diagnosis', prescription.diagnosis)
  await back()
  await back()
  await t('open-settings').click()
  await t('settings-change-password').click()
  await t('change-password-submit').click()
  await page.getByText('Enter your current password.').waitFor()
  await back()
  await t('settings-screen').waitFor()
  await back()
  await t('screen-profile').waitFor()
})

await run.step('no overflow at any phone or tablet width', async () => {
  const check = async (label) => {
    await page.waitForTimeout(250)
    await assertNoOverflow(page, label)
  }
  for (const viewport of VIEWPORTS) {
    const at = (name) => `${name} @${viewport.width}`
    await page.setViewportSize(viewport)
    await openTab('index')
    await check(at('today'))
    await t(`appt-${created.todayAppt.id}-open`).click()
    await t('appointment-patient').waitFor()
    await check(at('appointment'))
    await openTab('schedule')
    await check(at('schedule'))
    await openTab('patients')
    await t('patient-search').fill('')
    await t('patient-DEN-1001').waitFor()
    await check(at('patients'))
    await t('patient-DEN-1001').click()
    await t('patient-header').waitFor()
    for (const segment of ['overview', 'treatments', 'prescriptions', 'files', 'chart']) {
      await t(`segment-${segment}`).click()
      await check(at(`patient ${segment}`))
    }
    await t('write-prescription').click()
    await t('rx-diagnosis-input').waitFor()
    await t('rx-review').click() // with every field message showing
    await check(at('prescribe'))
    await back()
    await t('add-treatment').click()
    await t('treatment-name').waitFor()
    await t('treatment-submit').click()
    await check(at('treatment'))
    await openTab('earnings')
    await t('earn-billed').waitFor()
    await check(at('earnings'))
    await openTab('profile')
    await t('profile-card').waitFor()
    await check(at('profile'))
    await t('edit-profile').click()
    await t('profile-save').waitFor()
    await check(at('edit profile'))
    await back()
    await t('open-prescriptions').click()
    await t('prescription-list').waitFor()
    await check(at('my prescriptions'))
    await t(`rx-${prescription.id}`).click()
    await t('rx-header').waitFor()
    await check(at('prescription'))
    await back()
    await back()
    await t('open-notifications-row').click()
    await t('notification').first().waitFor()
    await check(at('notifications'))
  }
  await page.setViewportSize({ width: 390, height: 844 })
})

await run.step('sign out returns to login', async () => {
  await openTab('profile')
  await t('sign-out').click()
  await t('confirm-sheet').waitFor()
  await t('confirm-no').click()
  await t('screen-profile').waitFor()
  await t('sign-out').click()
  await t('confirm-yes').click()
  await t('login-submit').waitFor({ timeout: 15000 })
  // The session is gone, not just hidden: opening the app again still asks to sign in.
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await t('login-submit').waitFor({ timeout: 30000 })
})

await run.step('put the demo data back', async () => {
  if (created.otherDoctorAppt) await apiCall('PATCH', `/api/appointments/${created.otherDoctorAppt}`, { status: 'Cancelled' }, desk)
  if (created.availability !== null) {
    const res = await apiCall('PATCH', '/api/consultant/me', { availability: created.availability }, doctor)
    expect(res.status === 200 && res.data.availability === created.availability, `could not restore availability: ${res.status}`)
  }
  for (const id of [...new Set(created.treatmentIds)]) {
    const res = await apiCall('DELETE', `/api/patient_treatments/${id}`, undefined, desk)
    expect(res.status === 200, `could not remove test treatment ${id}: ${res.status}`)
  }
})

await browser.close()
process.exit(run.finish(errors))

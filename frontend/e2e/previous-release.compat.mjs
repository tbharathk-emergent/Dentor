// Rolling-upgrade check: the PREVIOUS release of the web app, driven against the NEW backend.
//
// The backend is deployed before the web app, so for a while the web app people already have
// open (and the one still being served) talks to the new API. This proves that works.
//
//   # 1. build the previous release of the web app into a scratch folder, with a local API
//   git worktree add /tmp/dentor-prev <previous release commit>
//   cd /tmp/dentor-prev/frontend && npm ci
//   VITE_API_BASE_URL= npx vite build --outDir /tmp/dentor-prev-dist --emptyOutDir
//   npx vite preview --outDir /tmp/dentor-prev-dist --port 5174 --strictPort
//   # 2. run the new backend on :8000 with a development database, then, from this folder:
//   node e2e/previous-release.compat.mjs
//
// It signs in as the demo Administrator, Super Admin and a Receptionist it creates (and
// deactivates again), opens every sidebar page, saves a setting the old way and puts it back.
// Like the other suites it refuses any address that is not on this machine.
import { chromium } from 'playwright'
import { unsafeTarget } from './helpers.mjs'

const APP = (process.env.APP_URL || 'http://localhost:5174').replace(/\/+$/, '')
const API = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
for (const url of [APP, API]) {
  if (unsafeTarget(url)) {
    console.error(unsafeTarget(url))
    process.exit(2)
  }
}
const ROUTES = ['/', '/patients', '/appointments', '/book-consultant', '/accounts', '/schedule-notes', '/consultants', '/clinical', '/frs',
  '/prescriptions', '/certificates', '/pharmacy', '/lab', '/inventory', '/staff', '/reports', '/reviews', '/omni', '/leads', '/masters', '/settings']
const api = async (method, path, body, token) => {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}
const browser = await chromium.launch()
let failed = 0, count = 0
const step = async (name, fn) => { count++; try { const note = await fn(); console.log(`✔ ${name}${note ? ' — ' + note : ''}`) } catch (e) { failed++; console.log(`✘ ${name} — ${String(e).split('\n')[0].slice(0, 300)}`) } }
async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  context.setDefaultTimeout(15000)
  const page = await context.newPage()
  const bad = [], errors = []
  page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 400) bad.push(`${r.request().method()} ${u.pathname} → ${r.status()}`) })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)) })
  const signIn = async (email, password) => {
    await page.goto(APP + '/login', { waitUntil: 'networkidle' })
    await page.getByPlaceholder('you@clinic.in').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /Login to Dashboard/ }).click()
  }
  return { context, page, bad, errors, signIn }
}

// ---- Administrator in the old web app
const a = await session()
await step('old web app: an Administrator signs in against the new API', async () => {
  await a.signIn('admin@dentor.in', 'Dentor@2026')
  await a.page.waitForURL(APP + '/')
  if (!(await a.page.evaluate(() => localStorage.getItem('dentor.token')))) throw new Error('no session stored')
})
await step(`old web app: all ${ROUTES.length} sidebar pages load their data without a failed API call or console error`, async () => {
  const problems = []
  for (const route of ROUTES) {
    const before = a.bad.length, beforeErr = a.errors.length
    await a.page.goto(APP + route, { waitUntil: 'networkidle' })
    await a.page.waitForTimeout(250)
    if (new URL(a.page.url()).pathname !== route) problems.push(`${route} redirected to ${new URL(a.page.url()).pathname}`)
    if (a.bad.length > before) problems.push(`${route}: ${a.bad.slice(before).join(', ')}`)
    if (a.errors.length > beforeErr) problems.push(`${route}: console ${a.errors.slice(beforeErr).join(' | ')}`)
    if ((await a.page.locator('main').innerText()).trim().length < 20) problems.push(`${route}: empty page`)
  }
  if (problems.length) throw new Error(problems.join(' ‖ '))
})
await step('old web app: the Administrator saves a setting the old way (PUT of the whole map) and it is stored', async () => {
  const token = await a.page.evaluate(() => localStorage.getItem('dentor.token'))
  const before = (await api('GET', '/api/settings', undefined, token)).data
  await a.page.goto(APP + '/settings', { waitUntil: 'networkidle' })
  const toggle = a.page.getByRole('switch').first()
  const was = await toggle.getAttribute('aria-checked')
  const sent = a.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/settings' && r.request().method() === 'PUT')
  await toggle.click()
  await a.page.getByRole('button', { name: 'Save Changes' }).first().click()
  const res = await sent
  if (res.status() !== 200) throw new Error(`PUT /api/settings answered ${res.status()}`)
  await a.page.getByText('Settings saved').waitFor()
  const after = (await api('GET', '/api/settings', undefined, token)).data
  const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (changed.length !== 1) throw new Error(`expected one setting to change, got ${JSON.stringify(changed)}`)
  const restore = await api('PUT', '/api/settings', { values: before }, token)
  if (restore.status !== 200) throw new Error('could not restore the settings')
  return `changed "${changed[0]}" (switch was ${was}), restored`
})
await step('old web app: sign-out returns to the login page (the old app does not tell the server, as before)', async () => {
  const token = await a.page.evaluate(() => localStorage.getItem('dentor.token'))
  await a.page.goto(APP + '/', { waitUntil: 'networkidle' })
  const menu = a.page.locator('header div.group')
  await menu.hover()
  await menu.getByRole('button', { name: 'Sign out' }).click()
  await a.page.waitForURL(APP + '/login')
  const still = (await api('GET', '/api/auth/me', undefined, token)).status
  await api('POST', '/api/auth/logout', {}, token)
  return `its token answered ${still} afterwards, as it did before the upgrade; ended through the API now`
})
await a.context.close()

// ---- Super Admin in the old web app
const s = await session()
await step('old web app: the Super Admin console lists clinics and can manage one', async () => {
  await s.signIn('superadmin@dentor.in', 'SuperAdmin@2026')
  await s.page.waitForURL(APP + '/platform')
  await s.page.getByText('DENTOR Dental Clinic').first().waitFor()
  await s.page.getByRole('button', { name: /Manage/ }).first().click()
  await s.page.waitForURL(APP + '/')
  await s.page.goto(APP + '/patients', { waitUntil: 'networkidle' })
  if (s.bad.length || s.errors.length) throw new Error([...s.bad, ...s.errors].join(' ‖ '))
  const token = await s.page.evaluate(() => localStorage.getItem('dentor.token'))
  await api('POST', '/api/auth/logout', {}, token)
})
await s.context.close()

// ---- A Receptionist in the old web app: the one behaviour that changes
const owner = (await api('POST', '/api/auth/login', { email: 'owner@dentor.in', password: 'Owner@2026', app: 'owner' })).data.access_token
const email = `compat.desk.${Date.now()}@test.in`
const made = await api('POST', '/api/clinic/users', { name: 'Compat Desk', email, password: 'CompatDesk#2026', role: 'Receptionist' }, owner)
const r = await session()
await step('old web app: a Receptionist signs in and uses the reception pages as before', async () => {
  if (made.status !== 201) throw new Error(`could not create the test login: ${made.status}`)
  await r.signIn(email, 'CompatDesk#2026')
  await r.page.waitForURL(APP + '/')
  for (const route of ['/patients', '/appointments', '/accounts', '/staff']) await r.page.goto(APP + route, { waitUntil: 'networkidle' })
  if (r.bad.length || r.errors.length) throw new Error([...r.bad, ...r.errors].join(' ‖ '))
})
await step('old web app: a Receptionist who saves settings is now refused, and is told why', async () => {
  const settingsBefore = (await api('GET', '/api/settings', undefined, owner)).data
  await r.page.goto(APP + '/settings', { waitUntil: 'networkidle' })
  const sent = r.page.waitForResponse((res) => new URL(res.url()).pathname === '/api/settings' && res.request().method() === 'PUT')
  await r.page.getByRole('switch').first().click()
  await r.page.getByRole('button', { name: 'Save Changes' }).first().click()
  const res = await sent
  if (res.status() !== 403) throw new Error(`expected 403, got ${res.status()}`)
  const message = (await res.json()).detail
  await r.page.getByText(message).waitFor()
  const settingsAfter = (await api('GET', '/api/settings', undefined, owner)).data
  if (JSON.stringify(settingsBefore) !== JSON.stringify(settingsAfter)) throw new Error('the settings changed although the save was refused')
  return `the old page shows the API's message: "${message}"; nothing was changed`
})
await r.context.close()
if (made.status === 201) await api('PATCH', `/api/clinic/users/${made.data.id}`, { status: 'Inactive' }, owner)
await api('POST', '/api/auth/logout', {}, owner)
await browser.close()
console.log(`\nPrevious web app against the new backend: ${count - failed}/${count} checks passed`)
process.exit(failed ? 1 : 0)

// Shared helpers for the browser end-to-end checks of the three apps (the Vite / react-native-web builds).
//
//   node e2e/patient.e2e.mjs            # expects the app on its default port and the API on :8000
//   APP_URL=http://localhost:8091 API_URL=http://localhost:8000 node e2e/patient.e2e.mjs
//
// The API must run against a development database with demo data (SEED_DEMO on).
import { chromium } from 'playwright'

export const API_URL = process.env.API_URL || 'http://localhost:8000'

const PRODUCTION_HOST = /(^|\.)localappstore\.in$/i
const THIS_MACHINE = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * These checks create, change and delete real records, so they only run against a stack on
 * this machine. A production address is refused outright; another machine (a test server)
 * needs E2E_ALLOW_REMOTE=1.
 */
export function assertSafeTarget(name, url) {
  const { hostname } = new URL(url)
  if (PRODUCTION_HOST.test(hostname)) throw new Error(`${name}=${url} is a production address. These checks never run against production.`)
  if (!THIS_MACHINE.has(hostname) && process.env.E2E_ALLOW_REMOTE !== '1') {
    throw new Error(`${name}=${url} is not on this machine. These checks write test data; set E2E_ALLOW_REMOTE=1 only for a test server.`)
  }
}

assertSafeTarget('API_URL', API_URL)

// A wait that nothing is listening to any more (its step failed first, or is stuck) rejects
// on its own. That must not kill the run: the steps that put the demo data back still have to
// happen. It is recorded and reported as a failure instead.
const strayFailures = []
process.on('unhandledRejection', (error) => {
  strayFailures.push(String(error?.message ?? error).split('\n')[0].slice(0, 200))
})

export async function launch(appUrl, viewport = { width: 390, height: 844 }) {
  assertSafeTarget('APP_URL', appUrl)
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  // No action waits for ever: a control that never becomes usable fails its step.
  context.setDefaultTimeout(20000)
  const page = await context.newPage()
  const errors = []
  // Belt and braces: a build with the production API baked in cannot reach it from here.
  await context.route((url) => PRODUCTION_HOST.test(url.hostname), (route) => {
    errors.push(`blocked a request to production: ${route.request().url().slice(0, 120)}`)
    return route.abort()
  })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)))
  page.on('console', (m) => {
    // A failed HTTP request the app handles (e.g. a wrong password) is not an app error.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 240))
  })
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 120000 })
  return { browser, context, page, errors }
}

/** Runs named steps in order, keeps going after a failure, and reports a summary. */
export function runner(title) {
  const failed = []
  let count = 0
  return {
    async step(name, fn) {
      count += 1
      try {
        await fn()
        console.log(`✔ ${name}`)
      } catch (e) {
        failed.push(name)
        console.log(`✘ ${name} — ${String(e).split('\n')[0].slice(0, 200)}`)
        // E2E_DEBUG=1 also prints where in the suite the step stopped.
        if (process.env.E2E_DEBUG) console.log(String(e?.stack ?? '').split('\n').filter((line) => line.includes('.e2e.mjs')).slice(0, 3).join('\n'))
      }
    },
    finish(errors = []) {
      const unique = [...new Set([...errors, ...strayFailures.map((message) => `a wait was abandoned: ${message}`)])]
      if (unique.length) console.log(`\nConsole errors (${unique.length}):\n  ` + unique.slice(0, 8).join('\n  '))
      const ok = failed.length === 0 && unique.length === 0
      console.log(`\n${title}: ${count - failed.length}/${count} steps passed` + (failed.length ? ` · FAILED: ${failed.join(', ')}` : '') +
        (unique.length ? ` · ${unique.length} console error(s)` : ''))
      return ok ? 0 : 1
    },
  }
}

// The kit's content column (CONTENT_MAX_WIDTH in packages/shared/src/ui/layout.tsx) and the
// padding `Screen` puts inside it.
const COLUMN_WIDTH = 640
const COLUMN_PADDING = 16

/**
 * Fails if the page scrolls sideways or any button/link is clipped by the viewport edge.
 *
 * On a screen wider than the content column (a tablet) it also fails if a control is wider
 * than the padded column or lies wholly outside the column: the apps keep their content in one
 * centred column there, and a pinned button or a back arrow that leaves it looks detached.
 * The bottom tab bar spans the screen on purpose (its buttons have the role "tab").
 */
export async function assertNoOverflow(page, label = '') {
  const result = await page.evaluate(([columnWidth, columnPadding]) => {
    const vw = document.documentElement.clientWidth
    const over = document.documentElement.scrollWidth - vw
    const name = (el) => (el.getAttribute('data-testid') || el.textContent || el.tagName).trim().slice(0, 40)
    const controls = [...document.querySelectorAll('[role="button"], button, a, input, textarea')].filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      // ignore items inside an intentional horizontal scroller
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll') return false
      }
      return true
    })
    const clipped = controls
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.right > vw + 1 || r.left < -1
      })
      .map(name)
    const stray = []
    if (vw > columnWidth) {
      const left = (vw - columnWidth) / 2
      const right = left + columnWidth
      for (const el of controls) {
        const r = el.getBoundingClientRect()
        if (r.width > columnWidth - 2 * columnPadding + 1) stray.push(`${name(el)} is ${Math.round(r.width)}px wide`)
        else if (r.right <= left || r.left >= right) stray.push(`${name(el)} is outside the content column`)
      }
    }
    return { over, clipped, stray: [...new Set(stray)] }
  }, [COLUMN_WIDTH, COLUMN_PADDING])
  if (result.over > 1 || result.clipped.length) {
    throw new Error(`layout overflow ${label}: scroll +${result.over}px, clipped: ${result.clipped.slice(0, 4).join(' | ')}`)
  }
  if (result.stray.length) {
    throw new Error(`layout off the content column ${label}: ${result.stray.slice(0, 4).join(' | ')}`)
  }
}

/** Direct API access for test setup and for checking what the front desk would see. */
export async function apiCall(method, path, body, token) {
  assertSafeTarget('API_URL', API_URL)
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

export async function staffToken(email, password, app = 'web') {
  const { status, data } = await apiCall('POST', '/api/auth/login', { email, password, app })
  if (status !== 200) throw new Error(`staff login failed for ${email}: ${status} ${JSON.stringify(data)}`)
  return data.access_token
}

// Small phone to large tablet, portrait (the apps are locked to portrait).
export const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 760 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 1366 },
]

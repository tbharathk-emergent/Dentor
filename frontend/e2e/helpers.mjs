// Shared helpers for the browser regression check of the Dentor web app (reception app + platform console).
//
//   npm run e2e                       # app on http://localhost:5173, API on http://127.0.0.1:8000
//   APP_URL=http://localhost:5173 API_URL=http://127.0.0.1:8000 node e2e/web.e2e.mjs
//
// The app must be a production build served with /api proxied to the API (see web.e2e.mjs), and the
// API must run against a development database with demo data (SEED_DEMO on, OTP provider "console").
import { chromium } from 'playwright'

export const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
export const API_URL = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

/** Hosts this check must never talk to: it writes test data, so it only ever runs against a local stack. */
export const FORBIDDEN_HOST = /localappstore\.in/i

const THIS_MACHINE = new Set(['localhost', '127.0.0.1', '[::1]'])

/** A production address is refused outright; another machine (a test server) needs E2E_ALLOW_REMOTE=1. */
export function unsafeTarget(url) {
  const { hostname } = new URL(url)
  if (FORBIDDEN_HOST.test(hostname)) return `${url} is a production address; this check writes test data`
  if (!THIS_MACHINE.has(hostname) && process.env.E2E_ALLOW_REMOTE !== '1') {
    return `${url} is not on this machine; this check writes test data (set E2E_ALLOW_REMOTE=1 only for a test server)`
  }
  return null
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const fail = (message) => {
  throw new Error(message)
}
export const numberIn = (text) => Number(String(text).replace(/[^\d.-]/g, ''))
/** Rupees the way the app prints them: ₹1,23,456 (Indian grouping, no decimals). */
export const inr = (n) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/** Polls `check` until it returns true; a string it returns is the reason it is not true yet. */
export async function until(check, timeout = 15000, every = 250) {
  const deadline = Date.now() + timeout
  for (;;) {
    const result = await check()
    if (result === true) return
    if (Date.now() > deadline) fail(typeof result === 'string' ? result : 'condition not met in time')
    await sleep(every)
  }
}

/**
 * Runs named steps in order, keeps going after a failure, and reports a summary.
 * `onFail(name)` is called after a failed step (used to save a screenshot).
 */
// A wait that nothing is listening to any more (its step failed first) rejects on its own.
// That must not kill the run: the clean-up step still has to put the demo data back. It is
// recorded and reported as a failure instead.
const strayFailures = []
process.on('unhandledRejection', (error) => {
  strayFailures.push(String(error?.message ?? error).split('\n')[0].slice(0, 200))
})

export function runner(title, onFail) {
  const failed = []
  const notes = []
  let count = 0
  return {
    async step(name, fn) {
      count += 1
      try {
        await fn()
        console.log(`✔ ${name}`)
      } catch (e) {
        failed.push(name)
        console.log(`✘ ${name} — ${String(e).split('\n')[0].slice(0, 1800)}`)
        if (onFail) await onFail(name).catch(() => {})
      }
    },
    /** Something the run could not verify, printed with the summary so it is never mistaken for a pass. */
    note(text) {
      notes.push(text)
    },
    finish(errors = []) {
      const unique = [...new Set([...errors, ...strayFailures.map((message) => `a wait was abandoned: ${message}`)])]
      if (notes.length) console.log(`\nNot verified by this run (${notes.length}):\n  ` + notes.join('\n  '))
      if (unique.length) console.log(`\nUnexpected console errors and failed requests (${unique.length}):\n  ` + unique.slice(0, 12).join('\n  '))
      const ok = failed.length === 0 && unique.length === 0
      console.log(`\n${title}: ${count - failed.length}/${count} steps passed` + (failed.length ? ` · FAILED: ${failed.join(', ')}` : '') +
        (unique.length ? ` · ${unique.length} console error(s)` : ''))
      return ok ? 0 : 1
    },
  }
}

/**
 * Watches every page of a browser context. Collected as errors (they fail the run):
 *   - uncaught page errors and console errors,
 *   - API answers of 400 and above, and API requests that never got an answer, unless the step that
 *     provokes them said so with `expecting()`,
 *   - any request to a forbidden (production) host.
 */
export function watch(context, errors, label) {
  const expected = []
  const requests = []
  const responses = []
  const tag = (text) => `[${label}] ${text}`.slice(0, 260)
  const isApi = (url) => new URL(url).pathname.startsWith('/api/')
  const short = (url) => {
    const u = new URL(url)
    return u.pathname + u.search
  }
  const allowed = (status, method, url) =>
    expected.some((rule) => rule.active && rule.status === status && typeof rule.path === 'string' && (!rule.method || rule.method === method) && url.includes(rule.path))
  const consoleExpected = (text) => expected.some((rule) => rule.active && rule.status === 'console' && rule.path.test(text))

  context.on('page', (page) => {
    page.on('pageerror', (e) => errors.push(tag(`page error: ${String(e)}`)))
    page.on('console', (m) => {
      // A failed HTTP request is judged below, from the response itself, where a step can expect it.
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !consoleExpected(m.text())) errors.push(tag(`console: ${m.text()}`))
    })
  })
  context.on('request', (request) => {
    const url = request.url()
    if (FORBIDDEN_HOST.test(new URL(url).host)) errors.push(tag(`request to a production host: ${url}`))
    if (isApi(url)) requests.push({ method: request.method(), url, path: short(url), headers: request.headers(), at: Date.now() })
  })
  context.on('response', (response) => {
    const url = response.url()
    if (!isApi(url)) return
    const method = response.request().method()
    responses.push({ method, url, path: short(url), status: response.status(), fromServiceWorker: response.fromServiceWorker(), at: Date.now() })
    if (response.status() >= 400 && !allowed(response.status(), method, url)) errors.push(tag(`API ${response.status()} for ${method} ${short(url)}`))
  })
  context.on('requestfailed', (request) => {
    const url = request.url()
    if (!isApi(url)) return
    const reason = request.failure()?.errorText || 'failed'
    // A navigation or reload cancels whatever the previous page was still loading.
    if (/ERR_ABORTED/.test(reason)) return
    if (!allowed(0, request.method(), url)) errors.push(tag(`API request ${request.method()} ${short(url)} got no answer: ${reason}`))
  })

  return {
    requests,
    responses,
    /**
     * Runs `fn` while the listed refusals are expected: [status, path part, method?]. Status 0 means
     * "the request gets no answer" (used while offline). ['console', /pattern/] expects a console
     * error with that text.
     */
    async expecting(rules, fn) {
      const mine = rules.map(([status, path, method]) => ({ status, path, method, active: true }))
      expected.push(...mine)
      try {
        return await fn()
      } finally {
        await sleep(150) // let the listeners see responses that are already on their way
        for (const rule of mine) rule.active = false
      }
    },
    /** Always expected: the sign-in endpoints share a per-address rate limit with every other check. */
    alwaysExpect(status, path) {
      expected.push({ status, path, active: true })
    },
  }
}

/**
 * Fails if the page scrolls sideways, or if a visible button, link or field is cut off by the left
 * or right edge of the viewport. Also fails for what makes a screen unusable without overflowing it:
 * a label that does not fit its button, a text squeezed down to a few characters, a figure tile whose
 * number, label or hint is cut short, a text field too narrow to type in, something marked "hidden"
 * for this width that shows anyway, and a box that scrolls sideways although it was only meant to
 * scroll vertically.
 * With `inside`, also fails if that element (an open dialog) or any control in it does not fit the
 * viewport, or if a control in it sticks out of the dialog.
 */
export async function assertNoOverflow(page, label = '', inside = null) {
  const result = await page.evaluate((insideSelector) => {
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const over = document.documentElement.scrollWidth - vw
    const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
    const controls = (root) => [...root.querySelectorAll('[role="button"], button, a, input, select, textarea')].filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      const style = getComputedStyle(el)
      return style.visibility !== 'hidden' && style.display !== 'none'
    })
    // A vertical scroller (a dialog body, a long menu) also computes to overflow-x:auto, so only an
    // element that asks for sideways scrolling by its own classes counts as an intentional scroller
    // (tab strip, wide table, chip row).
    const scroller = (el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)
    const meantToScrollSideways = (el) => /(^|\s)(sm:|md:|lg:)?overflow-(x-)?(auto|scroll)(\s|$)/.test(el.getAttribute('class') || '')
    const scrollsSideways = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (scroller(p) && meantToScrollSideways(p)) return true
      return false
    }
    const clipped = controls(document)
      .filter((el) => {
        if (scrollsSideways(el)) return false
        const r = el.getBoundingClientRect()
        return r.right > vw + 1 || r.left < -1
      })
      .map(name)

    const problems = []
    // A label that does not fit its button: wrapped onto a second line or cut off.
    for (const el of controls(document)) {
      if (!['BUTTON', 'A'].includes(el.tagName) || scrollsSideways(el)) continue
      const tooWide = el.scrollWidth - el.clientWidth > 3
      const tooTall = el.scrollHeight - el.clientHeight > 3
      if (tooWide || tooTall) problems.push(`the label "${name(el)}" does not fit its button (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`)
    }
    // Text that is cut with an ellipsis until almost nothing is left of it (a name pushed out by the
    // badges or buttons on its line). Losing the end of a long text is by design; being left with
    // under 40px, and under half of what the text needs, is not.
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el)
      if (style.textOverflow !== 'ellipsis' || style.display === 'inline' || style.visibility === 'hidden' || !el.offsetParent) continue
      if (!el.textContent.trim() || scrollsSideways(el)) continue
      if (el.clientWidth < 40 && el.clientWidth * 2 < el.scrollWidth) problems.push(`"${name(el)}" is squeezed to ${el.clientWidth}px of the ${el.scrollWidth}px it needs`)
    }
    // A figure tile (a number over its label, like "16 · Appointments today"). The label and the hint
    // are short fixed words that say what the number is, so unlike a long name they may not lose
    // their end at all ("Appointment…", "30 appointments · 0 vi…"), and the number has to be whole
    // and on one line. The rule above does not see this: a label left with 83px of the 108px it
    // needs is not "squeezed".
    for (const figure of document.querySelectorAll('.shadow-card span.text-xl.font-bold')) {
      const tile = figure.closest('.shadow-card')
      const box = tile.getBoundingClientRect()
      if (box.width === 0 || getComputedStyle(tile).visibility === 'hidden' || scrollsSideways(tile)) continue
      const label = figure.nextElementSibling ? name(figure.nextElementSibling) : name(figure)
      for (const el of figure.parentElement.children) {
        if (!el.textContent.trim()) continue
        const r = el.getBoundingClientRect()
        const cut = el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1 || r.left < box.left - 1 || r.right > box.right + 1
        if (cut) problems.push(`the tile "${label}" cuts "${name(el)}" short (${el.clientWidth}px of the ${el.scrollWidth}px it needs)`)
      }
      if (figure.getBoundingClientRect().height > parseFloat(getComputedStyle(figure).lineHeight) * 1.5) problems.push(`the tile "${label}" breaks its number "${name(figure)}" over two lines`)
    }
    // "hidden" that does not hide: a component's own display class (a badge's inline-flex) outranks it,
    // so something meant for wider screens only takes up room on a phone.
    const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }
    const DISPLAY = '(block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|contents|flow-root)'
    for (const el of document.querySelectorAll('.hidden')) {
      const classes = (el.getAttribute('class') || '').split(/\s+/)
      const shownFrom = classes.map((c) => c.match(new RegExp(`^(sm|md|lg|xl|2xl):${DISPLAY}$`))).filter(Boolean).map((m) => BREAKPOINTS[m[1]])
      if (shownFrom.some((px) => window.innerWidth >= px)) continue
      if (classes.some((c) => new RegExp(`:${DISPLAY}$`).test(c) && !/^(sm|md|lg|xl|2xl):/.test(c))) continue // shown on hover, focus…
      if (getComputedStyle(el).display !== 'none') problems.push(`"${name(el)}" carries the class "hidden" but is shown at this width`)
    }
    // A text field too narrow to read what is typed into it.
    for (const el of controls(document)) {
      const typed = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'search', 'email', 'password', 'tel', 'url'].includes(el.type))
      if (typed && !scrollsSideways(el) && el.clientWidth < 96) problems.push(`the field "${name(el)}" is squeezed to ${el.clientWidth}px`)
    }
    // Content wider than a box that was only meant to scroll up and down.
    for (const el of document.querySelectorAll('body *')) {
      if (['TEXTAREA', 'INPUT', 'SELECT'].includes(el.tagName)) continue
      if (!scroller(el) || meantToScrollSideways(el) || scrollsSideways(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      if (el.scrollWidth > el.clientWidth + 1) problems.push(`"${name(el)}" scrolls sideways by ${el.scrollWidth - el.clientWidth}px`)
    }
    if (insideSelector) {
      const boxes = [...document.querySelectorAll(insideSelector)].filter((el) => el.getBoundingClientRect().width > 0)
      if (!boxes.length) problems.push(`nothing matches ${insideSelector}`)
      for (const box of boxes) {
        const b = box.getBoundingClientRect()
        if (b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1) {
          problems.push(`dialog ${Math.round(b.width)}×${Math.round(b.height)} at ${Math.round(b.left)},${Math.round(b.top)} does not fit ${vw}×${vh}`)
        }
        for (const el of controls(box)) {
          const r = el.getBoundingClientRect()
          // Controls in the scrolling body may be below the fold; they must never stick out sideways.
          if (!scrollsSideways(el) && (r.left < b.left - 1 || r.right > b.right + 1)) problems.push(`"${name(el)}" sticks out of the dialog`)
        }
      }
    }
    return { over, clipped, problems }
  }, inside)
  const findings = [
    ...(result.over > 1 ? [`the page scrolls sideways by ${result.over}px`] : []),
    ...[...new Set(result.clipped)].map((control) => `"${control}" is cut off by the edge of the screen`),
    ...new Set(result.problems),
  ]
  if (findings.length) {
    const error = new Error(`layout ${label}: ${findings.slice(0, 6).join('; ')}`)
    error.findings = findings // every finding, for a caller that reports several screens together
    throw error
  }
}

/** Direct API access: test setup, clean-up and the figures the screen is compared with. */
export async function apiCall(method, path, body, token, headers = {}) {
  if (unsafeTarget(API_URL)) fail(`refusing to call the API: ${unsafeTarget(API_URL)}`)
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

/** The sign-in endpoints allow 30 calls a minute per address, shared with every other check: wait and retry. */
export async function patiently(call, attempts = 6) {
  for (let attempt = 1; ; attempt += 1) {
    const result = await call()
    if (result.status !== 429 || attempt >= attempts) return result
    await sleep(12000)
  }
}

export const VIEWPORTS = [
  { width: 360, height: 760 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

export async function launch() {
  return chromium.launch()
}

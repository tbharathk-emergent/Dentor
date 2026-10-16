// Unit tests that keep the mobile apps in step with the reception web app and the API.
// Run with `npm test`.
//
// The first half needs nothing but this workspace. The second half reads the web app's
// sources (../frontend) to compare vocabularies and colours; where the web app is not checked
// out next to mobile/, those tests are skipped and say so.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CLINIC_RULES, isRuleOn } from '../apps/owner/src/lib/rules.ts'
import { fmtDate, fmtDateTime, fmtFileSize, fmtINR, fmtTime, timeAgo } from '../packages/shared/src/format.ts'
import { LEAD_STAGE_TONES, PAGE_STATUS_TONES, WEB_STATUS_TONES, leadStageTone, riskTone, roleTone, statusTone } from '../packages/shared/src/status.ts'
import { EMAIL_PATTERN, mobileProblem, normalizeMobile } from '../packages/shared/src/validation.ts'

const here = dirname(fileURLToPath(import.meta.url))
const mobile = (path) => readFileSync(join(here, '..', path), 'utf8')
const WEB = join(here, '..', '..', 'frontend')
const web = (path) => readFileSync(join(WEB, path), 'utf8')
/** Skips a test that compares with the web app when its sources are not there. */
const needsWeb = (t, ...paths) => {
  const missing = paths.find((path) => !existsSync(join(WEB, path)))
  if (missing) t.skip(`the web app's ${missing} is not next to mobile/`)
  return !missing
}

/* ------------------------------------------------------------------ formats */

test('money is whole rupees with Indian digit grouping', () => {
  assert.equal(fmtINR(123456.5), '₹1,23,457')
  assert.equal(fmtINR('88450'), '₹88,450')
  assert.equal(fmtINR(0), '₹0')
  assert.equal(fmtINR(null), '₹0')
})

test('dates read "03 Sep 2026"', () => {
  assert.equal(fmtDate('2026-09-03'), '03 Sep 2026')
  assert.equal(fmtDate('2026-10-13'), '13 Oct 2026')
  assert.equal(fmtDate(''), '—')
  assert.equal(fmtDate('next week'), 'next week')
})

test('times read "9:30 AM", as the API writes them in time_label', () => {
  assert.equal(fmtTime('09:30'), '9:30 AM')
  assert.equal(fmtTime('14:05'), '2:05 PM')
  assert.equal(fmtTime('00:00'), '12:00 AM')
  assert.equal(fmtTime('12:00'), '12:00 PM')
  assert.equal(fmtTime(''), '')
})

test('a date with a time carries the year, like every other date', () => {
  assert.equal(fmtDateTime(new Date(2026, 9, 13, 9, 50).toISOString()), '13 Oct 2026, 9:50 AM')
  assert.equal(fmtDateTime(''), '')
})

test('relative times take the same steps as the web app\'s notification list', () => {
  const ago = (minutes) => timeAgo(new Date(Date.now() - minutes * 60000).toISOString())
  assert.equal(ago(0), 'Just now')
  assert.equal(ago(12), '12 min ago')
  assert.equal(ago(59), '59 min ago')
  assert.equal(ago(60), '1 h ago')
  assert.equal(ago(1439), '24 h ago')
  assert.equal(ago(1440), '1 d ago')
  assert.equal(ago(9 * 1440), '9 d ago')
  assert.equal(timeAgo('not a date'), '')
})

test('file sizes never go below 1 KB, as in the web app\'s file list', () => {
  assert.equal(fmtFileSize(95), '1 KB')
  assert.equal(fmtFileSize(310 * 1024), '310 KB')
  assert.equal(fmtFileSize(2.4 * 1024 * 1024), '2.4 MB')
})

/* --------------------------------------------------------------- validation */

test('a mobile number is read as the API reads it: separators dropped, last ten digits', () => {
  // backend/app/otp.py normalize_mobile
  for (const typed of ['9876543210', '+91 98765 43210', '+91-98765-43210', '09876543210', '919876543210', '(0) 98765 43210']) {
    assert.equal(normalizeMobile(typed), '9876543210', typed)
    assert.equal(mobileProblem(typed), undefined, typed)
  }
  assert.equal(mobileProblem(''), 'Enter your 10-digit mobile number.')
  assert.equal(mobileProblem('', { required: false }), undefined)
  assert.equal(mobileProblem('98765'), 'A mobile number has 10 digits.')
  assert.equal(mobileProblem('5876543210'), 'Indian mobile numbers start with 6, 7, 8 or 9.')
})

test('an email address is checked with the API\'s pattern', () => {
  // backend/app/routers/patient_portal.py: ^\S+@\S+\.\S+$
  for (const good of ['name@clinic.in', 'a@b.c']) assert.ok(EMAIL_PATTERN.test(good), good)
  for (const bad of ['nobody@nowhere', 'not-an-email', 'two words@clinic.in', '@clinic.in']) assert.ok(!EMAIL_PATTERN.test(bad), bad)
})

/* --------------------------------------------------- statuses, stages, roles */

test('every status has one tone, whatever its capitals', () => {
  assert.equal(statusTone('Scheduled'), 'blue')
  assert.equal(statusTone('WAITING'), 'amber')
  assert.equal(statusTone('Completed'), 'green')
  assert.equal(statusTone('Cancelled'), 'red')
  assert.equal(statusTone('Confirmed'), 'green')
  assert.equal(statusTone('Signed'), 'green')
  assert.equal(statusTone('Flagged'), 'violet')
  // Grey in the web app, so grey here: see the note in status.ts before colouring one.
  for (const grey of ['Planned', 'Ready', 'Delayed', 'Declined', 'Draft', '', null, undefined]) assert.equal(statusTone(grey), 'slate', String(grey))
  const words = [...WEB_STATUS_TONES, ...PAGE_STATUS_TONES].flatMap(([, list]) => list)
  assert.equal(new Set(words).size, words.length, 'a status is listed under two tones')
})

test('lead stages, login roles and risk levels have the web app\'s tones', () => {
  assert.deepEqual(['New', 'Contacted', 'Qualified', 'Consultation', 'Converted', 'Lost', 'Other'].map(leadStageTone), ['blue', 'amber', 'violet', 'brand', 'green', 'red', 'slate'])
  assert.deepEqual(['Clinic Owner', 'Consultant', 'Administrator', 'Receptionist'].map(roleTone), ['violet', 'blue', 'slate', 'slate'])
  assert.deepEqual(['High', 'Medium', 'Low'].map(riskTone), ['red', 'amber', 'green'])
})

test('the status tones are the web app\'s statusTone, word for word', (t) => {
  if (!needsWeb(t, 'src/components/ui/Badge.tsx')) return
  const source = web('src/components/ui/Badge.tsx')
  const theirs = [...source.matchAll(/if \(\[([^\]]+)\]\.includes\(s\)\) return '(\w+)'/g)].map((m) => [m[2], [...m[1].matchAll(/'([^']+)'/g)].map((w) => w[1])])
  assert.ok(theirs.length >= 5, 'could not read statusTone in the web app: has it been rewritten?')
  assert.deepEqual(WEB_STATUS_TONES, theirs)
})

test('lead stage tones are the web app\'s STAGE_TONES', (t) => {
  if (!needsWeb(t, 'src/pages/Leads.tsx')) return
  const block = /const STAGE_TONES[^=]*=\s*\{([^}]+)\}/.exec(web('src/pages/Leads.tsx'))
  assert.ok(block, 'could not read STAGE_TONES in the web app')
  const theirs = Object.fromEntries([...block[1].matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => [m[1], m[2]]))
  assert.deepEqual(LEAD_STAGE_TONES, theirs)
})

/* -------------------------------------------------------------- clinic rules */

test('each clinic rule has the API\'s default', () => {
  // backend: partialPayments (routers/billing.py), roundOff (rules.py) and strongPassword
  // (routers/clinic_users.py, auth_router.py) are on until a clinic turns them off; the rest are off.
  const onByDefault = CLINIC_RULES.filter((rule) => isRuleOn({}, rule)).map((rule) => rule.key)
  assert.deepEqual(onByDefault.sort(), ['partialPayments', 'roundOff', 'strongPassword'])
  assert.equal(isRuleOn({ roundOff: false }, CLINIC_RULES.find((rule) => rule.key === 'roundOff')), false)
})

test('each clinic rule is named as its switch in the web app\'s Settings page', (t) => {
  if (!needsWeb(t, 'src/pages/Settings.tsx')) return
  const labels = Object.fromEntries([...web('src/pages/Settings.tsx').matchAll(/\['(\w+)',\s*'([^']+)',\s*'[^']*'\]/g)].map((m) => [m[1], m[2]]))
  assert.ok(Object.keys(labels).length >= 10, 'could not read the switches in the web app\'s Settings page')
  for (const rule of CLINIC_RULES) assert.equal(rule.title, labels[rule.key], rule.key)
})

/* ------------------------------------------------------------------- colours */

/** OKLCH → sRGB hex, clipped to the sRGB gamut as a browser paints it. */
function oklchToHex(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const channel = (x) => {
    const encoded = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
  }
  return linear.map(channel)
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** The web app's colours by Tailwind name ("slate-500", "brand-700"), as [r, g, b]. */
function webPalette() {
  const palette = {}
  for (const css of [web('node_modules/tailwindcss/theme.css'), web('src/index.css')]) {
    for (const [, name, value] of css.matchAll(/--color-([a-z]+-\d+):\s*([^;]+);/g)) {
      const oklch = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(value)
      if (oklch) palette[name] = oklchToHex(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]))
      else if (/^#[0-9a-f]{6}$/i.test(value.trim())) palette[name] = hexToRgb(value.trim())
    }
  }
  return palette
}

test('every colour token that names a web colour has that colour', (t) => {
  if (!needsWeb(t, 'node_modules/tailwindcss/theme.css', 'src/index.css')) return
  const palette = webPalette()
  let checked = 0
  for (const line of mobile('packages/shared/src/theme.ts').split('\n')) {
    const comment = line.indexOf('//')
    if (comment < 0) continue
    const hexes = [...line.slice(0, comment).matchAll(/'(#[0-9a-f]{6})'/gi)].map((m) => m[1])
    const names = [...line.slice(comment).matchAll(/\b([a-z]+-\d{2,3})\b/g)].map((m) => m[1])
    if (hexes.length === 0 || names.length === 0) continue
    assert.equal(hexes.length, names.length, `theme.ts: ${line.trim()} names ${names.length} web colours for ${hexes.length} values`)
    hexes.forEach((hex, i) => {
      const theirs = palette[names[i]]
      assert.ok(theirs, `theme.ts names "${names[i]}", which the web app's stylesheet does not define`)
      // One step of rounding is allowed: the web colours are OKLCH, converted here and in the browser.
      const off = Math.max(...hexToRgb(hex).map((value, channel) => Math.abs(value - theirs[channel])))
      assert.ok(off <= 1, `theme.ts has ${hex} for ${names[i]}; the web app paints rgb(${theirs.join(', ')})`)
      checked += 1
    })
  }
  assert.ok(checked >= 40, `only ${checked} colour tokens were compared: has theme.ts lost its comments?`)
})

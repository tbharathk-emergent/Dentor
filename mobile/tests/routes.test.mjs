// Unit tests for the route table: file → route, and path → screen. Run with `npm test`.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { matchRoute } from '../packages/shared/src/navigation/match.ts'
import { describeRoute, generate } from '../scripts/gen-routes.mjs'

test('a screen file becomes a route', () => {
  assert.deepEqual(describeRoute('(app)/(tabs)/index.tsx'), { path: '', group: 'app', tab: true })
  assert.deepEqual(describeRoute('(app)/(tabs)/finance.tsx'), { path: 'finance', group: 'app', tab: true })
  assert.deepEqual(describeRoute('(app)/patients/[id]/index.tsx'), { path: 'patients/[id]', group: 'app', tab: false })
  assert.deepEqual(describeRoute('(app)/patients/[id]/files/[fileId].tsx'), { path: 'patients/[id]/files/[fileId]', group: 'app', tab: false })
  assert.deepEqual(describeRoute('(auth)/index.tsx'), { path: '', group: 'auth', tab: false })
  assert.deepEqual(describeRoute('login.tsx'), { path: 'login', group: 'root', tab: false })
})

const routes = [
  { path: '' },
  { path: 'patients' },
  { path: 'patients/[id]' },
  { path: 'patients/[id]/files/[fileId]' },
  { path: 'prescriptions/[id]' },
  { path: 'prescriptions/new' },
]
const find = (href) => {
  const match = matchRoute(routes, href)
  return match && [match.route.path, match.params]
}

test('a path reaches its screen', () => {
  assert.deepEqual(find('/'), ['', {}])
  assert.deepEqual(find('/patients'), ['patients', {}])
  assert.deepEqual(find('/patients/7'), ['patients/[id]', { id: '7' }])
  assert.deepEqual(find('/patients/7/files/abc'), ['patients/[id]/files/[fileId]', { id: '7', fileId: 'abc' }])
  assert.equal(find('/nowhere'), null)
  assert.equal(find('/patients/7/unknown'), null)
})

test('group folders and a trailing index are ignored in a path', () => {
  assert.deepEqual(find('/(app)/(tabs)/patients'), ['patients', {}])
  assert.deepEqual(find('/(tabs)'), ['', {}])
  assert.deepEqual(find('/patients/7/index'), ['patients/[id]', { id: '7' }])
})

test('a fixed segment wins over a parameter', () => {
  assert.deepEqual(find('/prescriptions/new'), ['prescriptions/new', {}])
  assert.deepEqual(find('/prescriptions/55'), ['prescriptions/[id]', { id: '55' }])
})

test('parameters come from the query string or from params', () => {
  assert.deepEqual(find('/patients?q=asha%20rao&tab=due'), ['patients', { q: 'asha rao', tab: 'due' }])
  assert.deepEqual(find({ pathname: '/patients/[id]', params: { id: 7, tab: 'files' } }), ['patients/[id]', { id: '7', tab: 'files' }])
  assert.deepEqual(find({ pathname: '/patients/9', params: { from: 'home', skip: undefined } }), ['patients/[id]', { id: '9', from: 'home' }])
  assert.deepEqual(find('/patients/a%2Fb'), ['patients/[id]', { id: 'a/b' }])
})

test('a pattern without its parameter value matches nothing', () => {
  assert.equal(find({ pathname: '/patients/[id]' }), null)
})

function appWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dentor-routes-'))
  for (const [file, body] of Object.entries(files)) {
    const full = join(dir, 'src', 'app', file)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }
  return dir
}
const screen = 'export default function Screen() { return null }\n'

test('the generator lists screens and skips layout files', () => {
  const dir = appWith({ '_layout.tsx': screen, 'login.tsx': screen, '(app)/_layout.tsx': screen, '(app)/(tabs)/index.tsx': screen, '(app)/patients/[id].tsx': screen })
  try {
    const { text, count } = generate(dir)
    assert.equal(count, 3)
    assert.match(text, /\{ path: '', group: 'app', tab: true, component: Screen0 \}/)
    assert.match(text, /\{ path: 'patients\/\[id\]', group: 'app', tab: false, component: Screen1 \}/)
    assert.match(text, /\{ path: 'login', group: 'root', tab: false, component: Screen2 \}/)
    assert.doesNotMatch(text, /_layout/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the generator rejects two screens on one path and a screen without a default export', () => {
  const clash = appWith({ '(app)/reports.tsx': screen, '(app)/reports/index.tsx': screen })
  const empty = appWith({ '(app)/reports.tsx': 'export const x = 1\n' })
  try {
    assert.throws(() => generate(clash), /both resolve to "\/reports"/)
    assert.throws(() => generate(empty), /no default export/)
  } finally {
    rmSync(clash, { recursive: true, force: true })
    rmSync(empty, { recursive: true, force: true })
  }
})

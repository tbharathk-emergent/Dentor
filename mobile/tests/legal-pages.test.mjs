// The public legal pages (frontend/public/legal/) must say what the apps say: run `node scripts/legal-pages.mjs`
// after changing packages/shared/src/legal/content.ts.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { OUT_DIR, renderAll } from '../scripts/legal-pages.mjs'

test('the public legal pages are up to date with the apps’ texts', () => {
  for (const [file, html] of Object.entries(renderAll())) {
    let saved = ''
    try {
      saved = readFileSync(path.join(OUT_DIR, file), 'utf8')
    } catch {
      assert.fail(`${file} is missing: run node scripts/legal-pages.mjs in mobile/`)
    }
    assert.equal(saved, html, `${file} is out of date: run node scripts/legal-pages.mjs in mobile/`)
  }
})

test('every page has a title, the company and links to the others; the deletion page says how', () => {
  const pages = renderAll()
  for (const [file, html] of Object.entries(pages)) {
    assert.match(html, /<title>[^<]+ · Dentor<\/title>/, file)
    assert.match(html, /IQDS DENTAL INDIA Pvt\. Ltd\./, file)
    for (const other of Object.keys(pages).filter((f) => f !== 'index.html')) assert.ok(html.includes(`href="${other}"`), `${file} → ${other}`)
  }
  const deletion = pages['delete-account.html']
  for (const words of ['Profile › Delete account', 'More › Settings › Delete Account', 'Profile › Settings › Delete Account', 'Without the app']) {
    assert.ok(deletion.includes(words), words)
  }
})

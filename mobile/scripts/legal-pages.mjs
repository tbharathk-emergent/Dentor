// Writes the public legal pages (Privacy Policy, Terms, account deletion) that the Google Play and App Store
// listings link to, from the same texts the apps show (packages/shared/src/legal/content.ts). They are published
// with the reception web app: frontend/public/legal/ → https://dentor.localappstore.in/legal/.
//
//   node scripts/legal-pages.mjs          (in mobile/; run it after changing content.ts — `npm test` checks it was)
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCOUNT_DELETION, LEGAL_DETAILS, LEGAL_PAGES, PATIENT_PRIVACY, PATIENT_TERMS, STAFF_PRIVACY, STAFF_TERMS,
} from '../packages/shared/src/legal/content.ts'

export const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/public/legal')

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const NAV = [
  [LEGAL_PAGES.patientPrivacy, 'Privacy Policy (patients)'],
  [LEGAL_PAGES.patientTerms, 'Terms of Use (patients)'],
  [LEGAL_PAGES.staffPrivacy, 'Privacy Policy (clinics and consultants)'],
  [LEGAL_PAGES.staffTerms, 'Terms & Conditions (clinics and consultants)'],
  [LEGAL_PAGES.deletion, 'Delete your account'],
]

const STYLE = `:root{--bg:#ffffff;--fg:#1c2b33;--muted:#5b6b73;--line:#e3e8eb;--brand:#007f86;--note:#fff6e0;--note-fg:#7a5200}
@media (prefers-color-scheme:dark){:root{--bg:#10181c;--fg:#e8eef0;--muted:#a3b2b8;--line:#26343a;--brand:#4fc3c9;--note:#3a2e10;--note-fg:#f3d48a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}h1{font-size:1.75rem;line-height:1.25;margin:0 0 4px}h2{font-size:1.15rem;margin:28px 0 6px}
p{margin:0 0 10px}.muted{color:var(--muted);font-size:.9rem}.note{background:var(--note);color:var(--note-fg);border-radius:10px;padding:10px 14px;margin:16px 0}
nav{border-top:1px solid var(--line);margin-top:36px;padding-top:16px}nav a{display:block;color:var(--brand);padding:4px 0;text-decoration:none}nav a:hover{text-decoration:underline}
nav a[aria-current]{color:var(--fg);font-weight:600}footer{margin-top:20px}`

export function renderPage(document, file) {
  const sections = document.sections
    .map((s) => `<h2>${escape(s.heading)}</h2>\n${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`)
    .join('\n')
  const links = NAV.map(([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${escape(label)}</a>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(document.title)} · ${escape(LEGAL_DETAILS.product)}</title>
<meta name="robots" content="index,follow">
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${escape(document.title)}</h1>
<p class="muted">${escape(LEGAL_DETAILS.product)} · Last updated ${escape(document.updated)}</p>
${document.notice ? `<p class="note">${escape(document.notice)}</p>` : ''}
${sections}
<nav aria-label="Dentor legal pages">
${links}
</nav>
<footer class="muted">A Unit Of ${escape(LEGAL_DETAILS.company)}</footer>
</main>
</body>
</html>
`
}

/** Every page: file name → HTML. */
export function renderAll() {
  const index = {
    title: 'Dentor legal information', notice: '', updated: LEGAL_DETAILS.updated,
    sections: [{ heading: 'Pages', paragraphs: ['Choose a page below. Patients use the Dentor app; clinics and consultants use the Dentor Clinic Owner and Dentor Consultant apps and the web app.'] }],
  }
  return {
    'index.html': renderPage(index, 'index.html'),
    [LEGAL_PAGES.patientPrivacy]: renderPage(PATIENT_PRIVACY, LEGAL_PAGES.patientPrivacy),
    [LEGAL_PAGES.patientTerms]: renderPage(PATIENT_TERMS, LEGAL_PAGES.patientTerms),
    [LEGAL_PAGES.staffPrivacy]: renderPage(STAFF_PRIVACY, LEGAL_PAGES.staffPrivacy),
    [LEGAL_PAGES.staffTerms]: renderPage(STAFF_TERMS, LEGAL_PAGES.staffTerms),
    [LEGAL_PAGES.deletion]: renderPage(ACCOUNT_DELETION, LEGAL_PAGES.deletion),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [file, html] of Object.entries(renderAll())) writeFileSync(path.join(OUT_DIR, file), html)
  console.log(`Wrote ${Object.keys(renderAll()).length} pages to ${path.relative(process.cwd(), OUT_DIR)}`)
}

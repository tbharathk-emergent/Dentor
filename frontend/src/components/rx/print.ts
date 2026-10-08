import type { Doc } from '@/lib/hooks'
import { fmtDate } from '@/lib/hooks'

export const CLINIC = {
  name: 'DENTOR Dental Clinic',
  address: 'No. 6, Ponnagar, Dindigul Road, Manaparai – 621306',
  phone: '+91 73392 99339',
}

export interface RxMed {
  drug: string
  dose: string
  freq: string
  days: string
  unit: string
  instruction: string
}

export const blankMed = (): RxMed => ({
  drug: '', dose: '', freq: 'TDS', days: '5', unit: 'Days', instruction: 'After food',
})

export const normalizeMed = (m: Partial<RxMed> & Record<string, unknown>): RxMed => ({
  drug: String(m.drug ?? ''),
  dose: String(m.dose ?? ''),
  freq: String(m.freq ?? 'TDS'),
  days: String(m.days ?? '5'),
  unit: String(m.unit ?? 'Days'),
  instruction: String(m.instruction ?? 'After food'),
})

export const medDuration = (m: RxMed) => (m.days ? `${m.days} ${m.unit || 'Days'}` : '—')

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

const money = (n: unknown) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SHEET_CSS = `
.px-sheet { width: 148mm; max-width: 148mm; min-height: 190mm; margin: 0 auto; box-sizing: border-box;
  background: #fff; color: #0f172a; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10pt;
  line-height: 1.45; padding: 9mm 9mm 12mm; border: 1px solid #e2e8f0; }
.px-head { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 8px; }
.px-clinic { font-size: 15pt; font-weight: 800; color: #0f766e; letter-spacing: 0.02em; }
.px-sub { font-size: 8.5pt; color: #475569; margin-top: 1px; }
.px-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 9pt; flex-wrap: wrap; }
.px-meta span { color: #64748b; display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; }
.px-patient { margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px;
  display: flex; flex-wrap: wrap; gap: 6px 24px; font-size: 9.5pt; background: #f8fafc; }
.px-patient span { color: #64748b; display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; }
.px-allergy { width: 100%; color: #b91c1c; font-weight: 700; font-size: 9pt; }
.px-line { margin-top: 7px; font-size: 9.5pt; }
.px-line span { color: #64748b; font-weight: 600; }
.px-rx { font-size: 20pt; font-weight: 700; color: #0f766e; margin: 8px 0 2px; font-family: Georgia, serif; }
.px-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 2px; }
.px-table th { text-align: left; border-bottom: 1.5px solid #0f766e; padding: 4px 6px; font-size: 7.5pt;
  text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
.px-table td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; vertical-align: top; }
.px-table td.r, .px-table th.r { text-align: right; }
.px-advice { margin-top: 10px; font-size: 9pt; border-left: 3px solid #99f6e4; padding: 4px 10px; background: #f0fdfa; }
.px-sign { margin-top: 36px; display: flex; justify-content: flex-end; }
.px-sign > div { text-align: center; min-width: 52mm; }
.px-sign-line { border-top: 1px solid #334155; margin-bottom: 4px; }
.px-foot { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 5px; text-align: center;
  font-size: 7.5pt; color: #94a3b8; }
.px-totals { margin-top: 8px; margin-left: auto; width: 62mm; font-size: 9.5pt; }
.px-totals div { display: flex; justify-content: space-between; padding: 2px 6px; }
.px-totals .px-grand { border-top: 1.5px solid #0f766e; font-weight: 800; font-size: 11pt; margin-top: 3px; padding-top: 4px; }
@page { size: A5; margin: 0; }
@media print { .px-sheet { border: none; min-height: auto; } }
`

const sheetHead = () => `
  <div class="px-head">
    <div class="px-clinic">${esc(CLINIC.name)}</div>
    <div class="px-sub">${esc(CLINIC.address)}</div>
    <div class="px-sub">Phone: ${esc(CLINIC.phone)}</div>
  </div>`

/** A5 prescription sheet — same HTML is used for the on-screen preview and the print window. */
export function rxSheetHTML(rx: Doc): string {
  const meds: RxMed[] = Array.isArray(rx.meds) ? rx.meds.map(normalizeMed) : []
  const rows = meds
    .map(
      (m, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(m.drug)}</strong></td>
        <td>${esc(m.dose)}</td>
        <td>${esc(m.freq)}</td>
        <td>${esc(medDuration(m))}</td>
        <td>${esc(m.instruction)}</td>
      </tr>`,
    )
    .join('')
  const ageSex = [rx.age, rx.gender ? String(rx.gender).charAt(0) : ''].filter(Boolean).join(' / ')
  return `<style>${SHEET_CSS}</style>
  <div class="px-sheet">
    ${sheetHead()}
    <div class="px-meta">
      <div><span>Prescription No.</span><strong>${esc(rx.code || 'Draft')}</strong></div>
      <div><span>Date</span><strong>${esc(fmtDate(rx.date))}</strong></div>
      <div><span>Prescriber</span><strong>${esc(rx.doctor || '—')}</strong></div>
    </div>
    <div class="px-patient">
      <div><span>Patient</span><strong>${esc(rx.patient || '—')}</strong></div>
      <div><span>Patient ID</span>${esc(rx.patientCode || '—')}</div>
      <div><span>Age / Sex</span>${esc(ageSex || '—')}</div>
      ${rx.allergy ? `<div class="px-allergy">⚠ Allergy: ${esc(rx.allergy)}</div>` : ''}
    </div>
    ${rx.complaint ? `<div class="px-line"><span>Chief complaint:</span> ${esc(rx.complaint)}</div>` : ''}
    ${rx.diagnosis ? `<div class="px-line"><span>Diagnosis:</span> ${esc(rx.diagnosis)}</div>` : ''}
    ${rx.note ? `<div class="px-line"><span>Clinical note:</span> ${esc(rx.note)}</div>` : ''}
    <div class="px-rx">℞</div>
    <table class="px-table">
      <thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Freq</th><th>Duration</th><th>Instruction</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No medicines added.</td></tr>'}</tbody>
    </table>
    ${rx.advice ? `<div class="px-advice"><strong>Advice:</strong> ${esc(rx.advice)}</div>` : ''}
    ${rx.followUp ? `<div class="px-line"><span>Review / follow-up:</span> ${esc(fmtDate(rx.followUp))}</div>` : ''}
    <div class="px-sign"><div><div class="px-sign-line"></div><strong>${esc(rx.doctor || '')}</strong><div class="px-sub">Signature</div></div></div>
    <div class="px-foot">This prescription was generated digitally by ${esc(CLINIC.name)}.</div>
  </div>`
}

/** Simple A5 pharmacy bill / receipt. */
export function billReceiptHTML(bill: Doc): string {
  const lines: Doc[] = Array.isArray(bill.lines) ? bill.lines : []
  const rows = lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(l.name)}</strong>${l.batch ? `<br><span style="color:#94a3b8;font-size:7.5pt">Batch ${esc(l.batch)}</span>` : ''}</td>
        <td class="r">${esc(l.qty)}</td>
        <td class="r">${money(l.price)}</td>
        <td class="r">${esc(l.gst ?? 0)}%</td>
        <td class="r">${money(l.amount)}</td>
      </tr>`,
    )
    .join('')
  return `<style>${SHEET_CSS}</style>
  <div class="px-sheet">
    ${sheetHead()}
    <div class="px-meta">
      <div><span>Bill No.</span><strong>${esc(bill.number || '—')}</strong></div>
      <div><span>Date</span><strong>${esc(fmtDate(bill.date))}</strong></div>
      <div><span>Payment</span><strong>${esc(bill.mode || '—')}</strong></div>
    </div>
    <div class="px-patient">
      <div><span>Patient</span><strong>${esc(bill.patient || 'Walk-in Customer')}</strong></div>
      ${bill.patientCode ? `<div><span>Patient ID</span>${esc(bill.patientCode)}</div>` : ''}
    </div>
    <table class="px-table" style="margin-top:10px">
      <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="px-totals">
      <div><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>
      <div><span>GST</span><span>${money(bill.gst)}</span></div>
      ${Number(bill.discount) ? `<div><span>Discount</span><span>− ${money(bill.discount)}</span></div>` : ''}
      <div class="px-grand"><span>Total</span><span>${money(bill.total)}</span></div>
    </div>
    <div class="px-foot">Thank you! Get well soon. · ${esc(CLINIC.phone)}</div>
  </div>`
}

/** Print via a dedicated window so app chrome is never on the sheet. */
export function openPrintWindow(html: string, title: string) {
  const w = window.open('', '_blank', 'width=760,height=920')
  if (!w) return
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="margin:0;background:#fff">${html}</body></html>`,
  )
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

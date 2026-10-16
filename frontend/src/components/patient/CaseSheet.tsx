import { useState } from 'react'
import { Printer } from 'lucide-react'
import { printArea } from '@/lib/print'
import { fmtDate, useList, useSettings, type Doc } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

/**
 * "patients / case sheet" and "case summary" (cms.fig 223:4621, 202:9390): the patient's details, history, the
 * treatment plan, procedures, prescriptions and visits on one printable sheet.
 */
export function CaseSheetDialog({ patient, open, onClose }: { patient: Doc; open: boolean; onClose: () => void }) {
  const { data: settings } = useSettings()
  const [printedOn] = useState(() => new Date().toISOString())
  const code = patient.code
  const treatments = useList('patient_treatments', { patientId: code, sort: 'date', order: 'desc', limit: 50 }, { enabled: open })
  const procedures = useList('patient_procedures', { patientId: code, sort: 'date', order: 'desc', limit: 50 }, { enabled: open })
  const prescriptions = useList('prescriptions', { patientCode: code, sort: 'date', order: 'desc', limit: 10 }, { enabled: open })
  const visits = useList('appointments', { patientCode: code, sort: 'date', order: 'desc', limit: 12 }, { enabled: open })
  const row = (label: string, value: unknown) => (value ? <div><dt className="text-xs text-slate-400">{label}</dt><dd className="text-sm text-slate-800">{String(value)}</dd></div> : null)
  return (
    <Dialog open={open} onClose={onClose} title="Case sheet" subtitle={`${patient.name} · ${code}`} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={printArea} data-testid="case-sheet-print"><Printer className="h-4 w-4" /> Print</Button></>}>
      <div className="print-area space-y-4 bg-white text-slate-800" data-testid="case-sheet">
        <div className="border-b border-slate-200 pb-2 text-center">
          <div className="text-lg font-bold">{String(settings?.clinicName ?? '')}</div>
          <div className="text-xs text-slate-500">CASE SHEET · printed {fmtDate(printedOn)}</div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {row('Patient', `${patient.name} (${code})`)}
          {row('Age / sex', [patient.age && `${patient.age} yrs`, patient.gender].filter(Boolean).join(', '))}
          {row('Mobile', patient.mobile)}
          {row('Blood group', patient.blood)}
          {row('Allergy', patient.allergy || 'None recorded')}
          {row('Medical history', patient.history || 'None recorded')}
          {row('Address', [patient.address, patient.city].filter(Boolean).join(', '))}
          {row('Emergency contact', [patient.emergencyName, patient.emergencyMobile].filter(Boolean).join(' · '))}
          {row('Vitals', patient.vitals && [patient.vitals.bp && `BP ${patient.vitals.bp}`, patient.vitals.glucose && `Glucose ${patient.vitals.glucose}`].filter(Boolean).join(' · '))}
        </dl>
        <Section title="Treatment plan" items={treatments.data?.items} render={(t) => `${fmtDate(t.date)} · ${t.name}${t.tooth ? ` · tooth ${t.tooth}` : ''} · ${t.status}${t.notes ? ` · ${t.notes}` : ''}`} />
        <Section title="Procedures" items={procedures.data?.items} render={(t) => `${fmtDate(t.date)} · ${t.name}${t.tooth ? ` · tooth ${t.tooth}` : ''} · ${t.status}`} />
        <Section title="Prescriptions" items={prescriptions.data?.items} render={(p) => `${fmtDate(p.date)} · ${p.diagnosis || p.code} · ${(p.meds ?? []).map((m: Doc) => m.drug).join(', ')}`} />
        <Section title="Visits" items={visits.data?.items} render={(a) => `${fmtDate(a.date)} ${a.time} · ${a.treatment} · ${a.doctor} · ${a.status}`} />
        <div className="pt-6 text-right text-xs text-slate-400">Doctor's signature ______________________</div>
      </div>
    </Dialog>
  )
}

function Section({ title, items, render }: { title: string; items?: Doc[]; render: (d: Doc) => string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      {!items ? <div className="text-xs text-slate-400">Loading…</div> : !items.length ? <div className="text-xs text-slate-400">None recorded.</div> : (
        <ul className="space-y-0.5 text-sm">{items.map((d) => <li key={d.id}>{render(d)}</li>)}</ul>
      )}
    </div>
  )
}

/** "virtual card" (cms.fig 199:7976): the patient's card to print or send. */
export function VirtualCardDialog({ patient, open, onClose }: { patient: Doc; open: boolean; onClose: () => void }) {
  const { data: settings } = useSettings()
  const text = `${String(settings?.clinicName ?? 'Dentor')} patient card\n${patient.name} · ${patient.code}\nMobile ${patient.mobile}${patient.blood ? ` · Blood ${patient.blood}` : ''}${patient.allergy ? `\nAllergy: ${patient.allergy}` : ''}`
  return (
    <Dialog open={open} onClose={onClose} title="Virtual card" size="sm"
      footer={<>
        <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(text)} data-testid="card-copy">Copy</Button>
        <Button variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}>Share on WhatsApp</Button>
        <Button onClick={printArea} data-testid="card-print"><Printer className="h-4 w-4" /> Print</Button>
      </>}>
      <div className="print-area mx-auto w-full max-w-sm rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow" data-testid="virtual-card">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-100">{String(settings?.clinicName ?? 'Dentor')}</div>
        <div className="mt-4 text-xl font-bold">{patient.name}</div>
        <div className="text-sm text-brand-100">{patient.code}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div><div className="text-brand-200">Mobile</div><div>{patient.mobile}</div></div>
          <div><div className="text-brand-200">Blood group</div><div>{patient.blood || '—'}</div></div>
          {patient.allergy && <div className="col-span-2"><div className="text-brand-200">Allergy</div><div>{patient.allergy}</div></div>}
        </div>
      </div>
    </Dialog>
  )
}

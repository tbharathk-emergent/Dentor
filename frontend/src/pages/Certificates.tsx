import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Plus, Printer, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, todayISO, useCreate, useDelete, useList, type Doc } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput } from '@/components/ui/bits'

const DOCTORS = ['Dr. Vivekanandan M', 'Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']

const TYPES = [
  { key: 'medical', label: 'Medical Certificate' },
  { key: 'fitness', label: 'Dental Fitness Certificate' },
  { key: 'referral', label: 'Referral Letter' },
] as const

type CertType = (typeof TYPES)[number]['key']

export default function Certificates() {
  const [tab, setTab] = useState<string>('all')
  const [q, setQ] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<CertType>('medical')
  const [viewCert, setViewCert] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  const { data, isLoading } = useList('certificates', {
    q, ...(tab !== 'all' ? { type: tab } : {}), sort: 'created_at', order: 'desc',
  })
  const rows = data?.items ?? []
  const remove = useDelete('certificates', { successMessage: 'Certificate deleted' })

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle="Medical certificates, fitness certificates and referral letters"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Certificate
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[{ key: 'all', label: 'All', count: tab === 'all' ? data?.total : undefined }, ...TYPES.map((t) => ({ key: t.key, label: t.label }))]}
      />

      <div className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search patient, certificate no. or doctor…" className="sm:max-w-sm" />
      </div>

      <Card>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : !rows.length ? (
          <EmptyState
            icon={<BadgeCheck className="h-6 w-6" />}
            title="No certificates yet"
            message="Generate a certificate — it stays on record for audits."
            action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New Certificate</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c.id} onClick={() => setViewCert(c)} className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5">
                <span className="w-36 shrink-0 text-[13px] font-bold text-brand-800">{c.code}</span>
                <Avatar name={c.patient} className="hidden sm:flex" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{c.patient}</div>
                  <div className="truncate text-xs text-slate-500">{c.doctor} · {fmtDate(c.date)}</div>
                </div>
                <Badge tone={c.type === 'medical' ? 'blue' : c.type === 'fitness' ? 'green' : 'violet'}>
                  {TYPES.find((t) => t.key === c.type)?.label ?? c.type}
                </Badge>
                <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CertificateDialog open={formOpen} onClose={() => setFormOpen(false)} type={formType} setType={setFormType} />
      <CertificateView cert={viewCert} onClose={() => setViewCert(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null) } }}
        title="Delete certificate?"
        message={deleteTarget ? `${deleteTarget.code} for ${deleteTarget.patient} will be permanently removed.` : ''}
      />
    </div>
  )
}

function CertificateDialog({
  open,
  onClose,
  type,
  setType,
}: {
  open: boolean
  onClose: () => void
  type: CertType
  setType: (t: CertType) => void
}) {
  const [patient, setPatient] = useState<Doc | null>(null)
  const [pq, setPq] = useState('')
  const [showList, setShowList] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const { data: patients } = useList('patients', { q: pq, limit: 8 }, { enabled: open })
  const create = useCreate('certificates', { successMessage: 'Certificate generated' })

  useEffect(() => {
    if (open) {
      setPatient(null); setPq(''); setForm({ date: todayISO(), doctor: DOCTORS[1] })
    }
  }, [open])

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!patient) return toast.error('Choose the patient for this certificate.')
    if (type === 'medical' && !form.reason?.trim()) return toast.error('Enter the medical reason.')
    if (type === 'referral' && !form.referredTo?.trim()) return toast.error('Enter who the patient is referred to.')
    const code = `${type.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    create.mutate(
      {
        code, type, patient: patient.name, patientCode: patient.code,
        age: patient.age, gender: patient.gender, mobile: patient.mobile,
        ...form,
      } as Partial<Doc>,
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Certificate"
      subtitle="Generates a numbered, printable document"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending}>Generate Certificate</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Certificate Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value as CertType)}>
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
        </Field>

        <Field label="Patient" required>
          {patient ? (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
              <Avatar name={patient.name} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{patient.name}</div>
                <div className="text-xs text-slate-500">{patient.code} · {patient.age}/{String(patient.gender || '').charAt(0)}</div>
              </div>
              <Button variant="ghost" size="icon-sm" type="button" onClick={() => setPatient(null)}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="relative">
              <Input value={pq} onChange={(e) => { setPq(e.target.value); setShowList(true) }} onFocus={() => setShowList(true)} placeholder="Search patient…" />
              {showList && (patients?.items?.length ?? 0) > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                  {patients!.items.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setPatient(p); setShowList(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input type="date" value={form.date || ''} onChange={set('date')} />
          </Field>
          <Field label="Issuing Doctor" required>
            <Select value={form.doctor || DOCTORS[1]} onChange={set('doctor')}>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
        </div>

        {type === 'medical' && (
          <>
            <Field label="Medical Reason" required>
              <Textarea value={form.reason || ''} onChange={set('reason')} placeholder="Diagnosis / condition requiring rest" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rest Period">
                <Input value={form.period || ''} onChange={set('period')} placeholder="e.g. 3 days" />
              </Field>
              <Field label="Resume From">
                <Input type="date" value={form.fitDate || ''} onChange={set('fitDate')} />
              </Field>
            </div>
          </>
        )}
        {type === 'fitness' && (
          <>
            <Field label="Fitness Status" required>
              <Select value={form.status || 'Fit to resume normal duties'} onChange={set('status')}>
                {['Fit to resume normal duties', 'Fit with restrictions', 'Requires further review'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Restrictions / Remarks">
              <Textarea value={form.restrictions || ''} onChange={set('restrictions')} placeholder="Optional" />
            </Field>
          </>
        )}
        {type === 'referral' && (
          <>
            <Field label="Referred To" required>
              <Input value={form.referredTo || ''} onChange={set('referredTo')} placeholder="Specialist / hospital name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Urgency">
                <Select value={form.urgency || 'Routine'} onChange={set('urgency')}>
                  {['Routine', 'Priority', 'Urgent'].map((u) => <option key={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label="Purpose">
                <Input value={form.purpose || ''} onChange={set('purpose')} placeholder="e.g. Opinion on impacted 48" />
              </Field>
            </div>
            <Field label="Clinical Summary">
              <Textarea value={form.statement || ''} onChange={set('statement')} placeholder="Relevant findings and treatment so far" />
            </Field>
          </>
        )}
        <Field label="Additional Remarks">
          <Input value={form.remarks || ''} onChange={set('remarks')} placeholder="Optional" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function CertificateView({ cert, onClose }: { cert: Doc | null; onClose: () => void }) {
  if (!cert) return null
  const label = TYPES.find((t) => t.key === cert.type)?.label ?? 'Certificate'
  const body =
    cert.type === 'medical'
      ? `This is to certify that ${cert.patient} (${cert.age}/${String(cert.gender || '').charAt(0)}) was examined and is advised rest for ${cert.period || '—'} due to: ${cert.reason || ''}. The patient may resume duties from ${cert.fitDate ? fmtDate(cert.fitDate) : '—'}.`
      : cert.type === 'fitness'
        ? `This is to certify that ${cert.patient} (${cert.age}/${String(cert.gender || '').charAt(0)}) was examined on ${fmtDate(cert.date)} and found: ${cert.status}. ${cert.restrictions || ''}`
        : `${cert.patient} (${cert.age}/${String(cert.gender || '').charAt(0)}) is referred to ${cert.referredTo} (${cert.urgency}). Purpose: ${cert.purpose || '—'}. ${cert.statement || ''}`

  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    w.document.write(`<html><head><title>${cert.code}</title><style>
      body{font-family:Inter,system-ui,sans-serif;color:#0f172a;padding:48px;font-size:14px;line-height:1.7}
      .head{text-align:center;border-bottom:2px solid #0f766e;padding-bottom:16px;margin-bottom:28px}
      h1{font-size:20px;margin:0;color:#0f766e} .muted{color:#64748b;font-size:12px}
      h2{text-align:center;text-decoration:underline;font-size:16px;margin:24px 0}
      .sig{margin-top:72px;text-align:right}
    </style></head><body>
      <div class="head"><h1>DENTOR Dental Clinic</h1><div class="muted">Thiru.Pathy Dento Facial Centre · No. 6, Ponnagar, Dindigul Road, Manaparai – 621306 · +91 73392 99339</div></div>
      <div style="display:flex;justify-content:space-between" class="muted"><span>No: ${cert.code}</span><span>Date: ${fmtDate(cert.date)}</span></div>
      <h2>${label.toUpperCase()}</h2>
      <p>${body}</p>
      ${cert.remarks ? `<p class="muted">Remarks: ${cert.remarks}</p>` : ''}
      <div class="sig"><b>${cert.doctor}</b><br><span class="muted">Registered Dental Practitioner</span></div>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  return (
    <Dialog
      open={!!cert}
      onClose={onClose}
      title={label}
      subtitle={`${cert.code} · ${cert.patient}`}
      footer={<Button onClick={print}><Printer className="h-4 w-4" /> Print / PDF</Button>}
    >
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">
        <p>{body}</p>
        {cert.remarks && <p className="text-[13px] text-slate-500">Remarks: {cert.remarks}</p>}
        <p className="text-right font-semibold text-slate-900">— {cert.doctor}</p>
      </div>
    </Dialog>
  )
}

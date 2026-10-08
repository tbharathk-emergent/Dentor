import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, Eye, FileSignature, Layers, Pill, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, todayISO, useCreate, useDelete, useList, type Doc } from '@/lib/hooks'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, PageHeader, SearchInput } from '@/components/ui/bits'
import { PatientPicker } from '@/components/rx/PatientPicker'
import { blankMed, medDuration, normalizeMed, openPrintWindow, rxSheetHTML, type RxMed } from '@/components/rx/print'

const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const FREQS = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS']
const INSTRUCTIONS = ['After food', 'Before food', 'With food', 'As directed']
const DUR_UNITS = ['Days', 'Weeks']
const DEFAULT_ADVICE =
  'Take medicines exactly as directed. Do not self-adjust the dose. Contact the clinic if any allergy or unusual symptom occurs.'

/** Common dental drugs (from the DENTOR formulary spec) merged with live pharmacy stock names. */
const COMMON_DRUGS = [
  'Novamox 250 mg C', 'Novamox 500 mg C', 'Moxiclav 375 mg T', 'Moxiclav 625 mg T',
  'Cifran 250 mg T', 'Cifran 500 mg T', 'Metrogyl 200 mg T', 'Metrogyl 400 mg T',
  'Azithral 250 mg T', 'Azithral 500 mg T', 'Doxy-1 100 mg C',
  'Ketorol DT 10 mg T', 'Zerodol-P 100 mg T', 'Zerodol-P 325 mg T', 'Combiflam 325 mg T',
  'Combiflam 400 mg T', 'Dolo 650 mg T', 'Etoshine 90 mg T',
  'Pan 40 mg T', 'Omez 20 mg C', 'Pan-D 40 mg C',
  'Becosules C', 'Limcee 500 mg T', 'Shelcal 500 mg T',
  'Fasigyn 500 mg T', 'Kenacort 0.1% Paste', 'Mucopain 5% Gel', 'Dologel-CT Gel',
  'Candid Mouth Paint 1%', 'Hexidine 0.2% Mouthwash', 'Clohex Mouthrinse',
  'Vantej Paste', 'Thermoseal Tooth Paste', 'Sensoform Tooth Paste',
]

const SEED_COMBOS: { name: string; meds: string[] }[] = [
  { name: 'Combo-1', meds: ['Moxiclav 375 mg T', 'Combiflam 325 mg T', 'Metrogyl 200 mg T'] },
  { name: 'Combo-2', meds: ['Moxiclav 625 mg T', 'Dolo 650 mg T', 'Metrogyl 200 mg T'] },
  { name: 'Combo-3', meds: ['Moxiclav 375 mg T', 'Combiflam 325 mg T', 'Metrogyl 400 mg T'] },
]
let combosSeeded = false

export default function Prescriptions() {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')

  // Compose state
  const [patient, setPatient] = useState<Doc | null>(null)
  const [date, setDate] = useState(todayISO())
  const [doctor, setDoctor] = useState(DOCTORS[0])
  const [complaint, setComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [note, setNote] = useState('')
  const [meds, setMeds] = useState<RxMed[]>([blankMed()])
  const [advice, setAdvice] = useState(DEFAULT_ADVICE)
  const [followUp, setFollowUp] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Dialogs
  const [preview, setPreview] = useState<Doc | null>(null)
  const [comboOpen, setComboOpen] = useState(false)
  const [comboName, setComboName] = useState('')
  const [deleting, setDeleting] = useState<Doc | null>(null)

  // History
  const [histQ, setHistQ] = useState('')
  const [histDoctor, setHistDoctor] = useState('')

  const { data: itemData } = useList('pharmacy_items', { limit: 1000 })
  const combosQ = useList('rx_combos', { limit: 100, sort: 'name', order: 'asc' })
  const historyQ = useList('prescriptions', {
    q: histQ, ...(histDoctor ? { doctor: histDoctor } : {}), sort: 'created_at', order: 'desc', limit: 300,
  })

  const createRx = useCreate('prescriptions')
  const createCombo = useCreate('rx_combos')
  const deleteRx = useDelete('prescriptions', { successMessage: 'Prescription deleted' })

  const drugNames = useMemo(() => {
    const set = new Set<string>(COMMON_DRUGS)
    for (const it of itemData?.items ?? []) if (it.name) set.add(it.name)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [itemData])

  // Seed the three standard combos once, the first time the list comes back empty.
  useEffect(() => {
    if (combosSeeded || !combosQ.data || combosQ.data.total !== 0) return
    combosSeeded = true
    for (const c of SEED_COMBOS) {
      createCombo.mutate({ name: c.name, meds: c.meds.map((drug) => ({ ...blankMed(), drug, dose: '1 tablet', freq: 'BD' })) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combosQ.data])

  const combos = combosQ.data?.items ?? []
  const history = historyQ.data?.items ?? []

  const setMed = (i: number, k: keyof RxMed) => (e: { target: { value: string } }) =>
    setMeds((rows) => rows.map((m, idx) => (idx === i ? { ...m, [k]: e.target.value } : m)))

  const removeMed = (i: number) =>
    setMeds((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [blankMed()]))

  const namedMeds = meds.filter((m) => m.drug.trim())

  const applyCombo = (c: Doc) => {
    const rows: RxMed[] = (Array.isArray(c.meds) ? c.meds : []).map(normalizeMed)
    if (!rows.length) return toast.error('This combo has no medicines.')
    setMeds((prev) => [...prev.filter((m) => m.drug.trim()), ...rows])
    toast.success(`${c.name} applied — review dose and duration`)
  }

  const saveCombo = () => {
    if (!comboName.trim()) return toast.error('Enter a combo name.')
    if (!namedMeds.length) return toast.error('Add at least one medicine before saving a combo.')
    createCombo.mutate(
      { name: comboName.trim(), meds: namedMeds },
      { onSuccess: () => { toast.success(`${comboName.trim()} saved`); setComboOpen(false); setComboName('') } },
    )
  }

  const resetCompose = () => {
    setPatient(null); setDate(todayISO()); setDoctor(DOCTORS[0])
    setComplaint(''); setDiagnosis(''); setNote('')
    setMeds([blankMed()]); setAdvice(DEFAULT_ADVICE); setFollowUp(''); setErrors({})
  }

  const save = () => {
    const errs: Record<string, string> = {}
    if (!patient) errs.patient = 'Select a patient.'
    if (!diagnosis.trim()) errs.diagnosis = 'Enter the diagnosis.'
    if (!namedMeds.length) errs.meds = 'Add at least one medicine.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error(Object.values(errs)[0])
      return
    }
    const payload = {
      patientId: patient!.id, patient: patient!.name, patientCode: patient!.code,
      age: patient!.age, gender: patient!.gender, allergy: patient!.allergy || '',
      date, doctor, complaint, diagnosis, note,
      meds: namedMeds, advice, followUp, status: 'Signed',
    }
    createRx.mutate(payload as Partial<Doc>, {
      onSuccess: (rx) => {
        toast.success(`Prescription ${(rx as Doc).code} signed & saved`)
        setPreview(rx as Doc)
        resetCompose()
      },
    })
  }

  const repeat = (r: Doc) => {
    setPatient({
      id: r.patientId, name: r.patient, code: r.patientCode,
      age: r.age, gender: r.gender, allergy: r.allergy,
    } as Doc)
    setDoctor(r.doctor || DOCTORS[0])
    setComplaint(r.complaint || ''); setDiagnosis(r.diagnosis || ''); setNote(r.note || '')
    setMeds(Array.isArray(r.meds) && r.meds.length ? r.meds.map(normalizeMed) : [blankMed()])
    setAdvice(r.advice || DEFAULT_ADVICE)
    setFollowUp(''); setDate(todayISO()); setErrors({})
    setTab('compose')
    toast.success(`Medicines copied — new prescription for ${r.patient}`)
  }

  const histColumns: Column<Doc>[] = [
    {
      key: 'code', header: 'Prescription',
      cell: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-brand-700">{r.code}</div>
          <div className="text-xs text-slate-400">{fmtDate(r.date)}</div>
        </div>
      ),
    },
    {
      key: 'patient', header: 'Patient',
      cell: (r) => (
        <div>
          <div className="text-sm font-semibold text-slate-800">{r.patient}</div>
          <div className="text-xs text-slate-500">
            {r.patientCode}{r.age ? ` · ${r.age}/${String(r.gender || '').charAt(0)}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'doctor', header: 'Prescriber', cell: (r) => <span className="text-[13px] text-slate-600">{r.doctor}</span> },
    { key: 'diagnosis', header: 'Diagnosis', cell: (r) => <span className="block max-w-[220px] truncate text-[13px] text-slate-700">{r.diagnosis || '—'}</span> },
    { key: 'meds', header: 'Meds', align: 'center', cell: (r) => <Badge tone="slate">{Array.isArray(r.meds) ? r.meds.length : 0}</Badge> },
    {
      key: 'status', header: 'Status',
      cell: (r) => <Badge tone={r.status === 'Signed' ? 'green' : statusTone(r.status)} dot>{r.status || '—'}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" title="View & print" onClick={(e) => { e.stopPropagation(); setPreview(r) }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Repeat for same patient" onClick={(e) => { e.stopPropagation(); repeat(r) }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Delete" className="text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setDeleting(r) }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="E-Prescription"
        subtitle="Safe, legible and auditable digital prescribing"
        actions={
          <Button onClick={() => { resetCompose(); setTab('compose') }}>
            <FileSignature className="h-4 w-4" /> New Prescription
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => setTab(k as 'compose' | 'history')}
        tabs={[
          { key: 'compose', label: 'Compose' },
          { key: 'history', label: 'History', count: historyQ.data?.total },
        ]}
      />

      {tab === 'compose' ? (
        <div className="space-y-4">
          {/* Patient & clinical */}
          <Card>
            <CardHeader title="Patient & Clinical" subtitle="The prescription is linked to the selected patient record." />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Patient" required error={errors.patient} className="sm:col-span-2">
                <PatientPicker value={patient} onSelect={setPatient} onClear={() => setPatient(null)} />
              </Field>
              {patient && (
                <div
                  className={`sm:col-span-2 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] ${
                    patient.allergy
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">
                      {patient.age ? `${patient.age} yrs` : 'Age not recorded'}
                      {patient.gender ? ` · ${patient.gender}` : ''} ·{' '}
                      {patient.allergy ? `Allergy: ${patient.allergy}` : 'No known drug allergy'}
                    </span>
                    {patient.history ? <span className="block text-xs opacity-80">History: {patient.history}</span> : null}
                  </div>
                </div>
              )}
              <Field label="Date" required>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Prescriber">
                <Select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                  {DOCTORS.map((d) => <option key={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Chief Complaint">
                <Input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Pain in lower right molar" />
              </Field>
              <Field label="Diagnosis / Indication" required error={errors.diagnosis}>
                <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Irreversible pulpitis · 46" />
              </Field>
              <Field label="Clinical Notes" className="sm:col-span-2">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[42px]" placeholder="Relevant findings and prescribing rationale (optional)" />
              </Field>
            </CardBody>
          </Card>

          {/* Medicines */}
          <Card>
            <CardHeader
              title="Medicines"
              subtitle="Drug, dose, frequency, duration and directions."
              actions={
                <Button variant="secondary" size="sm" onClick={() => setMeds((m) => [...m, blankMed()])}>
                  <Plus className="h-4 w-4" /> Add Medicine
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {errors.meds && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{errors.meds}</p>}
              {meds.map((m, i) => (
                <div key={i} className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-12 lg:gap-3">
                    <Field label="Medicine" className="col-span-2 pr-8 lg:col-span-4 lg:pr-0">
                      <Input list="rx-drug-names" value={m.drug} onChange={setMed(i, 'drug')} placeholder="Search medicine" className="bg-white" />
                    </Field>
                    <Field label="Dose" className="lg:col-span-2">
                      <Input value={m.dose} onChange={setMed(i, 'dose')} placeholder="1 tablet" className="bg-white" />
                    </Field>
                    <Field label="Frequency" className="lg:col-span-2">
                      <Select value={m.freq} onChange={setMed(i, 'freq')} className="bg-white">
                        {FREQS.map((f) => <option key={f}>{f}</option>)}
                      </Select>
                    </Field>
                    <Field label="Duration" className="lg:col-span-2">
                      <div className="flex gap-1.5">
                        <Input type="number" min={1} value={m.days} onChange={setMed(i, 'days')} className="w-14 shrink-0 bg-white px-2 text-center" />
                        <div className="min-w-0 flex-1">
                          <Select value={m.unit} onChange={setMed(i, 'unit')} className="bg-white">
                            {DUR_UNITS.map((u) => <option key={u}>{u}</option>)}
                          </Select>
                        </div>
                      </div>
                    </Field>
                    <Field label="Instruction" className="lg:col-span-2">
                      <Select value={m.instruction} onChange={setMed(i, 'instruction')} className="bg-white">
                        {INSTRUCTIONS.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Button
                    variant="ghost" size="icon-sm" aria-label="Remove medicine"
                    className="absolute right-1.5 top-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeMed(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <datalist id="rx-drug-names">
                {drugNames.map((n) => <option key={n} value={n} />)}
              </datalist>

              {/* Combos */}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Layers className="h-3.5 w-3.5" /> Combos
                </span>
                {combos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => applyCombo(c)}
                    title={(Array.isArray(c.meds) ? c.meds : []).map((x: Doc) => x.drug).join(' + ')}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
                  >
                    {c.name}
                  </button>
                ))}
                {!combos.length && <span className="text-xs text-slate-400">No combos saved yet.</span>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setComboOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Save current as combo
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Advice & follow-up */}
          <Card>
            <CardHeader title="Advice & Follow-up" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Patient Advice" className="sm:col-span-2">
                <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} className="min-h-[64px]" />
              </Field>
              <Field label="Follow-up / Review Date">
                <Input type="date" value={followUp} min={todayISO()} onChange={(e) => setFollowUp(e.target.value)} />
              </Field>
            </CardBody>
          </Card>

          <div className="flex flex-col-reverse gap-2 pb-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={resetCompose}>Clear</Button>
            <Button onClick={save} loading={createRx.isPending}>
              <FileSignature className="h-4 w-4" /> Sign & Save Prescription
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <SearchInput value={histQ} onChange={setHistQ} placeholder="Search patient, code, diagnosis…" className="min-w-0 flex-1 sm:max-w-sm" />
            <Select value={histDoctor} onChange={(e) => setHistDoctor(e.target.value)} className="w-36">
              <option value="">All Prescribers</option>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <DataTable
            rows={history}
            columns={histColumns}
            rowKey={(r) => r.id}
            loading={historyQ.isLoading}
            onRowClick={(r) => setPreview(r)}
            empty={
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title={histQ || histDoctor ? 'No prescriptions match your search' : 'No prescriptions yet'}
                message={histQ || histDoctor ? 'Try a different name, code or filter.' : 'Compose and sign your first e-prescription.'}
                action={
                  <Button size="sm" onClick={() => setTab('compose')}>
                    <Pill className="h-4 w-4" /> New Prescription
                  </Button>
                }
              />
            }
            mobileCard={(r) => (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{r.patient}</span>
                    <Badge tone={r.status === 'Signed' ? 'green' : statusTone(r.status)} dot>{r.status}</Badge>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {r.code} · {fmtDate(r.date)} · {r.doctor}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {r.diagnosis || '—'} · {Array.isArray(r.meds) ? r.meds.length : 0} meds
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); repeat(r) }} aria-label="Repeat">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); setDeleting(r) }} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {/* Print preview */}
      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Prescription Preview"
        subtitle={preview ? `${preview.code} · ${preview.patient}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
            {preview && (
              <Button variant="secondary" onClick={() => { repeat(preview); setPreview(null) }}>
                <RotateCcw className="h-4 w-4" /> Repeat
              </Button>
            )}
            <Button onClick={() => preview && openPrintWindow(rxSheetHTML(preview), String(preview.code || 'Prescription'))}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        }
      >
        {preview && (
          <div className="overflow-x-auto rounded-xl bg-slate-100 p-2 sm:p-4">
            <div dangerouslySetInnerHTML={{ __html: rxSheetHTML(preview) }} />
          </div>
        )}
      </Dialog>

      {/* Save combo */}
      <Dialog
        open={comboOpen}
        onClose={() => setComboOpen(false)}
        title="Save Medicine Combo"
        subtitle="Reuse the current medicine list with one tap."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setComboOpen(false)}>Cancel</Button>
            <Button onClick={saveCombo} loading={createCombo.isPending}>Save Combo</Button>
          </>
        }
      >
        <Field label="Combo Name" required>
          <Input value={comboName} onChange={(e) => setComboName(e.target.value)} placeholder="e.g. Post extraction combo" autoFocus />
        </Field>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
          {namedMeds.length
            ? namedMeds.map((m) => `${m.drug} (${m.freq} · ${medDuration(m)})`).join(', ')
            : 'No medicines in the current prescription yet.'}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteRx.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
        loading={deleteRx.isPending}
        title="Delete this prescription?"
        message={deleting ? `${deleting.code} · ${deleting.patient} · ${fmtDate(deleting.date)}. This cannot be undone.` : ''}
        confirmLabel="Delete Prescription"
      />
    </div>
  )
}

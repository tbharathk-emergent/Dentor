import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  AlertTriangle,
  CalendarPlus,
  Droplets,
  FileImage,
  Pencil,
  Percent,
  Plus,
  Ruler,
  Save,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import { fmtDate, todayISO, useCreate, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, StatCard } from '@/components/ui/bits'
import { PatientPicker } from '@/components/clinical/PatientPicker'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Periodontal model                                                   */
/* ------------------------------------------------------------------ */

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const SITES = ['MB', 'B', 'DB', 'ML', 'L', 'DL']
const FURCATIONS = ['0', 'I', 'II', 'III']

interface PerioTooth {
  pd: number[]
  rec: number[]
  bop: boolean[]
  plaque: boolean[]
  mobility: number
  furcation: string
}

interface PerioData {
  teeth: Record<string, PerioTooth>
  assessment: {
    diagnosis: string
    stage: string
    grade: string
    risk: string
    smoking: string
    diabetes: string
    notes: string
  }
}

const six = <T,>(v: T): T[] => [v, v, v, v, v, v]

function normTooth(t?: Partial<PerioTooth>): PerioTooth {
  return {
    pd: Array.from({ length: 6 }, (_, i) => Number(t?.pd?.[i] ?? 2) || 0),
    rec: Array.from({ length: 6 }, (_, i) => Number(t?.rec?.[i] ?? 0) || 0),
    bop: Array.from({ length: 6 }, (_, i) => !!t?.bop?.[i]),
    plaque: Array.from({ length: 6 }, (_, i) => !!t?.plaque?.[i]),
    mobility: Number(t?.mobility ?? 0) || 0,
    furcation: t?.furcation || '0',
  }
}

function emptyPerio(): PerioData {
  return {
    teeth: {},
    assessment: {
      diagnosis: '',
      stage: 'Stage I',
      grade: 'Grade A',
      risk: 'Low',
      smoking: 'Non-smoker',
      diabetes: 'No diabetes',
      notes: '',
    },
  }
}

function normalizePerio(d: any): PerioData {
  const base = emptyPerio()
  const teeth: Record<string, PerioTooth> = {}
  for (const [k, v] of Object.entries(d?.teeth ?? {})) teeth[k] = normTooth(v as Partial<PerioTooth>)
  return { teeth, assessment: { ...base.assessment, ...(d?.assessment ?? {}) } }
}

const toothLabel = (n: number) => {
  const quadrant = ['Upper Right', 'Upper Left', 'Lower Left', 'Lower Right'][Math.floor(n / 10) - 1] || ''
  const names = [
    'Central Incisor', 'Lateral Incisor', 'Canine', 'First Premolar',
    'Second Premolar', 'First Molar', 'Second Molar', 'Third Molar',
  ]
  return `${quadrant} ${names[(n % 10) - 1] || ''}`.trim()
}

const pdTone = (v: number) =>
  v >= 5
    ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400'
    : v === 4
      ? 'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-400'
      : ''

/* ------------------------------------------------------------------ */
/* Orthodontic model                                                   */
/* ------------------------------------------------------------------ */

const ORTHO_STAGES = ['Records & Diagnosis', 'Alignment', 'Levelling', 'Space Closure', 'Finishing', 'Retention']
const RECORD_TYPES = ['OPG', 'Lateral Cephalogram', 'Extraoral Photos', 'Intraoral Photos', 'Study Models / Scan', 'CBCT', 'Consent / Document']
const VISIT_TYPES = ['Routine Adjustment', 'Archwire Change', 'Bonding / Rebonding', 'Emergency Visit', 'Records Review']

/** Steiner / Tweed norms: key, label, norm value. ANB is auto-computed. */
const CEPH_ROWS: Array<{ key: string; label: string; norm: number }> = [
  { key: 'SNA', label: 'SNA (°)', norm: 82 },
  { key: 'SNB', label: 'SNB (°)', norm: 80 },
  { key: 'ANB', label: 'ANB (°) — auto', norm: 2 },
  { key: 'FMA', label: 'FMA (Tweed, °)', norm: 25 },
  { key: 'IMPA', label: 'IMPA (Tweed, °)', norm: 90 },
  { key: 'U1NA', label: 'U1–NA (°)', norm: 22 },
  { key: 'L1NB', label: 'L1–NB (°)', norm: 25 },
]

interface OrthoVisit {
  id: string
  date: string
  title: string
  note: string
}

interface OrthoData {
  exam: { chief: string; skeletal: string; growth: string; profile: string }
  occlusion: {
    overjet: string
    overbite: string
    molarR: string
    molarL: string
    canineR: string
    canineL: string
    midline: string
    crossbite: string
    crowdingUpper: string
    crowdingLower: string
  }
  ceph: Record<string, number>
  plan: { appliance: string; extractions: string; retention: string; stages: string[] }
  visits: OrthoVisit[]
  records: Array<{ id: string; type: string; date: string }>
}

function emptyOrtho(): OrthoData {
  return {
    exam: { chief: '', skeletal: 'Class I', growth: 'Average', profile: 'Straight' },
    occlusion: {
      overjet: '', overbite: '', molarR: 'Class I', molarL: 'Class I',
      canineR: 'Class I', canineL: 'Class I', midline: '', crossbite: '',
      crowdingUpper: '', crowdingLower: '',
    },
    ceph: { SNA: 82, SNB: 80, FMA: 25, IMPA: 90, U1NA: 22, L1NB: 25 },
    plan: { appliance: '', extractions: '', retention: '', stages: ['active', '', '', '', '', ''] },
    visits: [],
    records: [],
  }
}

function normalizeOrtho(d: any): OrthoData {
  const base = emptyOrtho()
  return {
    exam: { ...base.exam, ...(d?.exam ?? {}) },
    occlusion: { ...base.occlusion, ...(d?.occlusion ?? {}) },
    ceph: { ...base.ceph, ...(d?.ceph ?? {}) },
    plan: {
      ...base.plan,
      ...(d?.plan ?? {}),
      stages: Array.from({ length: 6 }, (_, i) => d?.plan?.stages?.[i] ?? base.plan.stages[i]),
    },
    visits: Array.isArray(d?.visits) ? d.visits : [],
    records: Array.isArray(d?.records) ? d.records : [],
  }
}

const fmtWhen = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ClinicalCharts() {
  const [patient, setPatient] = useState<Doc | null>(null)
  const [tab, setTab] = useState<'perio' | 'ortho'>('perio')
  const [perio, setPerio] = useState<PerioData>(emptyPerio)
  const [ortho, setOrtho] = useState<OrthoData>(emptyOrtho)
  const [savedAt, setSavedAt] = useState<{ perio?: string; ortho?: string }>({})

  const pid = patient?.id || ''
  const perioQ = useList('charts', { patientId: pid, type: 'perio' }, { enabled: !!pid })
  const orthoQ = useList('charts', { patientId: pid, type: 'ortho' }, { enabled: !!pid })
  const perioDoc = (perioQ.data?.items ?? []).find((c) => c.patientId === pid)
  const orthoDoc = (orthoQ.data?.items ?? []).find((c) => c.patientId === pid)

  useEffect(() => {
    setPerio(perioDoc?.data ? normalizePerio(perioDoc.data) : emptyPerio())
    setSavedAt((s) => ({ ...s, perio: undefined }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, perioDoc?.id])

  useEffect(() => {
    setOrtho(orthoDoc?.data ? normalizeOrtho(orthoDoc.data) : emptyOrtho())
    setSavedAt((s) => ({ ...s, ortho: undefined }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, orthoDoc?.id])

  const create = useCreate('charts')
  const update = useUpdate('charts')
  const saving = create.isPending || update.isPending

  const persist = (type: 'perio' | 'ortho', data: PerioData | OrthoData, msg: string) => {
    if (!patient) {
      toast.error('Select a patient first')
      return
    }
    const existing = type === 'perio' ? perioDoc : orthoDoc
    const payload = { patientId: patient.id, patientCode: patient.code || '', patientName: patient.name, type, data }
    const done = () => {
      setSavedAt((s) => ({ ...s, [type]: new Date().toISOString() }))
      toast.success(msg)
    }
    if (existing) update.mutate({ id: existing.id, ...payload }, { onSuccess: done })
    else create.mutate(payload as Partial<Doc>, { onSuccess: done })
  }

  const chartsLoading = !!pid && (tab === 'perio' ? perioQ.isLoading : orthoQ.isLoading)
  const lastSaved =
    tab === 'perio'
      ? savedAt.perio ?? perioDoc?.updated_at
      : savedAt.ortho ?? orthoDoc?.updated_at

  return (
    <div>
      <PageHeader
        title="Clinical Charts"
        subtitle="Periodontal and orthodontic charting, assessment and treatment monitoring"
        actions={
          patient && (
            <div className="flex items-center gap-3">
              {lastSaved && <span className="hidden text-xs text-slate-400 sm:block">Last saved · {fmtWhen(lastSaved)}</span>}
              <Button
                loading={saving}
                onClick={() =>
                  tab === 'perio'
                    ? persist('perio', perio, 'Periodontal chart saved')
                    : persist('ortho', ortho, 'Orthodontic chart saved')
                }
              >
                <Save className="h-4 w-4" /> Save Chart
              </Button>
            </div>
          )
        }
      />

      {/* Patient band */}
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PatientPicker value={patient} onChange={setPatient} className="sm:w-80" />
          {patient ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={patient.name} src={patient.photo} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{patient.name}</div>
                  <div className="text-xs text-slate-500">
                    {patient.code} · {patient.age}/{String(patient.gender || '').charAt(0)} · {patient.mobile}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-400">Dentist</span>{' '}
                <span className="font-semibold text-slate-700">{patient.doctor || '—'}</span>
              </div>
              {patient.allergy && patient.allergy !== 'None' && (
                <Badge tone="red" dot>
                  <AlertTriangle className="h-3 w-3" /> Allergy: {patient.allergy}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">Pick a patient to open their periodontal and orthodontic charts.</p>
          )}
        </div>
      </Card>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => setTab(k as 'perio' | 'ortho')}
        tabs={[
          { key: 'perio', label: 'Periodontal Chart' },
          { key: 'ortho', label: 'Orthodontic Chart' },
        ]}
      />

      {!patient ? (
        <Card>
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title="No patient selected"
            message="Search and select a patient above to begin periodontal or orthodontic charting."
          />
        </Card>
      ) : chartsLoading ? (
        <ListSkeleton rows={6} />
      ) : tab === 'perio' ? (
        <PerioSection data={perio} onChange={setPerio} />
      ) : (
        <OrthoSection
          data={ortho}
          onChange={setOrtho}
          onPersist={(next, msg) => {
            setOrtho(next)
            persist('ortho', next, msg)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Periodontal section                                                 */
/* ------------------------------------------------------------------ */

function PerioSection({ data, onChange }: { data: PerioData; onChange: (d: PerioData) => void }) {
  const [tooth, setTooth] = useState(16)
  const t = normTooth(data.teeth[tooth])

  const stats = useMemo(() => {
    const teeth = Object.values(data.teeth)
    let sites = 0
    let bop = 0
    let plaque = 0
    let deep = 0
    let pdSum = 0
    for (const tt of teeth) {
      for (let i = 0; i < 6; i++) {
        sites++
        pdSum += tt.pd[i] || 0
        if (tt.bop[i]) bop++
        if (tt.plaque[i]) plaque++
        if ((tt.pd[i] || 0) >= 5) deep++
      }
    }
    return {
      charted: teeth.length,
      bop: sites ? Math.round((bop / sites) * 100) : 0,
      plaque: sites ? Math.round((plaque / sites) * 100) : 0,
      deep,
      avg: sites ? (pdSum / sites).toFixed(1) : '0.0',
    }
  }, [data.teeth])

  const upd = (fn: (t: PerioTooth) => PerioTooth) =>
    onChange({ ...data, teeth: { ...data.teeth, [tooth]: fn(normTooth(data.teeth[tooth])) } })

  const setAssessment = (k: keyof PerioData['assessment']) => (e: { target: { value: string } }) =>
    onChange({ ...data, assessment: { ...data.assessment, [k]: e.target.value } })

  const toothState = (n: number) => {
    const tt = data.teeth[n]
    if (!tt) return 'none'
    const max = Math.max(...normTooth(tt).pd)
    return max >= 5 ? 'deep' : max === 4 ? 'mod' : 'ok'
  }

  const cal = t.pd.map((pd, i) => Math.max(0, (pd || 0) + (t.rec[i] || 0)))

  const toothStrip = (teeth: number[], label: string) => (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex gap-1">
        {teeth.map((n) => {
          const st = toothState(n)
          const active = n === tooth
          return (
            <button
              key={n}
              onClick={() => setTooth(n)}
              title={`Tooth ${n} · ${toothLabel(n)}`}
              className={cn(
                'h-9 w-9 shrink-0 rounded-lg border text-[12px] font-semibold transition',
                active
                  ? 'border-brand-700 bg-brand-700 text-white shadow-sm'
                  : st === 'deep'
                    ? 'border-red-300 bg-red-50 text-red-700 hover:border-red-400'
                    : st === 'mod'
                      ? 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
                      : st === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Live KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Bleeding on Probing" value={`${stats.bop}%`} icon={<Droplets className="h-5 w-5" />} accent="red" hint="Full-mouth score" />
        <StatCard label="Plaque Score" value={`${stats.plaque}%`} icon={<Percent className="h-5 w-5" />} accent="amber" hint="O'Leary index" />
        <StatCard label="Sites ≥5 mm" value={stats.deep} icon={<Activity className="h-5 w-5" />} accent={stats.deep > 10 ? 'red' : 'brand'} hint={stats.deep > 10 ? 'Clinical attention' : 'Monitor pockets'} />
        <StatCard label="Average PD" value={`${stats.avg} mm`} icon={<Ruler className="h-5 w-5" />} accent="blue" hint={`${stats.charted} of 32 teeth charted`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Tooth strip */}
          <Card>
            <CardHeader
              title="Select Tooth"
              subtitle="FDI numbering · colour shows the deepest recorded pocket"
            />
            <CardBody className="space-y-2 overflow-x-auto">
              {toothStrip(UPPER_TEETH, 'Upper')}
              {toothStrip(LOWER_TEETH, 'Lower')}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-50" /> 1–3 mm Healthy</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-50" /> 4 mm Moderate</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-50" /> ≥5 mm Deep pocket</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-slate-200 bg-white" /> Not charted</span>
              </div>
            </CardBody>
          </Card>

          {/* Six-site editor */}
          <Card>
            <CardHeader
              title={`Tooth ${tooth} — six-site examination`}
              subtitle={`${toothLabel(tooth)} · CAL auto-calculates as max(0, PD + REC)`}
              actions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => upd((tt) => ({ ...tt, pd: six(3), rec: six(0), bop: six(false), plaque: six(false) }))}
                  >
                    Set healthy (3 mm)
                  </Button>
                  {data.teeth[tooth] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const teeth = { ...data.teeth }
                        delete teeth[tooth]
                        onChange({ ...data, teeth })
                        toast.success(`Tooth ${tooth} chart entry cleared`)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              }
            />
            <CardBody>
              <div className="overflow-x-auto">
                <div className="grid min-w-[420px] grid-cols-[76px_repeat(6,minmax(48px,1fr))] items-center gap-1.5">
                  <span />
                  {SITES.map((s) => (
                    <span key={s} className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {s}
                    </span>
                  ))}

                  <span className="text-[11px] font-semibold text-slate-600">PD (mm)</span>
                  {SITES.map((_, i) => (
                    <input
                      key={`pd${i}`}
                      type="number"
                      min={0}
                      max={15}
                      value={t.pd[i]}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(15, Number(e.target.value) || 0))
                        upd((tt) => ({ ...tt, pd: tt.pd.map((x, j) => (j === i ? v : x)) }))
                      }}
                      className={cn(
                        'h-9 w-full rounded-lg border border-slate-300 bg-white text-center text-sm font-semibold text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                        pdTone(t.pd[i]),
                      )}
                    />
                  ))}

                  <span className="text-[11px] font-semibold text-slate-600">REC (mm)</span>
                  {SITES.map((_, i) => (
                    <input
                      key={`rec${i}`}
                      type="number"
                      min={0}
                      max={15}
                      value={t.rec[i]}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(15, Number(e.target.value) || 0))
                        upd((tt) => ({ ...tt, rec: tt.rec.map((x, j) => (j === i ? v : x)) }))
                      }}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white text-center text-sm text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  ))}

                  <span className="text-[11px] font-semibold text-slate-600">CAL</span>
                  {cal.map((v, i) => (
                    <span
                      key={`cal${i}`}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold',
                        v >= 5 ? 'text-red-600' : v === 4 ? 'text-amber-600' : 'text-slate-600',
                      )}
                    >
                      {v}
                    </span>
                  ))}

                  <span className="text-[11px] font-semibold text-slate-600">BOP</span>
                  {SITES.map((_, i) => (
                    <button
                      key={`bop${i}`}
                      onClick={() => upd((tt) => ({ ...tt, bop: tt.bop.map((x, j) => (j === i ? !x : x)) }))}
                      aria-pressed={t.bop[i]}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded-lg border text-[11px] font-semibold transition',
                        t.bop[i]
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-slate-300 bg-white text-slate-400 hover:border-red-300 hover:text-red-500',
                      )}
                    >
                      {t.bop[i] ? 'Yes' : '—'}
                    </button>
                  ))}

                  <span className="text-[11px] font-semibold text-slate-600">Plaque</span>
                  {SITES.map((_, i) => (
                    <button
                      key={`plq${i}`}
                      onClick={() => upd((tt) => ({ ...tt, plaque: tt.plaque.map((x, j) => (j === i ? !x : x)) }))}
                      aria-pressed={t.plaque[i]}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded-lg border text-[11px] font-semibold transition',
                        t.plaque[i]
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-slate-300 bg-white text-slate-400 hover:border-amber-300 hover:text-amber-600',
                      )}
                    >
                      {t.plaque[i] ? 'Yes' : '—'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
                <Field label="Mobility">
                  <Select value={String(t.mobility)} onChange={(e) => upd((tt) => ({ ...tt, mobility: Number(e.target.value) }))}>
                    {[0, 1, 2, 3].map((m) => (
                      <option key={m} value={m}>Grade {m}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Furcation">
                  <Select value={t.furcation} onChange={(e) => upd((tt) => ({ ...tt, furcation: e.target.value }))}>
                    {FURCATIONS.map((f) => (
                      <option key={f} value={f}>{f === '0' ? '0 — None' : `Grade ${f}`}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Assessment */}
        <Card className="self-start">
          <CardHeader title="Diagnosis & Risk Assessment" subtitle="2017 World Workshop staging and grading" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Periodontal Diagnosis" className="sm:col-span-2">
              <Input
                value={data.assessment.diagnosis}
                onChange={setAssessment('diagnosis')}
                placeholder="e.g. Localized Stage II Grade B periodontitis"
              />
            </Field>
            <Field label="Stage">
              <Select value={data.assessment.stage} onChange={setAssessment('stage')}>
                {['Stage I', 'Stage II', 'Stage III', 'Stage IV'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Grade">
              <Select value={data.assessment.grade} onChange={setAssessment('grade')}>
                {['Grade A', 'Grade B', 'Grade C'].map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="Current Risk">
              <Select value={data.assessment.risk} onChange={setAssessment('risk')}>
                {['Low', 'Moderate', 'High'].map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Smoking">
              <Select value={data.assessment.smoking} onChange={setAssessment('smoking')}>
                {['Non-smoker', 'Former smoker', '<10 cigarettes/day', '≥10 cigarettes/day'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Diabetes / HbA1c" className="sm:col-span-2">
              <Select value={data.assessment.diabetes} onChange={setAssessment('diabetes')}>
                {['No diabetes', 'Controlled (HbA1c < 7%)', 'Uncontrolled (HbA1c ≥ 7%)', 'Not assessed'].map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Clinical Notes" className="sm:col-span-2">
              <Textarea
                value={data.assessment.notes}
                onChange={setAssessment('notes')}
                placeholder="Treatment needs, prognosis, recall interval…"
              />
            </Field>
            <div
              className={cn(
                'rounded-lg px-3 py-2.5 text-[13px] sm:col-span-2',
                stats.deep > 10 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {stats.deep > 10
                ? 'Multiple deep sites detected. Review radiographs, tooth prognosis and periodontal treatment needs.'
                : 'Findings are within the configured monitoring threshold.'}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Orthodontic section                                                 */
/* ------------------------------------------------------------------ */

function OrthoSection({
  data,
  onChange,
  onPersist,
}: {
  data: OrthoData
  onChange: (d: OrthoData) => void
  onPersist: (d: OrthoData, msg: string) => void
}) {
  const [sub, setSub] = useState('exam')
  const [visitOpen, setVisitOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<OrthoVisit | null>(null)
  const [deleteVisit, setDeleteVisit] = useState<OrthoVisit | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)

  const setExam = (k: keyof OrthoData['exam']) => (e: { target: { value: string } }) =>
    onChange({ ...data, exam: { ...data.exam, [k]: e.target.value } })
  const setOcc = (k: keyof OrthoData['occlusion']) => (e: { target: { value: string } }) =>
    onChange({ ...data, occlusion: { ...data.occlusion, [k]: e.target.value } })
  const setPlan = (k: 'appliance' | 'extractions' | 'retention') => (e: { target: { value: string } }) =>
    onChange({ ...data, plan: { ...data.plan, [k]: e.target.value } })

  const anb = Math.round(((data.ceph.SNA ?? 0) - (data.ceph.SNB ?? 0)) * 10) / 10
  const cephValue = (key: string) => (key === 'ANB' ? anb : data.ceph[key] ?? 0)

  const doneCount = data.plan.stages.filter((s) => s === 'done').length
  const activeIdx = data.plan.stages.findIndex((s) => s === 'active')

  return (
    <div className="space-y-4">
      <Tabs
        value={sub}
        onChange={setSub}
        tabs={[
          { key: 'exam', label: 'Exam' },
          { key: 'occlusion', label: 'Occlusion' },
          { key: 'ceph', label: 'Ceph' },
          { key: 'plan', label: 'Plan' },
          { key: 'progress', label: 'Progress', count: data.visits.length },
          { key: 'records', label: 'Records', count: data.records.length },
        ]}
      />

      {sub === 'exam' && (
        <Card>
          <CardHeader title="Clinical Examination" subtitle="Chief complaint and skeletal assessment" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Chief Complaint" className="sm:col-span-3">
              <Textarea
                value={data.exam.chief}
                onChange={setExam('chief')}
                placeholder="e.g. Forwardly placed upper front teeth, spacing…"
              />
            </Field>
            <Field label="Skeletal Class">
              <Select value={data.exam.skeletal} onChange={setExam('skeletal')}>
                {['Class I', 'Class II', 'Class III'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Growth Pattern">
              <Select value={data.exam.growth} onChange={setExam('growth')}>
                {['Average', 'Horizontal', 'Vertical'].map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="Facial Profile">
              <Select value={data.exam.profile} onChange={setExam('profile')}>
                {['Straight', 'Convex', 'Concave'].map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>
      )}

      {sub === 'occlusion' && (
        <Card>
          <CardHeader title="Occlusion" subtitle="Static occlusal relationships and arch analysis" />
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Overjet (mm)">
              <Input type="number" step="0.5" value={data.occlusion.overjet} onChange={setOcc('overjet')} placeholder="2" />
            </Field>
            <Field label="Overbite (mm)">
              <Input type="number" step="0.5" value={data.occlusion.overbite} onChange={setOcc('overbite')} placeholder="2" />
            </Field>
            <Field label="Molar Relation — Right">
              <Select value={data.occlusion.molarR} onChange={setOcc('molarR')}>
                {['Class I', 'Class II div 1', 'Class II div 2', 'Class III'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Molar Relation — Left">
              <Select value={data.occlusion.molarL} onChange={setOcc('molarL')}>
                {['Class I', 'Class II div 1', 'Class II div 2', 'Class III'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Canine Relation — Right">
              <Select value={data.occlusion.canineR} onChange={setOcc('canineR')}>
                {['Class I', 'Class II', 'Class III'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Canine Relation — Left">
              <Select value={data.occlusion.canineL} onChange={setOcc('canineL')}>
                {['Class I', 'Class II', 'Class III'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Dental Midline">
              <Input value={data.occlusion.midline} onChange={setOcc('midline')} placeholder="Coincident / shifted 1 mm left" />
            </Field>
            <Field label="Crossbite">
              <Input value={data.occlusion.crossbite} onChange={setOcc('crossbite')} placeholder="None / posterior right" />
            </Field>
            <Field label="Crowding — Upper (mm)">
              <Input type="number" step="0.5" value={data.occlusion.crowdingUpper} onChange={setOcc('crowdingUpper')} placeholder="0" />
            </Field>
            <Field label="Crowding — Lower (mm)">
              <Input type="number" step="0.5" value={data.occlusion.crowdingLower} onChange={setOcc('crowdingLower')} placeholder="0" />
            </Field>
          </CardBody>
        </Card>
      )}

      {sub === 'ceph' && (
        <Card>
          <CardHeader
            title="Cephalometric Analysis"
            subtitle="Steiner and Tweed norms · ANB auto-computed as SNA − SNB · deviations beyond ±3° flagged"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Measurement</th>
                  <th className="px-4 py-2.5">Value</th>
                  <th className="px-4 py-2.5">Norm</th>
                  <th className="px-4 py-2.5">Deviation</th>
                  <th className="px-4 py-2.5 w-40">Visual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CEPH_ROWS.map((row) => {
                  const v = cephValue(row.key)
                  const d = Math.round((v - row.norm) * 10) / 10
                  const out = Math.abs(d) > 3
                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{row.label}</td>
                      <td className="px-4 py-2.5">
                        {row.key === 'ANB' ? (
                          <span className="inline-flex h-9 w-20 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700">
                            {anb}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.1"
                            value={data.ceph[row.key] ?? 0}
                            onChange={(e) =>
                              onChange({ ...data, ceph: { ...data.ceph, [row.key]: Number(e.target.value) || 0 } })
                            }
                            className="h-9 w-20 rounded-lg border border-slate-300 text-center font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.norm}°</td>
                      <td className={cn('px-4 py-2.5 font-semibold', out ? 'text-red-600' : 'text-emerald-600')}>
                        {d > 0 ? `+${d}` : d}°
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className={cn('h-1.5 rounded-full', out ? 'bg-red-400' : 'bg-emerald-400')}
                            style={{ width: `${Math.min(100, Math.max(4, 50 + d * 6))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sub === 'plan' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Treatment Plan" subtitle="Appliance therapy, extractions and retention protocol" />
            <CardBody className="space-y-4">
              <Field label="Appliance">
                <Input value={data.plan.appliance} onChange={setPlan('appliance')} placeholder="e.g. 0.022 MBT Preadjusted Edgewise Appliance" />
              </Field>
              <Field label="Extraction Protocol">
                <Input value={data.plan.extractions} onChange={setPlan('extractions')} placeholder="e.g. Non-extraction protocol" />
              </Field>
              <Field label="Retention Plan">
                <Input value={data.plan.retention} onChange={setPlan('retention')} placeholder="e.g. Upper and lower Essix retainers" />
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Treatment Stages"
              subtitle={`${doneCount} of ${ORTHO_STAGES.length} stages completed — tap a stage to set progress`}
            />
            <CardBody className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ORTHO_STAGES.map((name, i) => {
                const state = data.plan.stages[i] || (i === activeIdx ? 'active' : '')
                return (
                  <button
                    key={name}
                    onClick={() =>
                      onChange({
                        ...data,
                        plan: {
                          ...data.plan,
                          stages: ORTHO_STAGES.map((_, j) => (j < i ? 'done' : j === i ? 'active' : '')),
                        },
                      })
                    }
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition',
                      state === 'done'
                        ? 'border-emerald-200 bg-emerald-50'
                        : state === 'active'
                          ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stage {i + 1}</div>
                    <div className="text-sm font-semibold text-slate-800">{name}</div>
                    <div
                      className={cn(
                        'mt-0.5 text-xs font-medium',
                        state === 'done' ? 'text-emerald-600' : state === 'active' ? 'text-brand-700' : 'text-slate-400',
                      )}
                    >
                      {state === 'done' ? 'Completed' : state === 'active' ? 'In progress' : 'Pending'}
                    </div>
                  </button>
                )
              })}
            </CardBody>
          </Card>
        </div>
      )}

      {sub === 'progress' && (
        <Card>
          <CardHeader
            title="Progress Visits"
            subtitle="Chronological log of adjustment and review visits"
            actions={
              <Button size="sm" onClick={() => { setEditingVisit(null); setVisitOpen(true) }}>
                <CalendarPlus className="h-4 w-4" /> Add Visit
              </Button>
            }
          />
          {!data.visits.length ? (
            <EmptyState
              icon={<CalendarPlus className="h-6 w-6" />}
              title="No progress visits yet"
              message="Log each adjustment or review visit to build the treatment timeline."
              action={
                <Button size="sm" onClick={() => { setEditingVisit(null); setVisitOpen(true) }}>
                  <Plus className="h-4 w-4" /> Add Visit
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.visits.map((v) => (
                <li key={v.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-semibold text-slate-800">{v.title}</span>
                      <span className="text-xs text-slate-400">{fmtDate(v.date)}</span>
                    </div>
                    {v.note && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-slate-600">{v.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit visit" onClick={() => { setEditingVisit(v); setVisitOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete visit" onClick={() => setDeleteVisit(v)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {sub === 'records' && (
        <Card>
          <CardHeader
            title="Orthodontic Records"
            subtitle="Radiographs, photographs, models and documents"
            actions={
              <Button size="sm" onClick={() => setRecordOpen(true)}>
                <Plus className="h-4 w-4" /> Add Record
              </Button>
            }
          />
          {!data.records.length ? (
            <EmptyState
              icon={<FileImage className="h-6 w-6" />}
              title="No records added"
              message="Track OPG, cephalogram, photo and model records taken during treatment."
              action={
                <Button size="sm" onClick={() => setRecordOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Record
                </Button>
              }
            />
          ) : (
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.records.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <FileImage className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{r.type}</div>
                    <div className="text-xs text-slate-500">{fmtDate(r.date)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete record"
                    onClick={() => {
                      const next = { ...data, records: data.records.filter((x) => x.id !== r.id) }
                      onPersist(next, 'Orthodontic record removed')
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      )}

      <VisitDialog
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        editing={editingVisit}
        onSave={(visit) => {
          const next = editingVisit
            ? { ...data, visits: data.visits.map((v) => (v.id === visit.id ? visit : v)) }
            : { ...data, visits: [visit, ...data.visits] }
          onPersist(next, editingVisit ? 'Progress visit updated' : 'Progress visit saved')
          setVisitOpen(false)
        }}
      />

      <RecordDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSave={(rec) => {
          onPersist({ ...data, records: [rec, ...data.records] }, 'Orthodontic record added')
          setRecordOpen(false)
        }}
      />

      <ConfirmDialog
        open={!!deleteVisit}
        onClose={() => setDeleteVisit(null)}
        title="Delete Progress Visit"
        message={`Remove the visit "${deleteVisit?.title}" on ${fmtDate(deleteVisit?.date)}? This cannot be undone.`}
        onConfirm={() => {
          if (deleteVisit) {
            onPersist({ ...data, visits: data.visits.filter((v) => v.id !== deleteVisit.id) }, 'Progress visit deleted')
          }
          setDeleteVisit(null)
        }}
      />
    </div>
  )
}

function VisitDialog({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean
  onClose: () => void
  editing: OrthoVisit | null
  onSave: (v: OrthoVisit) => void
}) {
  const [date, setDate] = useState(todayISO())
  const [title, setTitle] = useState(VISIT_TYPES[0])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setDate(editing?.date ?? todayISO())
      setTitle(editing?.title ?? VISIT_TYPES[0])
      setNote(editing?.note ?? '')
    }
  }, [open, editing])

  const submit = () => {
    if (!title.trim()) {
      toast.error('Enter a visit title')
      return
    }
    if (!date) {
      toast.error('Choose a visit date')
      return
    }
    onSave({ id: editing?.id ?? `V-${Date.now()}`, date, title: title.trim(), note: note.trim() })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Progress Visit' : 'Add Progress Visit'}
      subtitle="Record what was done at this appointment"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save Changes' : 'Save Visit'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Visit Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Visit Title" required>
          <Input list="ortho-visit-types" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Archwire Change" />
          <datalist id="ortho-visit-types">
            {VISIT_TYPES.map((v) => <option key={v} value={v} />)}
          </datalist>
        </Field>
        <Field label="Clinical Note" className="sm:col-span-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Procedures performed, wire sequence, patient instructions…" />
        </Field>
      </div>
    </Dialog>
  )
}

function RecordDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (r: { id: string; type: string; date: string }) => void
}) {
  const [type, setType] = useState(RECORD_TYPES[0])
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    if (open) {
      setType(RECORD_TYPES[0])
      setDate(todayISO())
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Orthodontic Record"
      subtitle="Log a diagnostic or progress record for this patient"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (!date) {
                toast.error('Choose the record date')
                return
              }
              onSave({ id: `R-${Date.now()}`, type, date })
            }}
          >
            Save Record
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="Record Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Record Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

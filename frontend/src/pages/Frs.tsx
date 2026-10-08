import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Archive,
  BellPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  KanbanSquare,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Tabs'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { PatientPicker } from '@/components/clinical/PatientPicker'

const STAGES = [
  'Consultation',
  'Clinical Evaluation',
  'Plan Presented',
  'Estimate Shared',
  'Follow-up Due',
  'Treatment Accepted',
] as const

const STAGE_TONES: Record<string, Tone> = {
  Consultation: 'slate',
  'Clinical Evaluation': 'blue',
  'Plan Presented': 'violet',
  'Estimate Shared': 'amber',
  'Follow-up Due': 'red',
  'Treatment Accepted': 'green',
}

const PROBABILITIES = [35, 50, 65, 80, 95]
const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham', 'Dr. Vivekanandan M']
const PRIORITIES = ['High', 'Medium', 'Low']
const SOURCES = ['Consultation', 'Existing Patient', 'Recall', 'Walk-in', 'Referral', 'Digital Campaign', 'Clinical Notes', 'Clinical Pipeline']

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Normalize "Nov 2026" / "2026-11" / "2026-11-xx" to the month key "2026-11". */
function toMonthKey(s?: string): string {
  if (!s) return ''
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7)
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(s.trim())
  if (m) {
    const i = MONTH_NAMES.findIndex((n) => m[1].toLowerCase().startsWith(n.toLowerCase()))
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`
  }
  return ''
}

function monthLabel(s?: string): string {
  const k = toMonthKey(s)
  if (!k) return s || '—'
  const [y, mo] = k.split('-')
  return `${MONTH_NAMES[Number(mo) - 1]} ${y}`
}

const isCompleted = (r: Doc) => r.completionStatus === 'Treatment Completed'

const priorityTone = (p?: string): Tone => (p === 'High' ? 'red' : p === 'Low' ? 'slate' : 'amber')

export default function Frs() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [q, setQ] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)

  const { data, isLoading } = useList('frs_records', { sort: 'created_at', order: 'desc', limit: 500 })
  const all = data?.items ?? []

  const update = useUpdate('frs_records')
  const del = useDelete('frs_records', { successMessage: 'FRS opportunity deleted' })
  const createNote = useCreate('schedule_notes')

  const open = useMemo(() => all.filter((r) => !isCompleted(r)), [all])
  const completed = useMemo(() => all.filter(isCompleted), [all])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return open
    return open.filter((r) =>
      [r.patient, r.patientId, r.treatment, r.doctor, r.source, r.stage]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [open, q])

  const kpis = useMemo(() => {
    const pipeline = open.reduce((s, r) => s + (Number(r.value) || 0), 0)
    const weighted = open.reduce((s, r) => s + ((Number(r.value) || 0) * (Number(r.probability) || 0)) / 100, 0)
    const thisKey = todayISO().slice(0, 7)
    const monthRows = open.filter((r) => toMonthKey(r.expected) === thisKey)
    const monthValue = monthRows.reduce((s, r) => s + (Number(r.value) || 0), 0)
    const byStage: Record<string, number> = {}
    for (const s of STAGES) byStage[s] = 0
    for (const r of open) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1
    return { pipeline, weighted: Math.round(weighted), monthValue, monthCount: monthRows.length, byStage }
  }, [open])

  const moveStage = (r: Doc, dir: -1 | 1) => {
    const i = STAGES.indexOf(r.stage as (typeof STAGES)[number])
    const next = STAGES[i + dir]
    if (i < 0 || !next) return
    update.mutate({ id: r.id, stage: next }, { onSuccess: () => toast.success(`Moved to ${next}`) })
  }

  const setStage = (r: Doc, stage: string) => {
    if (stage === r.stage) return
    update.mutate({ id: r.id, stage }, { onSuccess: () => toast.success(`Moved to ${stage}`) })
  }

  const markCompleted = (r: Doc) =>
    update.mutate(
      {
        id: r.id,
        completionStatus: 'Treatment Completed',
        completedOn: todayISO(),
        revenueStatus: 'Recognized — Treatment Completed',
      },
      { onSuccess: () => toast.success(`${fmtINR(r.value)} recognized — treatment completed`) },
    )

  const restore = (r: Doc) =>
    update.mutate(
      {
        id: r.id,
        completionStatus: 'Pending Treatment',
        completedOn: '',
        revenueStatus: 'Forecast Only — Not Recognized',
      },
      { onSuccess: () => toast.success('Opportunity restored to the pipeline') },
    )

  const remind = (r: Doc) => {
    if (!r.followUp) {
      toast.error('Set a follow-up date on this record first')
      return
    }
    createNote.mutate(
      {
        date: r.followUp,
        time: '10:00',
        type: 'Note',
        title: `FRS follow-up · ${r.patient}`,
        details: r.treatment || '',
        assigned: 'Reception',
        priority: 'Medium',
        status: 'Pending',
        color: '#0d9488',
      },
      { onSuccess: () => toast.success('Follow-up reminder added to Schedule Notes') },
    )
  }

  const openEdit = (r: Doc) => {
    setEditing(r)
    setFormOpen(true)
  }

  const cardActions = (r: Doc) => (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Add follow-up reminder" title="Add follow-up reminder" onClick={() => remind(r)}>
        <BellPlus className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Edit" title="Edit" onClick={() => openEdit(r)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Mark completed" title="Mark Completed" onClick={() => markCompleted(r)}>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" onClick={() => setDeleting(r)}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  )

  const columns: Column<Doc>[] = [
    {
      key: 'patient',
      header: 'Patient',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-800">{r.patient}</div>
          <div className="text-xs text-slate-400">{r.patientId || r.code}</div>
        </div>
      ),
    },
    { key: 'treatment', header: 'Treatment', cell: (r) => <span className="text-slate-700">{r.treatment}</span> },
    { key: 'value', header: 'Value', align: 'right', cell: (r) => <span className="font-semibold text-slate-800">{fmtINR(r.value)}</span> },
    {
      key: 'prob',
      header: 'Prob.',
      align: 'center',
      cell: (r) => <Badge tone={Number(r.probability) >= 80 ? 'green' : Number(r.probability) >= 65 ? 'blue' : 'amber'}>{r.probability}%</Badge>,
    },
    {
      key: 'weighted',
      header: 'Weighted',
      align: 'right',
      cell: (r) => <span className="text-slate-600">{fmtINR(Math.round(((Number(r.value) || 0) * (Number(r.probability) || 0)) / 100))}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (r) => (
        <Select value={r.stage} onChange={(e) => setStage(r, e.target.value)} className="h-8 w-44 text-[13px]">
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </Select>
      ),
    },
    { key: 'expected', header: 'Expected', cell: (r) => <span className="text-slate-600">{monthLabel(r.expected)}</span> },
    { key: 'followup', header: 'Follow-up', cell: (r) => <span className="text-slate-600">{r.followUp ? fmtDate(r.followUp) : '—'}</span> },
    { key: 'priority', header: 'Priority', cell: (r) => <Badge tone={priorityTone(r.priority)}>{r.priority || 'Medium'}</Badge> },
    { key: 'actions', header: '', cell: cardActions },
  ]

  return (
    <div>
      <PageHeader
        title="FRS — Future Revenue Scope"
        subtitle="Predict, prioritize and convert proposed treatments into realized revenue"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> New Opportunity
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Total pipeline" value={fmtINR(kpis.pipeline)} icon={<IndianRupee className="h-5 w-5" />} hint={`${open.length} open opportunities`} />
        <StatCard label="Weighted forecast" value={fmtINR(kpis.weighted)} icon={<Scale className="h-5 w-5" />} accent="blue" hint="Σ value × probability" />
        <StatCard label="Expected this month" value={fmtINR(kpis.monthValue)} icon={<TrendingUp className="h-5 w-5" />} accent="green" hint={`${kpis.monthCount} case${kpis.monthCount === 1 ? '' : 's'}`} />
        <StatCard label="Treatment accepted" value={kpis.byStage['Treatment Accepted'] ?? 0} icon={<Target className="h-5 w-5" />} accent="amber" hint="Ready to schedule" />
      </div>

      {/* Stage counts */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <Badge key={s} tone={STAGE_TONES[s]}>
            {s} · {kpis.byStage[s] ?? 0}
          </Badge>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search patient, treatment, doctor or source…" className="min-w-0 flex-1 sm:max-w-sm" />
        <Segmented
          className="ml-auto"
          value={view}
          onChange={(v) => setView(v as 'board' | 'list')}
          options={[
            { key: 'board', label: <span className="flex items-center gap-1"><KanbanSquare className="h-3.5 w-3.5" /> Board</span> },
            { key: 'list', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> List</span> },
          ]}
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : !open.length && !q ? (
        <Card>
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No open opportunities"
            message="Record planned and predicted treatments to build the revenue pipeline."
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4" /> New Opportunity
              </Button>
            }
          />
        </Card>
      ) : view === 'board' ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {STAGES.map((stage) => {
            const rows = filtered.filter((r) => r.stage === stage)
            const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
            return (
              <div key={stage} className="w-[276px] shrink-0 snap-start">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-700">{stage}</span>
                    <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{rows.length}</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{fmtINR(total)}</span>
                </div>
                <div className="min-h-[140px] space-y-2.5 rounded-xl bg-slate-100/80 p-2">
                  {rows.map((r) => {
                    const idx = STAGES.indexOf(stage)
                    return (
                      <Card key={r.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{r.patient}</div>
                            <div className="truncate text-xs text-slate-500">{r.treatment}</div>
                          </div>
                          <Badge tone={priorityTone(r.priority)}>{r.priority || 'Medium'}</Badge>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-[15px] font-bold text-slate-900">{fmtINR(r.value)}</span>
                          <span className="text-[11px] text-slate-500">
                            {r.probability}% · wt {fmtINR(Math.round(((Number(r.value) || 0) * (Number(r.probability) || 0)) / 100))}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <span>Expected · {monthLabel(r.expected)}</span>
                          {r.followUp && <span>Follow-up · {fmtDate(r.followUp)}</span>}
                          {r.doctor && <span>{r.doctor}</span>}
                        </div>
                        {r.nextAction && (
                          <div className="mt-1.5 truncate rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                            Next · {r.nextAction}
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Move to previous stage"
                              title="Previous stage"
                              disabled={idx === 0}
                              onClick={() => moveStage(r, -1)}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Move to next stage"
                              title="Next stage"
                              disabled={idx === STAGES.length - 1}
                              onClick={() => moveStage(r, 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          {cardActions(r)}
                        </div>
                      </Card>
                    )
                  })}
                  {!rows.length && (
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <DataTable
            rows={filtered}
            rowKey={(r) => r.id}
            columns={columns}
            empty={
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" />}
                title="No opportunities match"
                message="Try a different patient, treatment or doctor."
              />
            }
            mobileCard={(r) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{r.patient}</div>
                    <div className="truncate text-xs text-slate-500">{r.treatment}</div>
                  </div>
                  <Badge tone={STAGE_TONES[r.stage] ?? 'slate'}>{r.stage}</Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{fmtINR(r.value)}</span>
                  <span className="text-xs text-slate-500">{r.probability}% · {monthLabel(r.expected)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone={priorityTone(r.priority)}>{r.priority || 'Medium'}</Badge>
                  {cardActions(r)}
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {/* Archive */}
      <Card className="mt-5">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-400" /> Archive — completed treatments
            </span>
          }
          subtitle={`${completed.length} recognized · ${fmtINR(completed.reduce((s, r) => s + (Number(r.value) || 0), 0))} realized`}
          actions={
            <Button variant="outline" size="sm" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Hide' : 'Show'}
            </Button>
          }
        />
        {showArchive &&
          (!completed.length ? (
            <EmptyState
              icon={<Archive className="h-6 w-6" />}
              title="Nothing archived yet"
              message="Opportunities marked completed will appear here with their recognized value."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {completed.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {r.patient} <span className="font-normal text-slate-400">· {r.treatment}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Completed {r.completedOn ? fmtDate(r.completedOn) : '—'} · {r.doctor || '—'}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">{fmtINR(r.value)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Restore to pipeline" title="Restore to pipeline" onClick={() => restore(r)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </Card>

      <FrsDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete FRS Opportunity"
        message={
          <>
            Delete the opportunity for <b>{deleting?.patient}</b> ({deleting?.treatment}, {fmtINR(deleting?.value)})? This
            cannot be undone.
          </>
        }
        loading={del.isPending}
        onConfirm={() => {
          if (deleting) del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add / edit dialog                                                   */
/* ------------------------------------------------------------------ */

interface FrsForm {
  treatment: string
  value: string
  probability: string
  stage: string
  expected: string
  doctor: string
  priority: string
  nextAction: string
  followUp: string
  source: string
}

const emptyForm = (): FrsForm => ({
  treatment: '',
  value: '',
  probability: '65',
  stage: STAGES[0],
  expected: todayISO().slice(0, 7),
  doctor: DOCTORS[0],
  priority: 'Medium',
  nextAction: '',
  followUp: '',
  source: 'Consultation',
})

function FrsDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Doc | null }) {
  const [patient, setPatient] = useState<Doc | null>(null)
  const [form, setForm] = useState<FrsForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const masters = useList('treatment_masters', { limit: 200, sort: 'name', order: 'asc' }, { enabled: open })
  const treatments = (masters.data?.items ?? []).filter((m) => m.status !== 'Inactive')

  const create = useCreate('frs_records', { successMessage: 'FRS opportunity saved' })
  const update = useUpdate('frs_records', { successMessage: 'FRS opportunity updated' })

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (editing) {
      setPatient(
        editing.patient
          ? ({ id: editing.patientRef || '', name: editing.patient, code: editing.patientId || '' } as Doc)
          : null,
      )
      setForm({
        treatment: editing.treatment || '',
        value: String(editing.value ?? ''),
        probability: String(editing.probability ?? 65),
        stage: STAGES.includes(editing.stage) ? editing.stage : STAGES[0],
        expected: toMonthKey(editing.expected) || todayISO().slice(0, 7),
        doctor: editing.doctor || DOCTORS[0],
        priority: editing.priority || 'Medium',
        nextAction: editing.nextAction || '',
        followUp: editing.followUp || '',
        source: editing.source || 'Consultation',
      })
    } else {
      setPatient(null)
      setForm(emptyForm())
    }
  }, [open, editing])

  const set = (k: keyof FrsForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onTreatment = (e: { target: { value: string } }) => {
    const name = e.target.value
    const match = treatments.find((m) => String(m.name).toLowerCase() === name.toLowerCase())
    setForm((f) => ({ ...f, treatment: name, value: match ? String(match.price ?? f.value) : f.value }))
  }

  const value = Number(form.value) || 0
  const probability = Number(form.probability) || 0
  const weighted = Math.round((value * probability) / 100)

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!patient) errs.patient = 'Select a patient.'
    if (!form.treatment.trim()) errs.treatment = 'Enter the proposed treatment.'
    if (!value || value <= 0) errs.value = 'Enter a case value above zero.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      patient: patient!.name,
      patientId: patient!.code || '',
      patientRef: patient!.id || '',
      treatment: form.treatment.trim(),
      value,
      probability,
      weightedValue: weighted,
      stage: form.stage,
      expected: form.expected,
      doctor: form.doctor,
      priority: form.priority,
      nextAction: form.nextAction.trim(),
      followUp: form.followUp,
      source: form.source,
      completionStatus: editing?.completionStatus ?? 'Pending Treatment',
      revenueStatus: editing?.revenueStatus ?? 'Forecast Only — Not Recognized',
    }
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    else create.mutate(payload as Partial<Doc>, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit FRS Opportunity' : 'New FRS Opportunity'}
      subtitle={editing ? editing.code || editing.patient : 'Record a planned or predicted future treatment'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Save Opportunity'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Patient" required error={errors.patient} className="sm:col-span-2">
          <PatientPicker value={patient} onChange={setPatient} />
        </Field>
        <Field label="Treatment" required error={errors.treatment} hint="Choosing from the master list autofills the base price.">
          <Input list="frs-treatment-masters" value={form.treatment} onChange={onTreatment} placeholder="e.g. Root Canal Treatment" />
          <datalist id="frs-treatment-masters">
            {treatments.map((m) => (
              <option key={m.id} value={m.name}>{`${m.category} · ${fmtINR(m.price)}`}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Case Value (₹)" required error={errors.value}>
          <Input type="number" min={0} value={form.value} onChange={set('value')} placeholder="15000" />
        </Field>
        <Field label="Probability">
          <Select value={form.probability} onChange={set('probability')}>
            {PROBABILITIES.map((p) => <option key={p} value={p}>{p}%</option>)}
          </Select>
        </Field>
        <Field label="Weighted Value" hint="Auto — value × probability">
          <Input value={fmtINR(weighted)} readOnly disabled />
        </Field>
        <Field label="Stage">
          <Select value={form.stage} onChange={set('stage')}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Expected Month">
          <Input type="month" value={form.expected} onChange={set('expected')} />
        </Field>
        <Field label="Doctor">
          <Select value={form.doctor} onChange={set('doctor')}>
            {DOCTORS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Next Action">
          <Input value={form.nextAction} onChange={set('nextAction')} placeholder="e.g. Share estimate on WhatsApp" />
        </Field>
        <Field label="Follow-up Date" hint="Used for schedule-note reminders.">
          <Input type="date" value={form.followUp} onChange={set('followUp')} />
        </Field>
        <Field label="Lead Source">
          <Select value={form.source} onChange={set('source')}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}

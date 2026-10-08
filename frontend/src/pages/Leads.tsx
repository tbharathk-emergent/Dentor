import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  KanbanSquare,
  List,
  Pencil,
  Plus,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { downloadCSV } from '@/components/growth/csv'

const SOURCES = ['Website', 'Google Ads', 'Instagram', 'Facebook', 'WhatsApp', 'Patient Referral', 'Walk-in', 'Dental Camp']
const INTERESTS = ['Dental Implant', 'Clear Aligners', 'Root Canal', 'Smile Design', 'Orthodontics', 'Paediatric Dentistry', 'Full Mouth Rehabilitation', 'General Consultation']
const STAGES = ['New', 'Contacted', 'Qualified', 'Consultation', 'Converted', 'Lost']
const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Consultation', 'Converted']
const OWNERS = ['Unassigned', 'Reception', 'Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const PRIORITIES = ['Hot', 'Warm', 'Normal']
const ACTIVITIES = ['Phone Call', 'WhatsApp', 'Email', 'Consultation', 'Video Call']

const STAGE_TONES: Record<string, Tone> = {
  New: 'blue', Contacted: 'amber', Qualified: 'violet', Consultation: 'brand', Converted: 'green', Lost: 'red',
}

const fmtValue = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : fmtINR(v))

function ScoreChip({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        score > 85 ? 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-500/30' : 'bg-slate-100 text-slate-600',
      )}
    >
      Score {score}
    </span>
  )
}

interface LeadForm {
  name: string; phone: string; email: string; source: string; interest: string
  stage: string; owner: string; value: string; priority: string; notes: string; consent: boolean
}

const emptyForm: LeadForm = {
  name: '', phone: '', email: '', source: SOURCES[0], interest: INTERESTS[7],
  stage: 'New', owner: 'Unassigned', value: '25000', priority: 'Warm', notes: '', consent: true,
}

function LeadFormDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
  onSaved?: (lead: Doc, followUp: boolean) => void
}) {
  const [form, setForm] = useState<LeadForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('leads')
  const update = useUpdate('leads', { successMessage: 'Lead updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(editing
        ? {
            name: editing.name || '', phone: editing.phone || '', email: editing.email || '',
            source: editing.source || SOURCES[0], interest: editing.interest || INTERESTS[7],
            stage: editing.stage || 'New', owner: editing.owner || 'Unassigned',
            value: String(editing.value ?? 25000), priority: editing.priority || 'Warm',
            notes: editing.notes || '', consent: true,
          }
        : emptyForm)
    }
  }, [open, editing])

  const set = (k: keyof LeadForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (followUp: boolean) => (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Lead name is required.'
    if (!form.phone.trim()) errs.phone = 'Mobile number is required.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!form.consent) {
      toast.error('Record patient communication consent')
      return
    }
    const payload = {
      name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(),
      source: form.source, interest: form.interest, stage: form.stage, owner: form.owner,
      value: Number(form.value) || 25000, priority: form.priority, notes: form.notes,
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: (l) => { onSaved?.(l as Doc, followUp); onClose() },
      })
    } else {
      create.mutate({ ...payload, score: 65, last: 'Now', next: 'Follow-up pending' }, {
        onSuccess: (l) => {
          toast.success(`Lead created · ${(l as Doc).code}`)
          onSaved?.(l as Doc, followUp)
          onClose()
        },
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Lead' : 'Add New Lead'}
      subtitle={editing ? `${editing.code} · Update lead and qualification information` : 'Capture a new dental enquiry'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={submit(true) as never} loading={create.isPending || update.isPending}>
            Save & Follow-up
          </Button>
          <Button onClick={submit(false) as never} loading={create.isPending || update.isPending}>
            {editing ? 'Update Lead' : 'Create Lead'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit(false)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name" required error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Priya Sharma" autoFocus />
        </Field>
        <Field label="Mobile Number" required error={errors.phone}>
          <Input inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="optional" />
        </Field>
        <Field label="Lead Source">
          <Select value={form.source} onChange={set('source')}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Treatment Interest">
          <Select value={form.interest} onChange={set('interest')}>
            {INTERESTS.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Stage">
          <Select value={form.stage} onChange={set('stage')}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={form.owner} onChange={set('owner')}>
            {OWNERS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Potential Value ₹">
          <Input type="number" min={0} value={form.value} onChange={set('value')} />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Clinical / Enquiry Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Chief complaint, budget, preferred timing…" className="min-h-[60px]" />
        </Field>
        <label className="flex items-start gap-2 text-[13px] text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-700"
          />
          Patient consent recorded for communication
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function FollowupDialog({ lead, onClose }: { lead: Doc | null; onClose: () => void }) {
  const [activity, setActivity] = useState(ACTIVITIES[0])
  const [assigned, setAssigned] = useState('')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('16:00')
  const [notes, setNotes] = useState('')
  const update = useUpdate('leads')

  const assignees = useMemo(() => {
    const base = [lead?.owner, 'Reception', 'Dr. Kumar', 'Dr. Anitha'].filter(Boolean) as string[]
    return [...new Set(base)]
  }, [lead])

  useEffect(() => {
    if (lead) {
      setActivity(ACTIVITIES[0])
      setAssigned(lead.owner || 'Reception')
      setDate(todayISO())
      setTime('16:00')
      setNotes(`Follow up regarding ${lead.interest}`)
    }
  }, [lead])

  const save = () => {
    if (!lead) return
    const d = new Date(date)
    const dd = isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    update.mutate(
      { id: lead.id, next: `${activity} · ${dd} ${time}` },
      { onSuccess: () => { toast.success(`Follow-up scheduled · ${activity} on ${dd} at ${time}`); onClose() } },
    )
  }

  return (
    <Dialog
      open={!!lead}
      onClose={onClose}
      title="Schedule Follow-up"
      subtitle={lead ? `${lead.name} · ${lead.code}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={update.isPending}><CalendarClock className="h-4 w-4" /> Schedule</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Activity">
          <Select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Assigned To">
          <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            {assignees.map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Reminder Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />
        </Field>
      </div>
    </Dialog>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useList('leads', { limit: 500, sort: 'created_at', order: 'desc' })
  const leads = data?.items ?? []
  const update = useUpdate('leads')
  const del = useDelete('leads', { successMessage: 'Lead deleted' })

  const [view, setView] = useState<'pipeline' | 'table'>('pipeline')
  const [q, setQ] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [detail, setDetail] = useState<Doc | null>(null)
  const [followupFor, setFollowupFor] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [convertBusy, setConvertBusy] = useState(false)

  // Keep the open detail dialog in sync with refetched data
  const liveDetail = detail ? leads.find((l) => l.id === detail.id) ?? detail : null

  const kpis = useMemo(() => {
    const total = leads.length
    const qualified = leads.filter((l) => l.stage === 'Qualified' || l.stage === 'Consultation').length
    const converted = leads.filter((l) => l.stage === 'Converted').length
    const rate = total ? Math.round((converted / total) * 100) : 0
    const value = leads.reduce((s, l) => s + Number(l.value || 0), 0)
    return { total, qualified, rate, value }
  }, [leads])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter && l.stage !== stageFilter) return false
      if (sourceFilter && l.source !== sourceFilter) return false
      if (ownerFilter && l.owner !== ownerFilter) return false
      if (term && !`${l.name} ${l.phone} ${l.email} ${l.interest} ${l.code} ${l.source}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [leads, q, stageFilter, sourceFilter, ownerFilter])

  const moveStage = (lead: Doc, stage: string) => {
    if (stage === lead.stage) return
    update.mutate({ id: lead.id, stage }, { onSuccess: () => toast.success(`Lead moved to ${stage}`) })
  }

  const convertToPatient = async (lead: Doc) => {
    setConvertBusy(true)
    try {
      const p = await api.post<Doc>('/api/patients', {
        name: lead.name,
        mobile: lead.phone,
        age: 0,
        gender: 'Other',
        treatment: lead.interest,
        source: `Lead · ${lead.source}`,
        status: 'New',
        risk: 'Low',
        doctor: String(lead.owner || '').startsWith('Dr') ? lead.owner : 'Dr. Kumar',
      })
      await api.patch(`/api/leads/${lead.id}`, { stage: 'Converted' })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['patients'] })
      setDetail(null)
      toast.success(`Lead converted — patient ${p.code} created`, {
        action: { label: 'Open patient', onClick: () => navigate(`/patients/${p.id}`) },
      })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setConvertBusy(false)
    }
  }

  const exportCSV = () => {
    downloadCSV(
      'DENTOR-Leads.csv',
      ['ID', 'Name', 'Mobile', 'Email', 'Source', 'Interest', 'Stage', 'Score', 'Owner', 'Potential Value'],
      filtered.map((l) => [l.code, l.name, l.phone, l.email, l.source, l.interest, l.stage, l.score, l.owner, l.value]),
    )
    toast.success(`${filtered.length} leads exported`)
  }

  const columns: Column<Doc>[] = [
    {
      key: 'lead',
      header: 'Lead',
      cell: (l) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={l.name} className="h-8 w-8 text-[11px]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">{l.name}</div>
            <div className="text-xs text-slate-400">{l.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (l) => (
        <div className="min-w-0">
          <div className="text-[13px] text-slate-700">{l.phone}</div>
          <div className="truncate text-xs text-slate-400">{l.email || '—'}</div>
        </div>
      ),
    },
    { key: 'interest', header: 'Interest', cell: (l) => <span className="whitespace-nowrap text-[13px] text-slate-700">{l.interest}</span> },
    { key: 'source', header: 'Source', cell: (l) => <span className="whitespace-nowrap text-[13px] text-slate-500">{l.source}</span> },
    { key: 'stage', header: 'Stage', cell: (l) => <Badge tone={STAGE_TONES[l.stage] ?? 'slate'} dot>{l.stage}</Badge> },
    { key: 'score', header: 'Score', cell: (l) => <ScoreChip score={Number(l.score)} /> },
    { key: 'owner', header: 'Owner', cell: (l) => <span className="whitespace-nowrap text-[13px] text-slate-600">{l.owner}</span> },
    { key: 'value', header: 'Potential', align: 'right', cell: (l) => <span className="font-semibold tabular-nums text-slate-800">{fmtINR(l.value)}</span> },
    { key: 'next', header: 'Next Action', cell: (l) => <span className="whitespace-nowrap text-[13px] text-slate-500">{l.next || '—'}</span> },
    {
      key: 'actions',
      header: '',
      cell: (l) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDetail(l) }}>View</Button>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Lead Generation & CRM"
        subtitle="Capture, qualify, nurture and convert dental enquiries through one intelligent workspace"
        actions={
          <>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New Lead
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Total leads" value={kpis.total} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Qualified leads" hint="Qualified + Consultation" value={kpis.qualified} icon={<UserCheck className="h-5 w-5" />} accent="blue" />
        <StatCard label="Conversion rate" value={`${kpis.rate}%`} icon={<TrendingUp className="h-5 w-5" />} accent="green" />
        <StatCard label="Pipeline value" value={fmtValue(kpis.value)} icon={<IndianRupee className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, mobile, treatment or ID…" className="min-w-0 flex-1 sm:max-w-xs" />
        {view === 'table' ? (
          <>
            <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="w-32">
              <option value="">All Stages</option>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-36">
              <option value="">All Sources</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </>
        ) : (
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-36">
            <option value="">All Owners</option>
            {OWNERS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        )}
        <Segmented
          className="ml-auto"
          value={view}
          onChange={(v) => setView(v as 'pipeline' | 'table')}
          options={[
            { key: 'pipeline', label: <span className="flex items-center gap-1"><KanbanSquare className="h-3.5 w-3.5" /> Pipeline</span> },
            { key: 'table', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> All Leads</span> },
          ]}
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : view === 'pipeline' ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {PIPELINE_STAGES.map((stage, si) => {
            const items = filtered.filter((l) => l.stage === stage)
            return (
              <div key={stage} className="w-[260px] shrink-0 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[13px] font-semibold text-slate-700">{stage}</span>
                  <Badge tone={STAGE_TONES[stage]}>{items.length}</Badge>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  {!items.length && (
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
                      No leads in {stage.toLowerCase()}
                    </div>
                  )}
                  {items.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => setDetail(l)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{l.name}</span>
                        <ScoreChip score={Number(l.score)} />
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-slate-600">{l.interest}</div>
                      <div className="truncate text-xs text-slate-400">{l.source} · {l.owner}</div>
                      <div className="mt-2 flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[13px] font-semibold tabular-nums text-slate-800">{fmtINR(l.value)}</span>
                        <span className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon-sm" className="h-7 w-7" aria-label="Move back"
                            disabled={si === 0}
                            onClick={() => moveStage(l, PIPELINE_STAGES[si - 1])}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon-sm" className="h-7 w-7" aria-label="Move forward"
                            disabled={si === PIPELINE_STAGES.length - 1}
                            onClick={() => moveStage(l, PIPELINE_STAGES[si + 1])}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </span>
                      </div>
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={l.stage}
                          onChange={(e) => moveStage(l, e.target.value)}
                          className="h-7 w-full text-xs"
                        >
                          {STAGES.map((s) => <option key={s}>{s}</option>)}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(l) => l.id}
            onRowClick={(l) => setDetail(l)}
            empty={
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title={q || stageFilter || sourceFilter ? 'No leads found' : 'No leads yet'}
                message="Capture your first enquiry to start the pipeline."
                action={<Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="h-4 w-4" /> New Lead</Button>}
              />
            }
            mobileCard={(l) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={l.name} className="h-8 w-8 text-[11px]" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{l.name}</div>
                      <div className="text-xs text-slate-400">{l.code} · {l.phone}</div>
                    </div>
                  </div>
                  <Badge tone={STAGE_TONES[l.stage] ?? 'slate'} dot>{l.stage}</Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] text-slate-600">{l.interest} · {l.source}</span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-800">{fmtINR(l.value)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <ScoreChip score={Number(l.score)} />
                  <span className="truncate text-xs text-slate-400">{l.next || '—'}</span>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {/* Lead detail */}
      <Dialog
        open={!!liveDetail}
        onClose={() => setDetail(null)}
        title={liveDetail?.name ?? ''}
        subtitle={liveDetail ? `${liveDetail.code} · ${liveDetail.interest}` : undefined}
        size="lg"
        footer={
          liveDetail && (
            <>
              <Button variant="danger-outline" className="sm:mr-auto" onClick={() => { setDeleting(liveDetail); setDetail(null) }}>
                Delete
              </Button>
              <Button variant="outline" onClick={() => { setEditing(liveDetail); setFormOpen(true); setDetail(null) }}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="secondary" onClick={() => setFollowupFor(liveDetail)}>
                <CalendarClock className="h-4 w-4" /> Follow-up
              </Button>
              {liveDetail.stage !== 'Converted' && (
                <Button onClick={() => convertToPatient(liveDetail)} loading={convertBusy}>
                  <UserPlus className="h-4 w-4" /> Convert to Patient
                </Button>
              )}
            </>
          )
        }
      >
        {liveDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ['Contact', liveDetail.phone],
                ['Lead Score', `${liveDetail.score}/100`],
                ['Pipeline Stage', liveDetail.stage],
                ['Potential Value', fmtINR(liveDetail.value)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{k}</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{v || '—'}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">Lead Information</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {[
                  ['Email', liveDetail.email || '—'],
                  ['Source', liveDetail.source],
                  ['Priority', liveDetail.priority],
                  ['Owner', liveDetail.owner],
                  ['Last Activity', liveDetail.last || '—'],
                  ['Next Action', liveDetail.next || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="truncate font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {liveDetail.notes && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{liveDetail.notes}</p>}
            </div>
            {liveDetail.stage === 'Converted' && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                <UserCheck className="h-4 w-4 shrink-0" /> This lead has been converted to a patient record.
              </div>
            )}
          </div>
        )}
      </Dialog>

      <LeadFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSaved={(lead, followUp) => { if (followUp) setFollowupFor(lead) }}
      />
      <FollowupDialog lead={followupFor} onClose={() => setFollowupFor(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        title="Delete lead?"
        message={`“${deleting?.name}” (${deleting?.code}) will be removed from the pipeline permanently.`}
        loading={del.isPending}
      />
    </div>
  )
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtTime, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

const TYPES = ['Schedule', 'Note']
const PRIORITIES = ['High', 'Medium', 'Normal']
const STATUSES = ['Pending', 'Completed']
const ASSIGNEES = [
  'Dr. Admin', 'Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham', 'Reception',
  'Clinical Team', 'Front Desk', 'Pharmacy', 'Lab Desk', 'Accounts',
]
const REMINDERS = ['At time', '15 minutes', '30 minutes', '1 day']
const COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444']

const priorityTone = (p: string): Tone => (p === 'High' ? 'red' : p === 'Medium' ? 'amber' : 'slate')

interface NoteForm {
  type: string
  date: string
  time: string
  title: string
  details: string
  patient: string
  assigned: string
  priority: string
  reminder: string
  color: string
  status: string
}

const emptyForm = (): NoteForm => ({
  type: 'Schedule', date: todayISO(), time: format(new Date(), 'HH:mm'), title: '',
  details: '', patient: '', assigned: ASSIGNEES[0], priority: 'Normal',
  reminder: 'At time', color: COLORS[0], status: 'Pending',
})

function NoteFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
}) {
  const [form, setForm] = useState<NoteForm>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('schedule_notes', { successMessage: 'Schedule / note saved', invalidate: ['dashboard'] })
  const update = useUpdate('schedule_notes', { successMessage: 'Schedule / note updated', invalidate: ['dashboard'] })

  const { data: patientData } = useList('patients', { limit: 300, sort: 'name', order: 'asc' }, { enabled: open })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        editing
          ? {
              type: editing.type || 'Schedule', date: editing.date || todayISO(), time: editing.time || '',
              title: editing.title || '', details: editing.details || '', patient: editing.patient || '',
              assigned: editing.assigned || ASSIGNEES[0], priority: editing.priority || 'Normal',
              reminder: editing.reminder || 'At time', color: editing.color || COLORS[0],
              status: editing.status || 'Pending',
            }
          : emptyForm(),
      )
    }
  }, [open, editing])

  const set = (k: keyof NoteForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'A title is required.'
    if (!form.date) errs.date = 'Pick a date.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: onClose })
    } else {
      create.mutate(form as Partial<Doc>, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Schedule / Note' : 'New Schedule / Note'}
      subtitle={editing ? editing.code : 'Create a personal, patient or clinic-wide entry.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Save Entry'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Entry Type" required>
          <Select value={form.type} onChange={set('type')}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.time} onChange={set('time')} />
          </Field>
        </div>
        <Field label="Title" required error={errors.title} className="sm:col-span-2">
          <Input value={form.title} onChange={set('title')} placeholder="Schedule or note title" autoFocus />
        </Field>
        <Field label="Details" className="sm:col-span-2">
          <Textarea
            value={form.details}
            onChange={set('details')}
            placeholder="Complete instructions, notes or agenda…"
            className="min-h-[64px]"
          />
        </Field>
        <Field label="Related Patient" hint="Optional — leave as General for clinic-wide entries.">
          <Select value={form.patient} onChange={set('patient')}>
            <option value="">General</option>
            {(patientData?.items ?? []).map((p) => (
              <option key={p.id} value={p.name}>{p.name} · {p.code}</option>
            ))}
          </Select>
        </Field>
        <Field label="Assigned To">
          <Select value={form.assigned} onChange={set('assigned')}>
            {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Reminder">
          <Select value={form.reminder} onChange={set('reminder')}>
            {REMINDERS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Display Color">
          <div className="flex h-10 items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={cn(
                  'h-7 w-7 rounded-full transition',
                  form.color === c ? 'ring-2 ring-slate-700 ring-offset-2' : 'hover:scale-110',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

export default function ScheduleNotes() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null)
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const { data, isLoading } = useList('schedule_notes', {
    q,
    ...(date ? { date } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    sort: 'time',
    order: 'asc',
    limit: 300,
  })
  const notes = data?.items ?? []

  const { data: todayData } = useList('schedule_notes', { date: todayISO(), limit: 300 })
  const kpis = useMemo(() => {
    const items = todayData?.items ?? []
    return {
      today: items.length,
      pending: items.filter((n) => n.status === 'Pending').length,
      high: items.filter((n) => n.priority === 'High' && n.status !== 'Completed').length,
      completed: items.filter((n) => n.status === 'Completed').length,
    }
  }, [todayData])

  const groups = useMemo(() => {
    const map = new Map<string, Doc[]>()
    for (const n of notes) {
      const key = n.time || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return [...map.entries()]
  }, [notes])

  const update = useUpdate('schedule_notes', { invalidate: ['dashboard'] })
  const del = useDelete('schedule_notes', { successMessage: 'Entry deleted', invalidate: ['dashboard'] })

  const toggleStatus = (n: Doc) => {
    const next = n.status === 'Completed' ? 'Pending' : 'Completed'
    update.mutate({ id: n.id, status: next }, { onSuccess: () => toast.success(`${n.title} — ${next}`) })
  }

  const shiftDate = (days: number) =>
    setDate(format(addDays(new Date((date || todayISO()) + 'T00:00'), days), 'yyyy-MM-dd'))

  const exportCsv = () => {
    if (!notes.length) {
      toast.error('Nothing to export for the current filters')
      return
    }
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
    const header = ['ID', 'Date', 'Time', 'Type', 'Title', 'Details', 'Patient', 'Assigned', 'Priority', 'Status', 'Reminder']
    const rows = notes.map((n) => [
      n.code, n.date, n.time, n.type, n.title, n.details, n.patient || 'General',
      n.assigned, n.priority, n.status, n.reminder,
    ])
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'DENTOR-Schedule-Notes.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${notes.length} entries`)
  }

  const hasFilters = !!(q || type || priority || status)

  return (
    <div>
      <PageHeader
        title="Schedule & Notes"
        subtitle="Clinic schedules, patient-related notes and staff reminders"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New Entry
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Today's entries" value={kpis.today} icon={<StickyNote className="h-5 w-5" />} />
        <StatCard label="Pending" value={kpis.pending} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="High priority" value={kpis.high} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        <StatCard label="Completed" value={kpis.completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => shiftDate(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => shiftDate(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
        </div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search title, patient, staff or details…"
          className="min-w-[180px] flex-1 sm:max-w-xs"
        />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-32">
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32">
          <option value="">All Priority</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : !notes.length ? (
        <Card>
          <EmptyState
            icon={<StickyNote className="h-6 w-6" />}
            title={hasFilters ? 'No entries match the filters' : 'Nothing scheduled for this day'}
            message={
              hasFilters
                ? 'Try a different search, type, priority or status.'
                : 'Add a schedule or note to plan the day.'
            }
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4" /> New Entry
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-50">
            {groups.map(([time, items]) => (
              <li key={time || 'all-day'} className="flex gap-3 px-4 py-2.5 sm:px-5">
                <span className="w-16 shrink-0 pt-2 text-xs font-bold text-slate-500">
                  {time ? fmtTime(time) : 'All day'}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-lg border-l-4 bg-slate-50 px-3 py-2 transition hover:bg-slate-100',
                        n.status === 'Completed' && 'opacity-60',
                      )}
                      style={{ borderLeftColor: n.color || COLORS[0] }}
                    >
                      <button
                        onClick={() => toggleStatus(n)}
                        aria-label={n.status === 'Completed' ? 'Mark as pending' : 'Mark as completed'}
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                          n.status === 'Completed'
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 bg-white text-transparent hover:border-emerald-400',
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'truncate text-sm font-semibold text-slate-800',
                              n.status === 'Completed' && 'line-through',
                            )}
                          >
                            {n.title}
                          </span>
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: n.color || COLORS[0] }}
                          />
                          <Badge tone={priorityTone(n.priority)}>{n.priority}</Badge>
                          <Badge tone={n.type === 'Note' ? 'violet' : 'blue'}>{n.type}</Badge>
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {n.details || 'No additional details'} · {n.patient || 'General'} · {n.assigned}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit entry"
                          onClick={() => { setEditing(n); setFormOpen(true) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete entry"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(n)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <NoteFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
        title="Delete this entry?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" (${deleteTarget.type}) will be permanently removed.`
            : ''
        }
        confirmLabel="Delete Entry"
        loading={del.isPending}
      />
    </div>
  )
}

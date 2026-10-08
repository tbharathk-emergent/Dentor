import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtTime, todayISO, useCreate, useList, useUpdate, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { PatientFormDialog } from './Patients'
import { cn } from '@/lib/cn'

const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const CHAIRS = ['Chair 01', 'Chair 02', 'Chair 03']
const DURATIONS = ['15 min', '30 min', '45 min', '60 min', '90 min']
const STATUSES = ['Scheduled', 'Waiting', 'Completed', 'Cancelled']
const SLOT_TIMES = Array.from({ length: 18 }, (_, i) => {
  const h = 9 + Math.floor(i / 2)
  return `${String(h).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
})

interface ApptForm {
  patientId: string
  patient: string
  patientCode: string
  date: string
  time: string
  treatment: string
  doctor: string
  chair: string
  duration: string
  notes: string
}

export function AppointmentDialog({
  open,
  onClose,
  editing,
  defaults,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
  defaults?: Partial<ApptForm>
}) {
  const [form, setForm] = useState<ApptForm>({
    patientId: '', patient: '', patientCode: '', date: todayISO(), time: '10:00',
    treatment: '', doctor: DOCTORS[0], chair: CHAIRS[0], duration: '30 min', notes: '',
  })
  const [patientQuery, setPatientQuery] = useState('')
  const [showPatientList, setShowPatientList] = useState(false)
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: patientData } = useList('patients', { q: patientQuery, limit: 8 }, { enabled: open })
  const { data: dayAppts } = useList('appointments', { date: form.date, limit: 200 }, { enabled: open })
  const { data: treatments } = useList('treatment_masters', { limit: 100 }, { enabled: open })

  const create = useCreate('appointments', { invalidate: ['dashboard'] })
  const update = useUpdate('appointments', { invalidate: ['dashboard'] })

  useEffect(() => {
    if (open) {
      setErrors({})
      setPatientQuery('')
      if (editing) {
        setForm({
          patientId: editing.patientId || '', patient: editing.patient || '',
          patientCode: editing.patientCode || '', date: editing.date, time: editing.time,
          treatment: editing.treatment || '', doctor: editing.doctor || DOCTORS[0],
          chair: editing.chair || CHAIRS[0], duration: editing.duration || '30 min',
          notes: editing.notes || '',
        })
      } else {
        setForm((f) => ({
          ...f, patientId: '', patient: '', patientCode: '', treatment: '', notes: '',
          date: defaults?.date ?? todayISO(), time: defaults?.time ?? '10:00',
          doctor: defaults?.doctor ?? DOCTORS[0], chair: defaults?.chair ?? CHAIRS[0],
          duration: '30 min',
        }))
      }
    }
  }, [open, editing, defaults])

  const conflict = useMemo(() => {
    const others = (dayAppts?.items ?? []).filter(
      (a) => a.id !== editing?.id && a.status !== 'Cancelled' && a.time === form.time,
    )
    const doctorBusy = others.find((a) => a.doctor === form.doctor)
    const chairBusy = others.find((a) => a.chair === form.chair)
    if (doctorBusy) return `${form.doctor} already has ${doctorBusy.patient} at ${fmtTime(form.time)}.`
    if (chairBusy) return `${form.chair} is occupied by ${chairBusy.patient} at ${fmtTime(form.time)}.`
    return ''
  }, [dayAppts, form.time, form.doctor, form.chair, editing])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.patient.trim()) errs.patient = 'Choose a patient (or register a new one).'
    if (!form.date) errs.date = 'Pick a date.'
    if (!form.time) errs.time = 'Pick a time.'
    if (!form.treatment.trim()) errs.treatment = 'Enter the treatment or reason for visit.'
    if (conflict) errs.conflict = conflict
    setErrors(errs)
    if (Object.keys(errs).length) {
      if (errs.conflict) toast.error(errs.conflict)
      return
    }
    const payload = { ...form, status: editing?.status ?? 'Scheduled' }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success('Appointment updated'); onClose() },
      })
    } else {
      create.mutate(payload as Partial<Doc>, {
        onSuccess: () => {
          toast.success(`Appointment booked for ${form.patient} · ${fmtTime(form.time)}`)
          onClose()
        },
      })
    }
  }

  const choosePatient = (p: Doc) => {
    setForm((f) => ({
      ...f, patientId: p.id, patient: p.name, patientCode: p.code,
      treatment: f.treatment || p.treatment || '', doctor: p.doctor || f.doctor,
    }))
    setShowPatientList(false)
    setPatientQuery('')
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={editing ? 'Edit Appointment' : 'New Appointment'}
        subtitle={editing ? `${editing.code} · ${editing.patient}` : 'Book a slot in under 30 seconds.'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit as never} loading={create.isPending || update.isPending}>
              {editing ? 'Save Changes' : 'Book Appointment'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Patient picker */}
          <div className="relative sm:col-span-2">
            <Field label="Patient" required error={errors.patient}>
              {form.patient ? (
                <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
                  <Avatar name={form.patient} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{form.patient}</div>
                    <div className="text-xs text-slate-500">{form.patientCode}</div>
                  </div>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => setForm((f) => ({ ...f, patient: '', patientId: '', patientCode: '' }))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={patientQuery}
                      onChange={(e) => { setPatientQuery(e.target.value); setShowPatientList(true) }}
                      onFocus={() => setShowPatientList(true)}
                      placeholder="Search by name, ID or mobile…"
                    />
                    {showPatientList && (patientData?.items?.length ?? 0) > 0 && (
                      <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                        {patientData!.items.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => choosePatient(p)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50"
                          >
                            <Avatar name={p.name} className="h-7 w-7 text-[11px]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                              <span className="block text-xs text-slate-500">{p.code} · {p.mobile}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setNewPatientOpen(true)}>
                    <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
                  </Button>
                </div>
              )}
            </Field>
          </div>

          <Field label="Date" required error={errors.date}>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} min={todayISO()} />
          </Field>
          <Field label="Time" required error={errors.time}>
            <Select value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}>
              {SLOT_TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
            </Select>
          </Field>
          <Field label="Treatment / Reason" required error={errors.treatment} className="sm:col-span-2">
            <Input
              list="treatment-options"
              value={form.treatment}
              onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}
              placeholder="e.g. Root Canal, Consultation"
            />
            <datalist id="treatment-options">
              {(treatments?.items ?? []).map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
          </Field>
          <Field label="Dentist">
            <Select value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Chair">
            <Select value={form.chair} onChange={(e) => setForm((f) => ({ ...f, chair: e.target.value }))}>
              {CHAIRS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Duration">
            <Select value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}>
              {DURATIONS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[42px]" placeholder="Optional" />
          </Field>

          {conflict && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800 sm:col-span-2">
              ⚠ {conflict}
            </p>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Dialog>

      <PatientFormDialog
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onSaved={(p) => choosePatient(p)}
      />
    </>
  )
}

export default function Appointments() {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayISO())
  const [q, setQ] = useState('')
  const [doctor, setDoctor] = useState('')
  const [status, setStatus] = useState(params.get('status') || '')
  const [view, setView] = useState<'day' | 'list'>('day')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [slotDefaults, setSlotDefaults] = useState<Partial<ApptForm>>()
  const [cancelTarget, setCancelTarget] = useState<Doc | null>(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null)
      setDialogOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const { data, isLoading } = useList('appointments', {
    date: view === 'day' ? date : undefined,
    q, ...(doctor ? { doctor } : {}), ...(status ? { status } : {}),
    sort: view === 'day' ? 'time' : 'date', order: view === 'day' ? 'asc' : 'desc',
    limit: 300,
  })
  const appts = data?.items ?? []

  // Week strip counts
  const weekStart = useMemo(() => addDays(new Date(date + 'T00:00'), -3), [date])
  const { data: weekData } = useList('appointments', { limit: 1000, sort: 'time', order: 'asc' })
  const weekCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of weekData?.items ?? []) map[a.date] = (map[a.date] || 0) + 1
    return map
  }, [weekData])

  const update = useUpdate('appointments', { invalidate: ['dashboard'] })

  const counts = useMemo(() => {
    const todays = (weekData?.items ?? []).filter((a) => a.date === todayISO())
    const c: Record<string, number> = { total: todays.length }
    for (const s of STATUSES) c[s] = todays.filter((a) => a.status === s).length
    return c
  }, [weekData])

  const setStatusFor = (a: Doc, s: string) => {
    update.mutate({ id: a.id, status: s }, { onSuccess: () => toast.success(`${a.patient} — ${s}`) })
  }

  const openSlot = (time: string) => {
    setEditing(null)
    setSlotDefaults({ date, time })
    setDialogOpen(true)
  }

  const apptActions = (a: Doc) => (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {a.status === 'Scheduled' && (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setStatusFor(a, 'Waiting') }}>
          <Check className="h-3.5 w-3.5" /> Check in
        </Button>
      )}
      {a.status === 'Waiting' && (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setStatusFor(a, 'Completed') }}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
        </Button>
      )}
      {['Scheduled', 'Waiting'].includes(a.status) && (
        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setCancelTarget(a) }}>
          Cancel
        </Button>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Calendar, scheduling, chair allocation and live workflow"
        actions={
          <Button onClick={() => { setEditing(null); setSlotDefaults(undefined); setDialogOpen(true) }}>
            <CalendarPlus className="h-4 w-4" /> New Appointment
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        <StatCard label="Today" value={counts.total ?? 0} icon={<CalendarDays className="h-5 w-5" />} onClick={() => { setStatus(''); setDate(todayISO()) }} />
        <StatCard label="Scheduled" value={counts.Scheduled ?? 0} icon={<Clock className="h-5 w-5" />} accent="blue" onClick={() => setStatus('Scheduled')} />
        <StatCard label="Waiting" value={counts.Waiting ?? 0} icon={<Clock className="h-5 w-5" />} accent="amber" onClick={() => setStatus('Waiting')} />
        <StatCard label="Completed" value={counts.Completed ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" onClick={() => setStatus('Completed')} />
        <StatCard label="Cancelled" value={counts.Cancelled ?? 0} icon={<X className="h-5 w-5" />} accent="red" onClick={() => setStatus('Cancelled')} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <Button variant="outline" size="icon-sm" onClick={() => setDate(format(addDays(new Date(date + 'T00:00'), -1), 'yyyy-MM-dd'))} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => setDate(format(addDays(new Date(date + 'T00:00'), 1), 'yyyy-MM-dd'))} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-w-0 flex-1 sm:w-[150px] sm:flex-none" />
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search patient, ID or treatment…" className="min-w-0 flex-1 sm:max-w-xs" />
        <Select value={doctor} onChange={(e) => setDoctor(e.target.value)} className="w-36">
          <option value="">All Dentists</option>
          {DOCTORS.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Segmented
          className="ml-auto"
          value={view}
          onChange={(v) => setView(v as 'day' | 'list')}
          options={[{ key: 'day', label: 'Day' }, { key: 'list', label: 'All Upcoming' }]}
        />
      </div>

      {/* Week strip */}
      {view === 'day' && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {Array.from({ length: 7 }).map((_, i) => {
            const dt = addDays(weekStart, i)
            const iso = format(dt, 'yyyy-MM-dd')
            const active = iso === date
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={cn(
                  'flex min-w-[76px] flex-col items-center rounded-xl border px-3 py-2 transition',
                  active ? 'border-brand-600 bg-brand-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300',
                )}
              >
                <span className={cn('text-[10px] font-semibold uppercase', active ? 'text-brand-100' : 'text-slate-400')}>
                  {format(dt, 'EEE')}
                </span>
                <span className="text-lg font-bold leading-6">{format(dt, 'd')}</span>
                <span className={cn('text-[10px]', active ? 'text-brand-100' : 'text-slate-400')}>
                  {weekCounts[iso] || 0} appt{(weekCounts[iso] || 0) === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : view === 'day' ? (
        <Card>
          {appts.length === 0 && (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No appointments on this day"
              message="Tap any slot below or use New Appointment."
            />
          )}
          <ul className="divide-y divide-slate-50">
            {SLOT_TIMES.map((t) => {
              // Bucket each appointment into its half-hour slot so off-grid
              // times (e.g. 10:15) still render.
              const slotOf = (time: string) => {
                const [h, m] = time.split(':').map(Number)
                return `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`
              }
              const bucket = (time: string) => {
                const s = slotOf(time)
                if (s < SLOT_TIMES[0]) return SLOT_TIMES[0]
                if (s > SLOT_TIMES[SLOT_TIMES.length - 1]) return SLOT_TIMES[SLOT_TIMES.length - 1]
                return s
              }
              const slotAppts = appts.filter((a) => bucket(a.time) === t)
              if (!slotAppts.length) {
                return (
                  <li key={t} className="group flex items-center gap-3 px-4 py-1.5 sm:px-5">
                    <span className="w-16 shrink-0 text-xs font-medium text-slate-300">{fmtTime(t)}</span>
                    <button
                      onClick={() => openSlot(t)}
                      className="flex h-7 flex-1 items-center gap-1.5 rounded-lg border border-dashed border-transparent px-2 text-xs text-transparent transition group-hover:border-brand-300 group-hover:text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Book this slot
                    </button>
                  </li>
                )
              }
              return (
                <li key={t} className="flex min-w-0 gap-3 px-4 py-2 sm:px-5">
                  <span className="w-16 shrink-0 pt-2 text-xs font-bold text-slate-500">{fmtTime(t)}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {slotAppts.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => { setEditing(a); setSlotDefaults(undefined); setDialogOpen(true) }}
                        className={cn(
                          'flex cursor-pointer flex-col gap-2 rounded-lg border-l-4 bg-slate-50 px-3 py-2 transition hover:bg-slate-100 sm:flex-row sm:flex-wrap sm:items-center',
                          a.status === 'Completed' ? 'border-emerald-400' :
                          a.status === 'Waiting' ? 'border-amber-400' :
                          a.status === 'Cancelled' ? 'border-red-300 opacity-60' : 'border-sky-400',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-800">{a.patient}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {a.treatment} · {a.doctor} · {a.chair} · {a.duration}
                          </div>
                        </div>
                        {apptActions(a)}
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : (
        <Card>
          {!appts.length ? (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No appointments found" message="Adjust the filters or book a new appointment." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {appts.map((a) => (
                <li
                  key={a.id}
                  onClick={() => { setEditing(a); setDialogOpen(true) }}
                  className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
                >
                  <div className="w-24 shrink-0">
                    <div className="text-[13px] font-bold text-slate-800">{format(new Date(a.date + 'T00:00'), 'dd MMM')}</div>
                    <div className="text-xs text-slate-500">{fmtTime(a.time)}</div>
                  </div>
                  <Avatar name={a.patient} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{a.patient}</div>
                    <div className="truncate text-xs text-slate-500">{a.treatment} · {a.doctor} · {a.chair}</div>
                  </div>
                  <StatusBadge status={a.status} />
                  {apptActions(a)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        defaults={slotDefaults}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            update.mutate({ id: cancelTarget.id, status: 'Cancelled' }, {
              onSuccess: () => { toast.success('Appointment cancelled'); setCancelTarget(null) },
            })
          }
        }}
        title="Cancel this appointment?"
        message={
          cancelTarget
            ? `${cancelTarget.patient} · ${fmtTime(cancelTarget.time)} · ${cancelTarget.treatment}. The slot will become available again.`
            : ''
        }
        confirmLabel="Cancel Appointment"
      />
    </div>
  )
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, MapPin, Pencil, Star, Stethoscope, Trash2, UserPlus } from 'lucide-react'
import { fmtDate, fmtINR, fmtTime, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput } from '@/components/ui/bits'

const SPECIALTIES = [
  'General & Restorative Dentistry',
  'Oral & Maxillofacial Surgery',
  'Orthodontics & Clear Aligners',
  'Periodontics & Laser Dentistry',
  'Endodontics & Microscopic RCT',
  'Prosthodontics & Full Mouth Rehab',
  'Implantology & Oral Surgery',
  'Paediatric Dentistry',
]

interface ConsultantForm {
  name: string
  specialty: string
  type: string
  credentials: string
  experience: string
  availability: string
  location: string
  fee: string
  status: string
}

const emptyForm: ConsultantForm = {
  name: '', specialty: '', type: 'Visiting', credentials: '', experience: '',
  availability: '', location: '', fee: '', status: 'Active',
}

function ConsultantFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
}) {
  const [form, setForm] = useState<ConsultantForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('consultants', { successMessage: 'Consultant added', invalidate: ['dashboard'] })
  const update = useUpdate('consultants', { successMessage: 'Consultant updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        editing
          ? {
              name: editing.name || '', specialty: editing.specialty || '', type: editing.type || 'Visiting',
              credentials: editing.credentials || '', experience: String(editing.experience ?? ''),
              availability: editing.availability || '', location: editing.location || '',
              fee: String(editing.fee ?? ''), status: editing.status || 'Active',
            }
          : emptyForm,
      )
    }
  }, [open, editing])

  const set = (k: keyof ConsultantForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Consultant name is required.'
    if (!form.specialty.trim()) errs.specialty = 'Enter the specialty.'
    if (form.experience && (Number(form.experience) < 0 || Number(form.experience) > 60)) errs.experience = 'Enter valid years of experience.'
    if (form.fee && Number(form.fee) < 0) errs.fee = 'Enter a valid fee.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      ...form,
      experience: Number(form.experience || 0),
      fee: Number(form.fee || 0),
      rating: editing?.rating ?? 4.5,
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload as Partial<Doc>, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Consultant' : 'Add Consultant'}
      subtitle={editing ? editing.code : 'Add an in-house doctor or a visiting specialist to the roster.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Add Consultant'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Dr. Vivekanandan M" autoFocus />
        </Field>
        <Field label="Specialty" required error={errors.specialty}>
          <Input list="specialty-options" value={form.specialty} onChange={set('specialty')} placeholder="e.g. Orthodontics" />
          <datalist id="specialty-options">
            {SPECIALTIES.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Type" required>
          <Select value={form.type} onChange={set('type')}>
            {['In-house', 'Visiting'].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Credentials">
          <Input value={form.credentials} onChange={set('credentials')} placeholder="e.g. BDS, MDS, FDSRCS" />
        </Field>
        <Field label="Experience (years)" error={errors.experience}>
          <Input type="number" value={form.experience} onChange={set('experience')} placeholder="12" min={0} />
        </Field>
        <Field label="Availability" hint="Shown to the front desk while booking.">
          <Input value={form.availability} onChange={set('availability')} placeholder="e.g. Sat · 10 AM–2 PM" />
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={set('location')} placeholder="e.g. Trichy" />
        </Field>
        <Field label="Consultation Fee (₹)" error={errors.fee}>
          <Input type="number" value={form.fee} onChange={set('fee')} placeholder="1200" min={0} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {['Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function ConsultantProfileDialog({
  consultant,
  onClose,
  onEdit,
}: {
  consultant: Doc | null
  onClose: () => void
  onEdit: (c: Doc) => void
}) {
  const navigate = useNavigate()
  const open = !!consultant

  const { data: bookingData } = useList(
    'consultant_bookings',
    { consultant: consultant?.name, sort: 'date', order: 'asc', limit: 100 },
    { enabled: open },
  )
  const { data: apptData } = useList(
    'appointments',
    { doctor: consultant?.name, sort: 'date', order: 'asc', limit: 100 },
    { enabled: open },
  )

  const upcomingBookings = (bookingData?.items ?? []).filter(
    (b) => b.date >= todayISO() && b.status !== 'Cancelled',
  )
  const upcomingAppts = (apptData?.items ?? []).filter(
    (a) => a.date >= todayISO() && !['Cancelled', 'Completed'].includes(a.status),
  )

  if (!consultant) return null

  const detail = (label: string, value: string) => (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[13px] font-semibold text-slate-800">{value || '—'}</div>
    </div>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={consultant.name}
      subtitle={`${consultant.code} · ${consultant.type} consultant`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => onEdit(consultant)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button onClick={() => navigate('/book-consultant')}>
            <CalendarPlus className="h-4 w-4" /> Book
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={consultant.name} className="h-14 w-14 text-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-900">{consultant.name}</span>
              <StatusBadge status={consultant.status} />
            </div>
            <div className="text-[13px] text-slate-500">{consultant.specialty}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {consultant.rating ?? '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {detail('Credentials', consultant.credentials)}
          {detail('Experience', `${consultant.experience ?? 0} years`)}
          {detail('Fee', fmtINR(consultant.fee))}
          {detail('Availability', consultant.availability)}
          {detail('Location', consultant.location)}
          {detail('Type', consultant.type)}
        </div>

        <div>
          <h4 className="mb-2 text-[13px] font-semibold text-slate-800">Upcoming Consultant Bookings</h4>
          {!upcomingBookings.length ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">No upcoming consultant bookings.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {upcomingBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-20 shrink-0">
                    <div className="text-[13px] font-bold text-slate-800">{fmtDate(b.date)}</div>
                    <div className="text-xs text-slate-500">{fmtTime(b.time)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-slate-800">{b.patient}</div>
                    <div className="truncate text-xs text-slate-500">{b.reason}</div>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-[13px] font-semibold text-slate-800">Upcoming Appointments</h4>
          {!upcomingAppts.length ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">No upcoming appointments assigned.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {upcomingAppts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-20 shrink-0">
                    <div className="text-[13px] font-bold text-slate-800">{fmtDate(a.date)}</div>
                    <div className="text-xs text-slate-500">{fmtTime(a.time)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-slate-800">{a.patient}</div>
                    <div className="truncate text-xs text-slate-500">{a.treatment} · {a.chair}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  )
}

export default function Consultants() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('All')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [profile, setProfile] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  const { data, isLoading } = useList('consultants', { q, sort: 'code', order: 'asc', limit: 200 })
  const all = data?.items ?? []

  const consultants = useMemo(
    () => (tab === 'All' ? all : all.filter((c) => c.type === tab)),
    [all, tab],
  )

  const counts = useMemo(
    () => ({
      All: all.length,
      'In-house': all.filter((c) => c.type === 'In-house').length,
      Visiting: all.filter((c) => c.type === 'Visiting').length,
    }),
    [all],
  )

  const del = useDelete('consultants', { successMessage: 'Consultant removed' })

  return (
    <div>
      <PageHeader
        title="Consultants"
        subtitle="In-house clinical team and the visiting specialist network"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <UserPlus className="h-4 w-4" /> Add Consultant
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All', count: counts.All },
          { key: 'In-house', label: 'In-house', count: counts['In-house'] },
          { key: 'Visiting', label: 'Visiting', count: counts.Visiting },
        ]}
      />

      <div className="mb-4">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search name, code, specialty or location…"
          className="sm:max-w-sm"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !consultants.length ? (
        <Card>
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title={q ? 'No consultants match your search' : 'No consultants yet'}
            message={q ? 'Try a different name, specialty or location.' : 'Add your first consultant to build the roster.'}
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <UserPlus className="h-4 w-4" /> Add Consultant
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {consultants.map((c) => (
            <Card
              key={c.id}
              onClick={() => setProfile(c)}
              className="cursor-pointer p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="truncate text-xs text-slate-500">{c.code} · {c.specialty}</div>
                  </div>
                </div>
                <Badge tone={c.type === 'Visiting' ? 'violet' : 'brand'}>{c.type}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">{c.credentials || '—'}</span>
                <span>{c.experience ?? 0} yrs exp</span>
                <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {c.rating ?? '—'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Availability</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{c.availability || '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fee</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{fmtINR(c.fee)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{c.location || '—'}</span>
                </span>
                <div className="flex items-center gap-1">
                  <StatusBadge status={c.status} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit consultant"
                    onClick={(e) => { e.stopPropagation(); setEditing(c); setFormOpen(true) }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete consultant"
                    className="text-red-600 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConsultantFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      <ConsultantProfileDialog
        consultant={profile}
        onClose={() => setProfile(null)}
        onEdit={(c) => { setProfile(null); setEditing(c); setFormOpen(true) }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
        title="Remove this consultant?"
        message={
          deleteTarget ? (
            <>
              <span className="font-semibold">{deleteTarget.name}</span> · {deleteTarget.specialty}. Past bookings
              and appointments are kept, but the consultant will no longer be bookable.
            </>
          ) : ''
        }
        confirmLabel="Remove Consultant"
        loading={del.isPending}
      />
    </div>
  )
}

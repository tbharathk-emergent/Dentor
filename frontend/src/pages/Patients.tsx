import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, LayoutGrid, List, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { maskMobile, todayISO, useCreate, useList, useSettings, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge, statusTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { fmtDate } from '@/lib/hooks'

const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const SOURCES = ['Walk-in', 'Referral', 'Google', 'Instagram', 'Facebook', 'WhatsApp', 'Dental Camp', 'Website']
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export interface PatientFormValues {
  name: string
  age: string
  gender: string
  mobile: string
  email: string
  blood: string
  doctor: string
  treatment: string
  risk: string
  source: string
  address: string
  allergy: string
  history: string
}

const emptyForm: PatientFormValues = {
  name: '', age: '', gender: 'Male', mobile: '', email: '', blood: '',
  doctor: DOCTORS[0], treatment: '', risk: 'Low', source: 'Walk-in',
  address: '', allergy: '', history: '',
}

export function PatientFormDialog({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
  onSaved?: (p: Doc) => void
}) {
  const [form, setForm] = useState<PatientFormValues>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('patients', { successMessage: 'Patient registered', invalidate: ['dashboard'] })
  const update = useUpdate('patients', { successMessage: 'Patient updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(editing ? { ...emptyForm, ...editing, age: String(editing.age ?? '') } : emptyForm)
    }
  }, [open, editing])

  const set = (k: keyof PatientFormValues) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Patient name is required.'
    if (!form.age || Number(form.age) <= 0 || Number(form.age) > 120) errs.age = 'Enter a valid age.'
    if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) errs.mobile = 'Enter a 10-digit mobile number.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = { ...form, age: Number(form.age), mobile: form.mobile.replace(/\D/g, ''), status: editing?.status ?? 'New', lastVisit: editing?.lastVisit ?? todayISO() }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: (p) => { onSaved?.(p as Doc); onClose() } })
    } else {
      create.mutate(payload as Partial<Doc>, {
        onSuccess: (p) => {
          onSaved?.(p as Doc)
          onClose()
          toast.success(`Registered with ID ${(p as Doc).code}`)
        },
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Patient' : 'Register New Patient'}
      subtitle={editing ? editing.code : 'Only name, age and mobile are mandatory — everything else can wait.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Register Patient'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Ravi Kumar" autoFocus />
        </Field>
        <Field label="Age" required error={errors.age}>
          <Input type="number" value={form.age} onChange={set('age')} placeholder="36" min={0} />
        </Field>
        <Field label="Gender" required>
          <Select value={form.gender} onChange={set('gender')}>
            {['Male', 'Female', 'Other'].map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Mobile Number" required error={errors.mobile}>
          <Input inputMode="numeric" value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} placeholder="optional" />
        </Field>
        <Field label="Blood Group">
          <Select value={form.blood} onChange={set('blood')}>
            <option value="">Not recorded</option>
            {BLOOD.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Assigned Dentist">
          <Select value={form.doctor} onChange={set('doctor')}>
            {DOCTORS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Primary Treatment / Complaint">
          <Input value={form.treatment} onChange={set('treatment')} placeholder="e.g. Root Canal, Consultation" />
        </Field>
        <Field label="Medical Risk">
          <Select value={form.risk} onChange={set('risk')}>
            {['Low', 'Medium', 'High'].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source} onChange={set('source')}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={form.address} onChange={set('address')} placeholder="Street, area, city" />
        </Field>
        <Field label="Allergies" hint="Shown as a red alert across clinical screens.">
          <Input value={form.allergy} onChange={set('allergy')} placeholder="e.g. Penicillin" />
        </Field>
        <Field label="Medical History">
          <Textarea value={form.history} onChange={set('history')} placeholder="Diabetes, cardiac conditions, current medication…" className="min-h-[42px]" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

export default function Patients() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [risk, setRisk] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const { data, isLoading } = useList('patients', { q, ...(risk ? { risk } : {}), sort: 'created_at', order: 'desc' })
  const { data: settings } = useSettings()
  const mask = Boolean(settings?.maskPatient)
  const patients = data?.items ?? []

  const stats = useMemo(() => {
    const total = data?.total ?? 0
    const month = todayISO().slice(0, 7)
    const newThisMonth = patients.filter((p) => String(p.created_at || '').startsWith(month)).length
    const high = patients.filter((p) => p.risk === 'High').length
    return { total, newThisMonth, high }
  }, [data, patients])

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Patient records, treatment history and clinical files"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add Patient
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatCard label="Total patients" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <StatCard label="New this month" value={stats.newThisMonth} icon={<UserPlus className="h-5 w-5" />} accent="green" />
        <StatCard label="High risk" value={stats.high} icon={<CalendarDays className="h-5 w-5" />} accent="red" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, ID, mobile or treatment…" className="min-w-0 flex-1 sm:max-w-sm" />
        <Select value={risk} onChange={(e) => setRisk(e.target.value)} className="w-32">
          <option value="">All Risk</option>
          {['Low', 'Medium', 'High'].map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Segmented
          className="ml-auto"
          value={view}
          onChange={(v) => setView(v as 'grid' | 'list')}
          options={[
            { key: 'grid', label: <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> Grid</span> },
            { key: 'list', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> List</span> },
          ]}
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : !patients.length ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={q || risk ? 'No patients match your search' : 'No patients yet'}
            message={q || risk ? 'Try a different name, ID or filter.' : 'Register your first patient to get started.'}
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add Patient
              </Button>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((p) => (
            <Card
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}`)}
              className="cursor-pointer p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.name} src={p.photo} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.code} · {p.age}/{String(p.gender || '').charAt(0)}
                    </div>
                  </div>
                </div>
                <Badge tone={statusTone(p.risk === 'High' ? 'overdue' : p.risk === 'Medium' ? 'pending' : 'active')}>
                  {p.risk}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Treatment</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{p.treatment || '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Dentist</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{p.doctor || '—'}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={p.status} />
                <span className="text-xs text-slate-400">Last visit · {fmtDate(p.lastVisit)}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {patients.map((p) => (
              <li
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <Avatar name={p.name} src={p.photo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {p.code} · {p.age}/{String(p.gender || '').charAt(0)} · {maskMobile(p.mobile, mask)}
                  </div>
                </div>
                <div className="hidden min-w-0 flex-1 sm:block">
                  <div className="truncate text-[13px] text-slate-700">{p.treatment || '—'}</div>
                  <div className="truncate text-xs text-slate-400">{p.doctor}</div>
                </div>
                <Badge tone={p.risk === 'High' ? 'red' : p.risk === 'Medium' ? 'amber' : 'green'}>{p.risk}</Badge>
                <span className="hidden text-xs text-slate-400 md:block">{fmtDate(p.lastVisit)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PatientFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}

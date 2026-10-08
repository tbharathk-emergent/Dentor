import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ListSkeleton } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const STATUSES = ['Planned', 'In Progress', 'Completed', 'Deferred', 'Cancelled']

const PERIODS = [
  { key: 'previous', label: 'Previous Treatments', icon: CheckCircle2, dot: 'bg-emerald-500', defaultStatus: 'Completed' },
  { key: 'present', label: 'Present Treatments', icon: History, dot: 'bg-sky-500', defaultStatus: 'In Progress' },
  { key: 'upcoming', label: 'Upcoming Treatments', icon: Clock, dot: 'bg-amber-500', defaultStatus: 'Planned' },
] as const

interface TimelineForm {
  period: string
  name: string
  date: string
  tooth: string
  doctor: string
  status: string
  price: string
  notes: string
}

const emptyForm: TimelineForm = {
  period: 'present', name: '', date: todayISO(), tooth: '', doctor: DOCTORS[0],
  status: 'In Progress', price: '', notes: '',
}

export function TimelineTab({ patientCode }: { patientCode: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [form, setForm] = useState<TimelineForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useList('patient_timeline', { patientId: patientCode, sort: 'date', order: 'desc', limit: 200 })
  const { data: masters } = useList('treatment_masters', { limit: 100 }, { enabled: dialogOpen })
  const create = useCreate('patient_timeline', { successMessage: 'Timeline entry added' })
  const update = useUpdate('patient_timeline', { successMessage: 'Timeline entry updated' })
  const remove = useDelete('patient_timeline', { successMessage: 'Timeline entry deleted' })
  const entries = data?.items ?? []

  const grouped = useMemo(() => {
    const map: Record<string, Doc[]> = { previous: [], present: [], upcoming: [] }
    for (const e of entries) (map[e.period] ?? map.present).push(e)
    return map
  }, [entries])

  useEffect(() => {
    if (dialogOpen) {
      setErrors({})
      setForm(
        editing
          ? {
              period: editing.period || 'present', name: editing.name || '', date: editing.date || todayISO(),
              tooth: editing.tooth || '', doctor: editing.doctor || DOCTORS[0], status: editing.status || 'Planned',
              price: editing.price != null && editing.price !== '' ? String(editing.price) : '', notes: editing.notes || '',
            }
          : emptyForm,
      )
    }
  }, [dialogOpen, editing])

  const openAdd = (period?: string) => {
    setEditing(null)
    setDialogOpen(true)
    if (period) {
      const preset = PERIODS.find((p) => p.key === period)
      setTimeout(() => setForm((f) => ({ ...f, period, status: preset?.defaultStatus ?? f.status })), 0)
    }
  }
  const openEdit = (e: Doc) => { setEditing(e); setDialogOpen(true) }

  const setPeriod = (period: string) => {
    const preset = PERIODS.find((p) => p.key === period)
    setForm((f) => ({ ...f, period, status: preset?.defaultStatus ?? f.status }))
  }

  const pickTreatment = (name: string) => {
    const m = (masters?.items ?? []).find((t) => t.name === name)
    setForm((f) => ({ ...f, name, price: m && !f.price ? String(m.price ?? '') : f.price }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Enter the treatment name.'
    if (!form.date) errs.date = 'Pick a date.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = {
      patientId: patientCode,
      period: form.period,
      name: form.name.trim(),
      date: form.date,
      tooth: form.tooth.trim(),
      doctor: form.doctor,
      status: form.status,
      price: form.price ? Number(form.price) : 0,
      notes: form.notes.trim(),
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      create.mutate(payload as Partial<Doc>, { onSuccess: () => setDialogOpen(false) })
    }
  }

  return (
    <Card>
      <CardHeader
        title="Treatment Timeline"
        subtitle="Previous, present and upcoming care in one chronological view"
        actions={
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="h-4 w-4" /> Add Treatment
          </Button>
        }
      />
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : !entries.length ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No timeline entries yet"
          message="Build the patient's care story — past treatments, active work and what's planned next."
          action={
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-4 w-4" /> Add Treatment
            </Button>
          }
        />
      ) : (
        <div className="space-y-6 p-4 sm:p-5">
          {PERIODS.map(({ key, label, icon: Icon, dot }) => (
            <section key={key}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <h4 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {grouped[key].length}
                </span>
                <button
                  onClick={() => openAdd(key)}
                  className="ml-auto text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  + Add here
                </button>
              </div>
              {!grouped[key].length ? (
                <p className="ml-6 border-l-2 border-dashed border-slate-200 py-1 pl-4 text-[13px] text-slate-400">
                  Nothing recorded in this period.
                </p>
              ) : (
                <ol className="ml-6 space-y-3 border-l-2 border-slate-200">
                  {grouped[key].map((e) => (
                    <li key={e.id} className="relative pl-5">
                      <span className={cn('absolute -left-[7px] top-4 h-3 w-3 rounded-full ring-4 ring-white', dot)} />
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{e.name}</span>
                          <StatusBadge status={e.status} />
                          <span className="ml-auto text-[13px] font-semibold text-slate-700">
                            {e.price ? fmtINR(e.price) : ''}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {fmtDate(e.date)}{e.tooth ? ` · Tooth ${e.tooth}` : ''} · {e.doctor || 'Unassigned'}
                        </div>
                        {e.notes && <p className="mt-1.5 text-[13px] text-slate-600">{e.notes}</p>}
                        <div className="mt-2 flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(e)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Timeline Entry' : 'Add Timeline Entry'}
        subtitle={`Patient ${patientCode}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit as never} loading={create.isPending || update.isPending}>
              {editing ? 'Save Changes' : 'Add to Timeline'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Timeline Stage">
            <Select value={form.period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="previous">Previous</option>
              <option value="present">Present</option>
              <option value="upcoming">Upcoming</option>
            </Select>
          </Field>
          <Field label="Treatment" required error={errors.name}>
            <Input
              list="timeline-treatment-options"
              value={form.name}
              onChange={(e) => pickTreatment(e.target.value)}
              placeholder="e.g. Zirconia Crown"
            />
            <datalist id="timeline-treatment-options">
              {(masters?.items ?? []).map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
          </Field>
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Tooth / Region" hint="e.g. 46 or Full Mouth">
            <Input value={form.tooth} onChange={(e) => setForm((f) => ({ ...f, tooth: e.target.value }))} placeholder="46" />
          </Field>
          <Field label="Doctor">
            <Select value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Price (₹)">
            <Input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Clinical Notes">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="min-h-[42px]" />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
        loading={remove.isPending}
        title="Delete this timeline entry?"
        message={deleting ? `${deleting.name} · ${fmtDate(deleting.date)} will be removed from the timeline.` : ''}
      />
    </Card>
  )
}

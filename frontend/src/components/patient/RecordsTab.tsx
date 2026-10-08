import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/bits'

const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const STATUSES = ['Planned', 'In Progress', 'Completed']

interface RecordForm {
  name: string
  tooth: string
  doctor: string
  date: string
  status: string
  cost: string
  notes: string
}

const emptyForm: RecordForm = {
  name: '', tooth: '', doctor: DOCTORS[0], date: todayISO(), status: 'Planned', cost: '', notes: '',
}

/** Shared CRUD tab for patient_treatments and patient_procedures. */
export function RecordsTab({
  resource,
  singular,
  plural,
  patientCode,
}: {
  resource: 'patient_treatments' | 'patient_procedures'
  singular: string
  plural: string
  patientCode: string
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [form, setForm] = useState<RecordForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useList(resource, { patientId: patientCode, sort: 'date', order: 'desc', limit: 200 })
  const { data: masters } = useList('treatment_masters', { limit: 100 }, { enabled: dialogOpen })
  const create = useCreate(resource, { successMessage: `${singular} added` })
  const update = useUpdate(resource, { successMessage: `${singular} updated` })
  const remove = useDelete(resource, { successMessage: `${singular} deleted` })

  const rows = data?.items ?? []

  useEffect(() => {
    if (dialogOpen) {
      setErrors({})
      setForm(
        editing
          ? {
              name: editing.name || '', tooth: editing.tooth || '', doctor: editing.doctor || DOCTORS[0],
              date: editing.date || todayISO(), status: editing.status || 'Planned',
              cost: editing.cost != null && editing.cost !== '' ? String(editing.cost) : '', notes: editing.notes || '',
            }
          : emptyForm,
      )
    }
  }, [dialogOpen, editing])

  const set = (k: keyof RecordForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (row: Doc) => { setEditing(row); setDialogOpen(true) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = `Enter the ${singular.toLowerCase()} name.`
    if (!form.date) errs.date = 'Pick a date.'
    if (form.cost && Number(form.cost) < 0) errs.cost = 'Cost cannot be negative.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      patientId: patientCode,
      name: form.name.trim(),
      tooth: form.tooth.trim(),
      doctor: form.doctor,
      date: form.date,
      status: form.status,
      cost: form.cost ? Number(form.cost) : 0,
      notes: form.notes.trim(),
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      create.mutate(payload as Partial<Doc>, { onSuccess: () => setDialogOpen(false) })
    }
  }

  const pickMaster = (name: string) => {
    const m = (masters?.items ?? []).find((t) => t.name === name)
    setForm((f) => ({ ...f, name, cost: m && !f.cost ? String(m.price ?? '') : f.cost }))
  }

  const actions = (row: Doc) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${singular.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-red-600 hover:bg-red-50" aria-label={`Delete ${singular.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); setDeleting(row) }}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  return (
    <Card>
      <CardHeader
        title={plural}
        subtitle={`Current and previous ${plural.toLowerCase()} for this patient`}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add {singular}
          </Button>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={openEdit}
        empty={
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title={`No ${plural.toLowerCase()} recorded`}
            message={`${plural} you add will appear here with status and cost.`}
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add {singular}
              </Button>
            }
          />
        }
        columns={[
          { key: 'date', header: 'Date', cell: (r) => <span className="whitespace-nowrap text-slate-600">{fmtDate(r.date)}</span> },
          { key: 'name', header: singular, cell: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
          { key: 'tooth', header: 'Tooth', cell: (r) => <span className="text-slate-600">{r.tooth || '—'}</span> },
          { key: 'doctor', header: 'Dentist', cell: (r) => <span className="text-slate-600">{r.doctor || '—'}</span> },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'cost', header: 'Cost', align: 'right', cell: (r) => <span className="font-medium text-slate-700">{r.cost ? fmtINR(r.cost) : '—'}</span> },
          { key: 'actions', header: '', align: 'right', cell: actions },
        ]}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-800">{r.name}</span>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {fmtDate(r.date)}{r.tooth ? ` · Tooth ${r.tooth}` : ''} · {r.doctor || 'Unassigned'}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-700">{r.cost ? fmtINR(r.cost) : 'No cost recorded'}</span>
              {actions(r)}
            </div>
          </div>
        )}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Edit ${singular}` : `Add ${singular}`}
        subtitle={`Patient ${patientCode}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit as never} loading={create.isPending || update.isPending}>
              {editing ? 'Save Changes' : `Add ${singular}`}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`${singular} Name`} required error={errors.name} className="sm:col-span-2">
            <Input
              list={`${resource}-master-options`}
              value={form.name}
              onChange={(e) => pickMaster(e.target.value)}
              placeholder="e.g. Root Canal Treatment"
              autoFocus
            />
            <datalist id={`${resource}-master-options`}>
              {(masters?.items ?? []).map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
          </Field>
          <Field label="Tooth / Region" hint="e.g. 46 or Full Mouth">
            <Input value={form.tooth} onChange={set('tooth')} placeholder="46" />
          </Field>
          <Field label="Dentist">
            <Select value={form.doctor} onChange={set('doctor')}>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Cost (₹)" error={errors.cost}>
            <Input type="number" min={0} value={form.cost} onChange={set('cost')} placeholder="0" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Clinical notes, materials, follow-up…" className="min-h-[64px]" />
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
        title={`Delete this ${singular.toLowerCase()}?`}
        message={deleting ? `${deleting.name} · ${fmtDate(deleting.date)} will be permanently removed from this patient's record.` : ''}
      />
    </Card>
  )
}

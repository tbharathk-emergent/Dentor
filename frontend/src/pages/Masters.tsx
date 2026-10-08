import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Database, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ListSkeleton, PageHeader, SearchInput } from '@/components/ui/bits'

const MODULES: { key: string; label: string; types: string[] }[] = [
  { key: 'clinical', label: 'Clinical', types: ['Treatments', 'Procedures', 'Diagnosis', 'Clinical Findings'] },
  { key: 'patients', label: 'Patients', types: ['Patient Types', 'Referral Sources', 'Medical Conditions', 'Allergies', 'Relationship Types'] },
  { key: 'appointments', label: 'Appointments', types: ['Appointment Types', 'Appointment Status', 'Chairs', 'Clinical Rooms', 'Cancellation Reasons'] },
  { key: 'finance', label: 'Finance', types: ['Service Price List', 'Tax Rates', 'Payment Modes', 'Discount Reasons', 'Cost Centres'] },
  { key: 'inventory', label: 'Inventory', types: ['Item Categories', 'Units of Measure', 'Warehouses', 'Manufacturers', 'Suppliers'] },
  { key: 'hr', label: 'HR', types: ['Departments', 'Designations', 'Shift Types', 'Leave Types', 'Employment Types'] },
  { key: 'pharmacy', label: 'Pharmacy', types: ['Drug Categories', 'Dosage Forms', 'Routes', 'Drug Schedules', 'Pharmacy Suppliers'] },
  { key: 'laboratory', label: 'Laboratory', types: ['Lab Products', 'Materials', 'Shade Systems', 'Lab Stages', 'Dental Laboratories'] },
  { key: 'communication', label: 'Communication', types: ['Message Templates', 'Communication Channels', 'Patient Tags', 'Campaign Categories', 'Consent Types'] },
]

export default function Masters() {
  const [module, setModule] = useState('clinical')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  const mod = MODULES.find((m) => m.key === module)!
  const { data, isLoading } = useList('masters', { module, q, ...(type ? { type } : {}), sort: 'sort', order: 'asc', limit: 500 })
  const rows = data?.items ?? []

  const update = useUpdate('masters')
  const remove = useDelete('masters', { successMessage: 'Master record deleted' })

  useEffect(() => setType(''), [module])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.type] = (c[r.type] || 0) + 1
    return c
  }, [rows])

  const toggle = (r: Doc) =>
    update.mutate(
      { id: r.id, status: r.status === 'Active' ? 'Inactive' : 'Active' },
      { onSuccess: () => toast.success(`${r.name} marked ${r.status === 'Active' ? 'Inactive' : 'Active'}`) },
    )

  return (
    <div>
      <PageHeader
        title="Masters"
        subtitle="Reference data used across every Dentor module"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Master
          </Button>
        }
      />

      <Tabs className="mb-4" value={module} onChange={setModule} tabs={MODULES.map((m) => ({ key: m.key, label: m.label }))} />

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder={`Search ${mod.label.toLowerCase()} masters…`} className="min-w-0 flex-1 sm:max-w-sm" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-52">
          <option value="">All Types</option>
          {mod.types.map((t) => <option key={t}>{t}{counts[t] ? ` (${counts[t]})` : ''}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : !rows.length ? (
          <EmptyState icon={<Database className="h-6 w-6" />} title="No master records" message="Add reference values for this module." action={<Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="h-4 w-4" /> Add Master</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="w-20 shrink-0 text-xs font-bold text-slate-400">{r.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{r.name}</div>
                  <div className="truncate text-xs text-slate-500">{r.type} · {r.detail}</div>
                </div>
                <span className="hidden text-xs text-slate-400 md:block">Updated {fmtDate(r.updated_at)}</span>
                <button onClick={() => toggle(r)} title="Toggle status">
                  <StatusBadge status={r.status} />
                </button>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setFormOpen(true) }}>Edit</Button>
                  <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => setDeleteTarget(r)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MasterDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        module={module}
        types={mod.types}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null) } }}
        title="Delete master record?"
        message={deleteTarget ? `“${deleteTarget.name}” (${deleteTarget.type}). Screens using this value will no longer offer it.` : ''}
      />
    </div>
  )
}

function MasterDialog({
  open,
  onClose,
  module,
  types,
  editing,
}: {
  open: boolean
  onClose: () => void
  module: string
  types: string[]
  editing: Doc | null
}) {
  const [form, setForm] = useState({ name: '', type: types[0], detail: '', code: '' })
  const create = useCreate('masters', { successMessage: 'Master record added' })
  const update = useUpdate('masters', { successMessage: 'Master record updated' })

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, type: editing.type, detail: editing.detail || '', code: editing.code || '' }
          : { name: '', type: types[0], detail: '', code: '' },
      )
    }
  }, [open, editing, types])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a name for this master value.')
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: onClose })
    } else {
      const code = form.code.trim() || `${form.type.replace(/[^A-Z]/g, '').slice(0, 3) || 'MST'}-${String(Date.now()).slice(-4)}`
      create.mutate({ ...form, code, module, status: 'Active', sort: 99 }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Master' : 'Add Master'}
      subtitle={editing ? editing.code : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Add Record'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type" required>
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        </Field>
        <Field label="Detail" hint="Category, rate, duration — shown alongside the name.">
          <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
        </Field>
        {!editing && (
          <Field label="Code" hint="Leave blank to auto-generate.">
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. TRT-003" />
          </Field>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

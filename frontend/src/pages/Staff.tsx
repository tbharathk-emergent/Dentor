import { useEffect, useState, type FormEvent } from 'react'
import { IdCard, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'

const DEPARTMENTS = ['Clinical', 'Front Desk', 'Pharmacy', 'Laboratory', 'Accounts', 'Administration', 'Housekeeping']
const EMPLOYMENT = ['Full Time', 'Part Time', 'Consultant', 'Contract']

export default function Staff() {
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  const { data, isLoading } = useList('staff', { q, ...(department ? { department } : {}), sort: 'code', order: 'asc' })
  const rows = data?.items ?? []
  const remove = useDelete('staff', { successMessage: 'Staff member removed' })

  const active = rows.filter((r) => r.status === 'Active').length
  const clinical = rows.filter((r) => r.department === 'Clinical').length

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Team directory, roles and employment details"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatCard label="Team members" value={data?.total ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active" value={active} icon={<IdCard className="h-5 w-5" />} accent="green" />
        <StatCard label="Clinical team" value={clinical} icon={<IdCard className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, role or mobile…" className="min-w-0 flex-1 sm:max-w-sm" />
        <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-44">
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : !rows.length ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No staff found" message="Add your first team member." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{s.name}</span>
                    <span className="text-xs text-slate-400">{s.code}</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">{s.role} · {s.department} · {s.mobile}</div>
                </div>
                <Badge tone="slate">{s.employment}</Badge>
                <span className="hidden w-24 text-right text-[13px] font-semibold text-slate-700 md:block">
                  {s.salary ? fmtINR(s.salary) : '—'}
                </span>
                <span className="hidden text-xs text-slate-400 lg:block">Joined {fmtDate(s.joined)}</span>
                <StatusBadge status={s.status} />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setFormOpen(true) }}>Edit</Button>
                  <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => setDeleteTarget(s)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <StaffDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null) } }}
        title="Remove staff member?"
        message={deleteTarget ? `${deleteTarget.name} (${deleteTarget.role}) will be removed from the directory.` : ''}
        confirmLabel="Remove"
      />
    </div>
  )
}

function StaffDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Doc | null }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const create = useCreate('staff', { successMessage: 'Staff member added' })
  const update = useUpdate('staff', { successMessage: 'Staff member updated' })

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, role: editing.role, department: editing.department, mobile: editing.mobile || '', email: editing.email || '', employment: editing.employment || 'Full Time', salary: String(editing.salary ?? ''), status: editing.status || 'Active', joined: editing.joined || '' }
          : { name: '', role: '', department: DEPARTMENTS[0], mobile: '', email: '', employment: 'Full Time', salary: '', status: 'Active', joined: new Date().toISOString().slice(0, 10) },
      )
    }
  }, [open, editing])

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter the staff member’s name.')
    if (!form.role.trim()) return toast.error('Enter their role / designation.')
    if (form.mobile && !/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) return toast.error('Mobile must be 10 digits.')
    const payload = { ...form, salary: Number(form.salary) || 0 }
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    else create.mutate(payload as Partial<Doc>, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Staff' : 'Add Staff'}
      subtitle={editing?.code}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name" required className="sm:col-span-2">
          <Input value={form.name || ''} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Role / Designation" required>
          <Input value={form.role || ''} onChange={set('role')} placeholder="e.g. Receptionist" />
        </Field>
        <Field label="Department">
          <Select value={form.department || DEPARTMENTS[0]} onChange={set('department')}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Mobile">
          <Input inputMode="numeric" value={form.mobile || ''} onChange={set('mobile')} placeholder="10-digit mobile" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Employment">
          <Select value={form.employment || 'Full Time'} onChange={set('employment')}>
            {EMPLOYMENT.map((e2) => <option key={e2}>{e2}</option>)}
          </Select>
        </Field>
        <Field label="Monthly Salary (₹)">
          <Input type="number" min={0} value={form.salary || ''} onChange={set('salary')} />
        </Field>
        <Field label="Date Joined">
          <Input type="date" value={form.joined || ''} onChange={set('joined')} />
        </Field>
        <Field label="Status">
          <Select value={form.status || 'Active'} onChange={set('status')}>
            {['Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

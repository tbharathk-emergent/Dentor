import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  KeyRound,
  LogOut,
  Pause,
  Play,
  Plus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, setActiveClinic } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtINR, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar, EmptyState, ListSkeleton, SearchInput, StatCard } from '@/components/ui/bits'

interface Clinic extends Doc {
  stats: { users: number; patients: number; appointments: number; collected: number }
}

const PLANS = ['Standard', 'Professional', 'Enterprise']
const CLINIC_ROLES = ['Administrator', 'Doctor', 'Receptionist', 'Pharmacist', 'Accountant']

export default function Platform() {
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Clinic | null>(null)
  const [usersFor, setUsersFor] = useState<Clinic | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Clinic | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ items: Clinic[]; total: number }>({
    queryKey: ['platform-clinics', q],
    queryFn: () => api.get(`/api/platform/clinics${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: (prev) => prev,
  })
  const clinics = data?.items ?? []
  const active = clinics.filter((c) => c.status === 'Active').length

  const manage = (clinic: Clinic) => {
    setActiveClinic({ id: clinic.id, name: clinic.name, code: clinic.code })
    location.assign('/') // full reload so no cached data from another clinic survives
  }

  const toggleStatus = async (clinic: Clinic) => {
    const next = clinic.status === 'Suspended' ? 'Active' : 'Suspended'
    try {
      await api.patch(`/api/platform/clinics/${clinic.id}`, { status: next })
      toast.success(next === 'Suspended' ? `${clinic.name} suspended` : `${clinic.name} is active again`)
      qc.invalidateQueries({ queryKey: ['platform-clinics'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Console header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900 to-slate-700 text-white">
            <Building2 className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold tracking-tight text-slate-900">Dentor Platform</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Super Admin Console
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Clinics</h1>
            <p className="mt-0.5 text-[13px] text-slate-500 sm:text-sm">
              Every tenant on this Dentor instance — open one to manage it.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Clinic
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <StatCard label="Clinics" value={data?.total ?? 0} icon={<Building2 className="h-5 w-5" />} />
          <StatCard label="Active" value={active} icon={<Play className="h-5 w-5" />} accent="green" />
          <StatCard
            label="Suspended"
            value={(data?.total ?? 0) - active}
            icon={<Pause className="h-5 w-5" />}
            accent="amber"
          />
        </div>

        <SearchInput value={q} onChange={setQ} placeholder="Search clinic, code or city…" className="mb-3 sm:max-w-sm" />

        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : !clinics.length ? (
          <Card>
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No clinics found"
              message="Create the first clinic to onboard a tenant."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New Clinic
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {clinics.map((c) => (
              <Card key={c.id} className="flex flex-col p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-900">{c.name}</span>
                      {c.is_demo && <Badge tone="violet">Demo</Badge>}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {c.code} · {c.city || '—'} · {c.plan}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                  <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="Patients" value={c.stats.patients} />
                  <MiniStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Appts" value={c.stats.appointments} />
                  <MiniStat label="Collected" value={fmtINR(c.stats.collected)} />
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <Button size="sm" onClick={() => manage(c)} disabled={c.status === 'Suspended'}>
                    Manage <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setUsersFor(c)}>
                    <Users className="h-3.5 w-3.5" /> Users ({c.stats.users})
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={c.status === 'Suspended' ? 'ml-auto text-emerald-600' : 'ml-auto text-red-600'}
                    onClick={() => (c.status === 'Suspended' ? toggleStatus(c) : setToggleTarget(c))}
                  >
                    {c.status === 'Suspended' ? 'Activate' : 'Suspend'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <ClinicDialog open={createOpen || !!editing} onClose={() => { setCreateOpen(false); setEditing(null) }} editing={editing} />
      <UsersDialog clinic={usersFor} onClose={() => setUsersFor(null)} />
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => { if (toggleTarget) { toggleStatus(toggleTarget); setToggleTarget(null) } }}
        title="Suspend this clinic?"
        message={
          toggleTarget
            ? `All ${toggleTarget.name} staff will be signed out and unable to sign in until the clinic is reactivated. Its data is kept.`
            : ''
        }
        confirmLabel="Suspend"
      />
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="flex items-center justify-center gap-1 truncate text-[13px] font-bold text-slate-800">
        {icon}
        {value}
      </span>
      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  )
}

/* ---------- Create / edit clinic ---------- */

function ClinicDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Clinic | null }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, city: editing.city || '', phone: editing.phone || '', email: editing.email || '', address: editing.address || '', plan: editing.plan || 'Standard' }
          : { name: '', city: '', phone: '', email: '', address: '', plan: 'Standard', admin_name: '', admin_email: '', admin_password: '' },
      )
    }
  }, [open, editing])

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter the clinic name.')
    if (!editing) {
      if (!form.admin_name.trim() || !form.admin_email.trim()) return toast.error('Enter the clinic administrator’s name and email.')
      if ((form.admin_password || '').length < 8) return toast.error('Administrator password must be at least 8 characters.')
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/platform/clinics/${editing.id}`, form)
        toast.success('Clinic updated')
      } else {
        await api.post('/api/platform/clinics', form)
        toast.success(`${form.name} onboarded — its administrator can sign in now`)
      }
      qc.invalidateQueries({ queryKey: ['platform-clinics'] })
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Clinic' : 'Onboard New Clinic'}
      subtitle={editing ? editing.code : 'Creates the clinic with starter masters, settings and its first administrator login.'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>
            {editing ? 'Save Changes' : 'Create Clinic'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Clinic Name" required className="sm:col-span-2">
          <Input value={form.name || ''} onChange={set('name')} autoFocus placeholder="e.g. SmileCare Dental, Trichy" />
        </Field>
        <Field label="City">
          <Input value={form.city || ''} onChange={set('city')} />
        </Field>
        <Field label="Plan">
          <Select value={form.plan || 'Standard'} onChange={set('plan')}>
            {PLANS.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Phone">
          <Input value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Clinic Email">
          <Input type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={form.address || ''} onChange={set('address')} />
        </Field>

        {!editing && (
          <>
            <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3 text-[13px] font-semibold text-slate-700">
              Clinic administrator login
            </div>
            <Field label="Admin Name" required>
              <Input value={form.admin_name || ''} onChange={set('admin_name')} placeholder="Dr. …" />
            </Field>
            <Field label="Admin Email" required>
              <Input type="email" value={form.admin_email || ''} onChange={set('admin_email')} />
            </Field>
            <Field label="Initial Password" required hint="At least 8 characters — they can change it after signing in.">
              <Input type="text" value={form.admin_password || ''} onChange={set('admin_password')} />
            </Field>
          </>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ---------- Per-clinic login users ---------- */

function UsersDialog({ clinic, onClose }: { clinic: Clinic | null; onClose: () => void }) {
  const [adding, setAdding] = useState(false)
  const [resetFor, setResetFor] = useState<Doc | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ items: Doc[] }>({
    queryKey: ['platform-users', clinic?.id],
    queryFn: () => api.get(`/api/platform/clinics/${clinic!.id}/users`),
    enabled: !!clinic,
  })
  const users = data?.items ?? []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['platform-users', clinic?.id] })
    qc.invalidateQueries({ queryKey: ['platform-clinics'] })
  }

  const toggle = async (u: Doc) => {
    const next = u.status === 'Active' ? 'Inactive' : 'Active'
    try {
      await api.patch(`/api/platform/users/${u.id}`, { status: next })
      toast.success(`${u.name} is now ${next.toLowerCase()}`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Dialog
      open={!!clinic}
      onClose={onClose}
      title={`Logins — ${clinic?.name ?? ''}`}
      subtitle="Accounts that can sign in to this clinic"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Login
          </Button>
        </>
      }
    >
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : !users.length ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No logins yet" message="Add the clinic’s first login." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{u.name}</div>
                <div className="truncate text-xs text-slate-500">{u.email} · {u.role}</div>
              </div>
              <StatusBadge status={u.status} />
              <Button size="sm" variant="ghost" onClick={() => setResetFor(u)}>
                <KeyRound className="h-3.5 w-3.5" /> Reset password
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={u.status === 'Active' ? 'text-red-600' : 'text-emerald-600'}
                onClick={() => toggle(u)}
              >
                {u.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {clinic && (
        <AddUserDialog open={adding} onClose={() => setAdding(false)} clinicId={clinic.id} onSaved={refresh} />
      )}
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />
    </Dialog>
  )
}

function AddUserDialog({ open, onClose, clinicId, onSaved }: { open: boolean; onClose: () => void; clinicId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: CLINIC_ROLES[0] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', email: '', password: '', role: CLINIC_ROLES[0] })
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return toast.error('Enter a name and email.')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.post(`/api/platform/clinics/${clinicId}/users`, form)
      toast.success(`${form.name} can sign in now`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Login"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>Add Login</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            {CLINIC_ROLES.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Initial Password" required hint="At least 8 characters.">
          <Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: Doc | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setPassword('')
  }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.post(`/api/platform/users/${user!.id}/reset-password`, { new_password: password })
      toast.success(`Password reset for ${user!.name}`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={!!user}
      onClose={onClose}
      title="Reset Password"
      subtitle={user ? `${user.name} · ${user.email}` : ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>Reset Password</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="New Password" required hint="Share it with the user securely — they can change it after signing in.">
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

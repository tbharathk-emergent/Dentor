import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Smartphone, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { loadState, useList } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar, EmptyState, ListSkeleton, LoadError, Loaded } from '@/components/ui/bits'

interface Login {
  id: string
  name: string
  email: string
  role: string
  status: string
  consultant_id: string
  consultant_name: string
}

const APP_FOR_ROLE = (role: string) =>
  role === 'Clinic Owner' ? 'Web + Owner app' : role === 'Consultant' ? 'Consultant app' : 'Web'

/**
 * Who can sign in to this clinic, and to which Dentor app. The API enforces every rule
 * shown here (owner-only actions, one login per consultant, no self-deactivation).
 */
export function LoginsPanel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Login | null>(null)
  const [resetFor, setResetFor] = useState<Login | null>(null)
  const [deactivate, setDeactivate] = useState<Login | null>(null)

  const loginsQuery = useQuery<{ items: Login[]; roles: string[] }>({
    queryKey: ['clinic-users'],
    queryFn: () => api.get('/api/clinic/users'),
    retry: false,
  })
  const { data, error } = loginsQuery
  const refresh = () => qc.invalidateQueries({ queryKey: ['clinic-users'] })

  const setStatus = async (login: Login, status: string) => {
    try {
      await api.patch(`/api/clinic/users/${login.id}`, { status })
      toast.success(status === 'Inactive' ? `${login.name} can no longer sign in` : `${login.name} can sign in again`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Refused for this role: that is an answer, not a failure. Anything else is reported as "could not load" below.
  if (error instanceof ApiError && error.status === 403) {
    return (
      <Card>
        <EmptyState icon={<UserCog className="h-6 w-6" />} title="Logins are managed by the clinic owner" message={error.message} />
      </Card>
    )
  }

  const logins = data?.items ?? []
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-slate-500">
          Staff sign in to this web app. An owner also gets the Dentor Owner app, and each consultant gets the
          Dentor Consultant app. Patients create their own account in the patient app with their mobile number.
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add Login
        </Button>
      </div>

      <Card>
        <Loaded load={loadState(loginsQuery)} what="the logins" skeleton={<ListSkeleton rows={4} />}>
        {!logins.length ? (
          <EmptyState icon={<UserCog className="h-6 w-6" />} title="No logins yet" message="Add the first login for your team." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {logins.map((l) => {
              const isSelf = l.email === user?.email
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={l.name} />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{l.name}</span>
                      {isSelf && <Badge tone="brand">You</Badge>}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {l.email}
                      {l.consultant_name ? ` · linked to ${l.consultant_name}` : ''}
                    </div>
                  </div>
                  <Badge tone={l.role === 'Clinic Owner' ? 'violet' : l.role === 'Consultant' ? 'blue' : 'slate'}>{l.role}</Badge>
                  <span className="hidden items-center gap-1 text-xs text-slate-400 md:flex">
                    <Smartphone className="h-3.5 w-3.5" /> {APP_FOR_ROLE(l.role)}
                  </span>
                  <StatusBadge status={l.status} />
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetFor(l)} aria-label={`Reset password for ${l.name}`}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={l.status === 'Active' ? 'text-red-600' : 'text-emerald-600'}
                        onClick={() => (l.status === 'Active' ? setDeactivate(l) : setStatus(l, 'Active'))}
                      >
                        {l.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        </Loaded>
      </Card>

      <LoginDialog open={adding || !!editing} editing={editing} roles={data?.roles ?? []} selfEmail={user?.email}
        onClose={() => { setAdding(false); setEditing(null) }} onSaved={refresh} />
      <ResetDialog login={resetFor} onClose={() => setResetFor(null)} />
      <ConfirmDialog
        open={!!deactivate}
        onClose={() => setDeactivate(null)}
        onConfirm={() => { if (deactivate) { void setStatus(deactivate, 'Inactive'); setDeactivate(null) } }}
        title="Deactivate this login?"
        message={deactivate ? `${deactivate.name} will be signed out everywhere and cannot sign in until you activate the login again.` : ''}
        confirmLabel="Deactivate"
      />
    </>
  )
}

function LoginDialog({ open, editing, roles, selfEmail, onClose, onSaved }: {
  open: boolean
  editing: Login | null
  roles: string[]
  selfEmail?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Receptionist', consultant_id: '' })
  const [saving, setSaving] = useState(false)
  const isConsultant = form.role === 'Consultant'
  const isSelf = !!editing && editing.email === selfEmail

  const { data: consultants, load: consultantsLoad } = useList('consultants', { limit: 200, sort: 'name', order: 'asc' }, { enabled: open && isConsultant })
  const { data: logins } = useQuery<{ items: Login[] }>({ queryKey: ['clinic-users'], queryFn: () => api.get('/api/clinic/users'), enabled: open })
  const taken = new Set((logins?.items ?? []).filter((l) => l.id !== editing?.id).map((l) => l.consultant_id).filter(Boolean))
  const linkable = (consultants?.items ?? []).filter((c) => !taken.has(c.id))

  useEffect(() => {
    if (!open) return
    setForm(editing
      ? { name: editing.name, email: editing.email, password: '', role: editing.role, consultant_id: editing.consultant_id }
      : { name: '', email: '', password: '', role: 'Receptionist', consultant_id: '' })
  }, [open, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return toast.error('Enter the person’s full name.')
    if (!editing && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast.error('Enter a valid email address.')
    if (!editing && form.password.length < 8) return toast.error('Password must be at least 8 characters.')
    if (isConsultant && !form.consultant_id) return toast.error('Choose the consultant profile this login belongs to.')
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/clinic/users/${editing.id}`, {
          name: form.name.trim(),
          ...(isSelf ? {} : { role: form.role }),
          ...(isConsultant ? { consultant_id: form.consultant_id } : {}),
        })
        toast.success('Login updated')
      } else {
        await api.post('/api/clinic/users', {
          name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role,
          ...(isConsultant ? { consultant_id: form.consultant_id } : {}),
        })
        toast.success(`${form.name.trim()} can sign in now`)
      }
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
      title={editing ? 'Edit Login' : 'Add Login'}
      subtitle={editing ? editing.email : 'Creates a sign-in for a team member'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>{editing ? 'Save Changes' : 'Add Login'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        </Field>
        {!editing && (
          <Field label="Email" required hint="They sign in with this email.">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
        )}
        <Field
          label="Role"
          hint={isSelf ? 'You cannot change your own role.'
            : form.role === 'Clinic Owner' ? 'Full access, plus the Dentor Owner app. Only an owner can grant this.'
            : isConsultant ? 'Signs in to the Dentor Consultant app only: their own schedule and patients.'
            : 'Signs in to this web app.'}
        >
          <Select value={form.role} disabled={isSelf} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, consultant_id: '' }))}>
            {(roles.length ? roles : [form.role]).map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        {isConsultant && (
          <>
            <Field label="Consultant profile" required hint={consultants && !linkable.length ? 'Every consultant already has a login. Add the consultant under Consultants first.' : undefined}>
              <Select value={form.consultant_id} onChange={(e) => setForm((f) => ({ ...f, consultant_id: e.target.value }))}>
                <option value="">Choose a consultant…</option>
                {linkable.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.specialty}</option>)}
              </Select>
            </Field>
            {consultantsLoad.failed && <LoadError compact what="the consultant profiles" load={consultantsLoad} />}
          </>
        )}
        {!editing && (
          <Field label="Initial Password" required hint="At least 8 characters. Share it securely; they can change it after signing in.">
            <Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function ResetDialog({ login, onClose }: { login: Login | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (login) setPassword('') }, [login])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.post(`/api/clinic/users/${login!.id}/reset-password`, { new_password: password })
      toast.success(`Password reset for ${login!.name}. They are signed out on every device.`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={!!login}
      onClose={onClose}
      title="Reset Password"
      subtitle={login ? `${login.name} · ${login.email}` : ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>Reset Password</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="New Password" required hint="Share it securely — they can change it after signing in.">
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

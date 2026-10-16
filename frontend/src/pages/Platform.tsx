import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Download,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Smartphone,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, setActiveClinic } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { useInstallPrompt } from '@/lib/pwa'
import { fmtINR, loadState, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Applications } from '@/components/platform/Applications'
import { Tickets } from '@/components/platform/Tickets'
import { Avatar, EmptyState, Figures, ListSkeleton, LoadError, Loaded, SearchInput, StatCard } from '@/components/ui/bits'

interface Clinic extends Doc {
  stats: { users: number; patients: number; appointments: number; collected: number }
}

const PLANS = ['Standard', 'Professional', 'Enterprise']
// Roles offered for clinic logins. "Clinic Owner" also unlocks the Dentor Owner app;
// "Consultant" is for the Dentor Consultant app and must be linked to a consultant profile.
const CLINIC_ROLES = ['Clinic Owner', 'Administrator', 'Receptionist', 'Dentist', 'Accountant', 'Pharmacist', 'Consultant']
const FIRST_LOGIN_ROLES = ['Clinic Owner', 'Administrator']

interface PlatformOverview {
  clinics: number
  clinics_active: number
  clinics_suspended: number
  staff_logins: number
  patients: number
  patient_app_accounts: number
  appointments: number
  app_bookings: number
  billed: number
  collected: number
  /** What is connected outside Dentor for the mobile apps. Missing from an older API. */
  integrations?: { sms: boolean; sms_test_mode: boolean; email?: boolean; email_test_mode?: boolean; push: boolean; notification_retention_days: number }
}

export default function Platform() {
  const { user, logout } = useAuth()
  const { canInstall, install } = useInstallPrompt()
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Clinic | null>(null)
  const [usersFor, setUsersFor] = useState<Clinic | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Clinic | null>(null)
  const qc = useQueryClient()

  const clinicsQuery = useQuery<{ items: Clinic[]; total: number }>({
    queryKey: ['platform-clinics', q],
    queryFn: () => api.get(`/api/platform/clinics${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: (prev) => prev,
  })
  const clinics = clinicsQuery.data?.items ?? []
  const overviewQuery = useQuery<PlatformOverview>({
    queryKey: ['platform-overview'],
    queryFn: () => api.get('/api/platform/overview'),
  })
  const overview = overviewQuery.data

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
      qc.invalidateQueries({ queryKey: ['platform-overview'] })
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
            {canInstall && (
              <Button variant="outline" size="sm" onClick={install}>
                <Download className="h-4 w-4" /> Install app
              </Button>
            )}
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

        {/* Platform-wide figures, across every clinic */}
        <Figures load={loadState(overviewQuery)} what="the platform figures" className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <StatCard
            label="Clinics"
            value={overview?.clinics ?? '—'}
            hint={overview ? `${overview.clinics_active} active · ${overview.clinics_suspended} suspended` : undefined}
            icon={<Building2 className="h-5 w-5" />}
          />
          <StatCard
            label="Staff logins"
            value={overview?.staff_logins ?? '—'}
            hint="Owners, staff and consultants"
            icon={<Users className="h-5 w-5" />}
            accent="blue"
          />
          <StatCard
            label="Patients"
            value={overview?.patients ?? '—'}
            hint={overview ? `${overview.patient_app_accounts} use the patient app` : undefined}
            icon={<Smartphone className="h-5 w-5" />}
            accent="green"
          />
          <StatCard
            label="Collected"
            value={overview ? fmtINR(overview.collected) : '—'}
            hint={overview ? `${overview.appointments} appointments · ${overview.app_bookings} via app` : undefined}
            icon={<CalendarDays className="h-5 w-5" />}
            accent="amber"
          />
        </Figures>

        <ConnectedServices status={overview?.integrations} />

        <Tickets />

        <Applications clinics={clinics.filter((c) => c.status !== 'Suspended').map((c) => ({ id: c.id, name: String(c.name), code: String(c.code) }))} />

        <SearchInput value={q} onChange={setQ} placeholder="Search clinic, code or city…" className="mb-3 sm:max-w-sm" />

        <Loaded load={loadState(clinicsQuery)} what="the clinics" card skeleton={<ListSkeleton rows={4} />}>
        {!clinics.length ? (
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        </Loaded>
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

/* ---------- What is connected outside Dentor ---------- */

/**
 * The services the apps depend on, in the platform owner's words: text messages (the one-time
 * codes patients sign up with), email (password reset codes, staff sign-up, application decisions)
 * and push notifications. Text messages that cannot be sent
 * keep patients out of the patient app, so that is a warning that says what they cannot do; test
 * mode and missing push notifications are worth knowing and nothing more. An older API does not
 * report any of this, and then nothing is shown.
 */
function ConnectedServices({ status }: { status: PlatformOverview['integrations'] }) {
  if (!status) return null
  const services: { name: string; icon: ReactNode; state: string; tone: Tone; warning?: boolean; says?: string }[] = [
    !status.sms
      ? {
          name: 'Text messages (SMS)',
          icon: <AlertTriangle className="h-4 w-4" />,
          state: 'Not connected',
          tone: 'red',
          warning: true,
          says: 'Patients cannot sign up, log in with a one-time code or reset a forgotten password, because the codes cannot be sent to their phones. Logging in with a password still works. To fix this, an SMS service has to be connected on the Dentor server.',
        }
      : status.sms_test_mode
        ? {
            name: 'Text messages (SMS)',
            icon: <MessageSquare className="h-4 w-4" />,
            state: 'Test mode',
            tone: 'blue',
            says: 'One-time codes are shown on screen and in the server log instead of being sent to the patient’s phone. This is for testing only.',
          }
        : { name: 'Text messages (SMS)', icon: <MessageSquare className="h-4 w-4" />, state: 'Connected', tone: 'green' },
    // an API older than the email status sends no `email`: then the entry is left out
    ...(status.email === undefined
      ? []
      : [
          !status.email
            ? {
                name: 'Email',
                icon: <AlertTriangle className="h-4 w-4" />,
                state: 'Not connected',
                tone: 'red' as Tone,
                warning: true,
                says: 'Staff and patients cannot reset a forgotten password by email, new clinics and consultants cannot verify their email to apply, and applicants are not told when they are approved or rejected. Logging in with a password still works. To fix this, an email service has to be connected on the Dentor server.',
              }
            : status.email_test_mode
              ? {
                  name: 'Email',
                  icon: <Mail className="h-4 w-4" />,
                  state: 'Test mode',
                  tone: 'blue' as Tone,
                  says: 'Email codes are shown on screen and in the server log instead of being sent. This is for testing only.',
                }
              : { name: 'Email', icon: <Mail className="h-4 w-4" />, state: 'Connected', tone: 'green' as Tone },
        ]),
    status.push
      ? { name: 'Push notifications', icon: <Bell className="h-4 w-4" />, state: 'Connected', tone: 'green' }
      : {
          name: 'Push notifications',
          icon: <Bell className="h-4 w-4" />,
          state: 'Not connected',
          tone: 'slate',
          says: 'Notifications appear inside the apps only: people see them when they open the app, not as alerts on their phone.',
        },
  ]
  return (
    <section aria-label="Connected services" className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
      {services.map((service) => (
        <div
          key={service.name}
          className={cn(
            'rounded-xl border px-3.5 py-3',
            service.warning ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-500',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('shrink-0', service.warning ? 'text-red-600' : 'text-slate-400')}>{service.icon}</span>
            <span className={cn('text-[13px] font-semibold', service.warning ? 'text-red-900' : 'text-slate-800')}>{service.name}</span>
            <Badge tone={service.tone}>{service.state}</Badge>
          </div>
          {service.says && <p className="mt-1.5 text-xs leading-relaxed">{service.says}</p>}
        </div>
      ))}
    </section>
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
          : { name: '', city: '', phone: '', email: '', address: '', plan: 'Standard', admin_name: '', admin_email: '', admin_password: '', admin_role: FIRST_LOGIN_ROLES[0] },
      )
    }
  }, [open, editing])

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter the clinic name.')
    if (!editing) {
      if (!form.admin_name.trim() || !form.admin_email.trim()) return toast.error('Enter the name and email for the clinic’s first login.')
      if ((form.admin_password || '').length < 8) return toast.error('The first login’s password must be at least 8 characters.')
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/platform/clinics/${editing.id}`, form)
        toast.success('Clinic updated')
      } else {
        await api.post('/api/platform/clinics', form)
        toast.success(`${form.name} onboarded — ${form.admin_name} can sign in now`)
      }
      qc.invalidateQueries({ queryKey: ['platform-clinics'] })
      qc.invalidateQueries({ queryKey: ['platform-overview'] })
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
      subtitle={editing ? editing.code : 'Creates the clinic with starter masters, settings and its first login.'}
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
              First login for this clinic
            </div>
            <Field label="Name" required>
              <Input value={form.admin_name || ''} onChange={set('admin_name')} placeholder="Dr. …" />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.admin_email || ''} onChange={set('admin_email')} />
            </Field>
            <Field label="Role" hint="An owner can also use the Dentor Owner app.">
              <Select value={form.admin_role || FIRST_LOGIN_ROLES[0]} onChange={set('admin_role')}>
                {FIRST_LOGIN_ROLES.map((r) => <option key={r}>{r}</option>)}
              </Select>
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

  const usersQuery = useQuery<{ items: Doc[] }>({
    queryKey: ['platform-users', clinic?.id],
    queryFn: () => api.get(`/api/platform/clinics/${clinic!.id}/users`),
    enabled: !!clinic,
  })
  const users = usersQuery.data?.items ?? []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['platform-users', clinic?.id] })
    qc.invalidateQueries({ queryKey: ['platform-clinics'] })
    // A new login changes the "Staff logins" tile, and a new Consultant login takes its profile
    // off the list of profiles that can still be linked.
    qc.invalidateQueries({ queryKey: ['platform-overview'] })
    qc.invalidateQueries({ queryKey: ['platform-consultants', clinic?.id] })
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
      <Loaded load={loadState(usersQuery)} what="this clinic’s logins" skeleton={<ListSkeleton rows={3} />}>
      {!users.length ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No logins yet" message="Add the clinic’s first login." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={u.name} />
              {/* basis-40: on a phone the actions wrap below instead of squeezing the email and role out */}
              <div className="min-w-0 flex-1 basis-40">
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
      </Loaded>

      {clinic && (
        <AddUserDialog open={adding} onClose={() => setAdding(false)} clinicId={clinic.id} onSaved={refresh} />
      )}
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />
    </Dialog>
  )
}

function AddUserDialog({ open, onClose, clinicId, onSaved }: { open: boolean; onClose: () => void; clinicId: string; onSaved: () => void }) {
  const blank = { name: '', email: '', password: '', role: 'Receptionist', consultant_id: '' }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const isConsultant = form.role === 'Consultant'

  // Consultant logins are tied to one consultant profile; offer the ones without a login yet.
  const consultantsQuery = useQuery<{ items: { id: string; name: string; specialty: string; has_login: boolean }[] }>({
    queryKey: ['platform-consultants', clinicId],
    queryFn: () => api.get(`/api/platform/clinics/${clinicId}/consultants`),
    enabled: open && isConsultant,
  })
  const consultants = consultantsQuery.data
  const consultantsLoad = loadState(consultantsQuery)
  const linkable = (consultants?.items ?? []).filter((c) => !c.has_login)

  useEffect(() => {
    if (open) setForm(blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return toast.error('Enter a name and email.')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.')
    if (isConsultant && !form.consultant_id) return toast.error('Choose the consultant profile this login belongs to.')
    setSaving(true)
    try {
      await api.post(`/api/platform/clinics/${clinicId}/users`, {
        name: form.name, email: form.email, password: form.password, role: form.role,
        ...(isConsultant ? { consultant_id: form.consultant_id } : {}),
      })
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
        <Field
          label="Role"
          hint={
            form.role === 'Clinic Owner' ? 'Full access, plus the Dentor Owner app.'
              : isConsultant ? 'Signs in to the Dentor Consultant app only.'
              : 'Signs in to the reception web app.'
          }
        >
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, consultant_id: '' }))}>
            {CLINIC_ROLES.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        {isConsultant && (
          <>
            <Field label="Consultant profile" required hint={consultants && !linkable.length ? 'Every consultant of this clinic already has a login. Add the consultant in the clinic first.' : undefined}>
              <Select value={form.consultant_id} onChange={(e) => setForm((f) => ({ ...f, consultant_id: e.target.value }))}>
                <option value="">Choose a consultant…</option>
                {linkable.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.specialty}</option>)}
              </Select>
            </Field>
            {consultantsLoad.failed && <LoadError compact what="this clinic’s consultants" load={consultantsLoad} />}
          </>
        )}
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

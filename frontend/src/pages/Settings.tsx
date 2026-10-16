import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, KeyRound, Lock, Megaphone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { loadState } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Loaded, PageHeader, Skeleton } from '@/components/ui/bits'

type Values = Record<string, unknown>

/** A switch that is off and a field that is empty are stored either way or not at all: all of them are "not set". */
const unset = (v: unknown) => v === undefined || v === null || v === '' || v === false
const same = (a: unknown, b: unknown) => (unset(a) && unset(b)) || JSON.stringify(a) === JSON.stringify(b)

/** Toggles whose integrations (messaging, backups, 2FA…) are planned for Phase 2.
 *  They are stored, but nothing in the product consumes them yet — say so honestly. */
const PHASE2_KEYS = new Set([
  'rxDigitalSign', 'chartLock', 'smartQueue', 'apptReminder24', 'apptReminder2',
  'notifyWhatsApp', 'notifySms', 'notifyEmail', 'lowStockAlert', 'labDelayAlert', 'paymentAlert',
  'twoFactor', 'consentAudit', 'encryptBackup',
])

function Toggle({ checked, onChange, label, description, phase2, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; phase2?: boolean; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 py-2.5', !disabled && 'cursor-pointer')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">
          {label}
          {phase2 && (
            <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Phase 2
            </span>
          )}
        </span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          checked ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  )
}

const TOGGLES: { section: string; items: [string, string, string][] }[] = [
  {
    section: 'Clinical',
    items: [
      ['consentRequired', 'Consent required before procedures', 'Block treatment records without a signed consent'],
      ['allergyAlert', 'Allergy alerts', 'Show a red alert on all clinical screens for allergic patients'],
      ['rxDigitalSign', 'Digitally sign prescriptions', 'Prescriptions carry the doctor’s digital signature'],
      ['chartLock', 'Lock finalized clinical charts', 'Completed charts become read-only'],
    ],
  },
  {
    section: 'Appointments & Queue',
    items: [
      ['onlineBooking', 'Patient app booking', 'Patients can register with this clinic and book, move or cancel visits in the Dentor patient app'],
      ['doubleBooking', 'Allow double booking', 'Permit two appointments in the same chair & slot'],
      ['smartQueue', 'Smart queue', 'Token-based live patient queue on the dashboard'],
      ['apptReminder24', '24-hour reminder', 'Remind patients a day before their appointment'],
      ['apptReminder2', '2-hour reminder', 'Remind patients shortly before their appointment'],
    ],
  },
  {
    section: 'Billing & Finance',
    items: [
      ['partialPayments', 'Partial payments', 'Allow collecting invoices in instalments'],
      ['financialLock', 'Financial lock', 'Mask revenue figures until explicitly revealed'],
      ['roundOff', 'Round off totals', 'Round invoice totals to the nearest rupee'],
    ],
  },
  {
    section: 'Notifications',
    items: [
      ['notifyWhatsApp', 'WhatsApp notifications', 'Send patient updates over WhatsApp'],
      ['notifySms', 'SMS notifications', 'Send patient updates over SMS'],
      ['notifyEmail', 'Email notifications', 'Send patient updates over email'],
      ['lowStockAlert', 'Low stock alerts', 'Alert when pharmacy or inventory items hit reorder level'],
      ['labDelayAlert', 'Lab delay alerts', 'Alert when lab cases pass their due date'],
      ['paymentAlert', 'Payment alerts', 'Alert on received payments and dues'],
    ],
  },
  {
    section: 'Security & Privacy',
    items: [
      ['twoFactor', 'Two-factor authentication', 'Require a second factor at sign-in'],
      ['strongPassword', 'Strong password policy', 'Minimum 8 chars with upper, lower, digit and symbol'],
      ['sessionTimeout', 'Session timeout', 'Sign out automatically after 30 minutes of inactivity'],
      ['maskPatient', 'Mask patient identifiers', 'Hide partial mobile numbers in lists'],
      ['consentAudit', 'Consent audit trail', 'Record every consent view and change'],
      ['encryptBackup', 'Encrypted backups', 'Encrypt exported data at rest'],
    ],
  },
]

export default function Settings() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const { isClinicAdmin } = useAuth()
  // Only the clinic owner and administrators may change the settings or the banner; the API refuses
  // everyone else (403). Everybody else gets the same page to read, with nothing on it to change or
  // save. A role taken away while this page was open is only learnt from a refused save: the API's
  // message is kept here and the page is read-only from then on.
  const [refused, setRefused] = useState<string | null>(null)
  const canEdit = isClinicAdmin && refused === null
  // Only what was changed on this page since the settings were loaded. The page shows the saved
  // settings with these on top, and a save sends these and nothing else, so a setting somebody
  // else changed in the meantime is never written back with the value this page happened to hold.
  const [edits, setEdits] = useState<Values>({})
  const [saving, setSaving] = useState(false)
  const adRef = useRef<HTMLDivElement>(null)

  const settingsQuery = useQuery<Values>({ queryKey: ['settings'], queryFn: () => api.get('/api/settings') })
  const data = settingsQuery.data
  const adQuery = useQuery<Values>({ queryKey: ['advertisement'], queryFn: () => api.get('/api/advertisement') })
  const ad = adQuery.data
  const [adForm, setAdForm] = useState<Values>({})

  useEffect(() => { if (ad) setAdForm(ad) }, [ad])
  useEffect(() => {
    if (params.get('section') === 'advertisement') setTimeout(() => adRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [params])

  const values = useMemo<Values>(() => ({ ...data, ...edits }), [data, edits])
  // A switch flipped and flipped back, or a text typed and removed again, is not a change.
  const changes = useMemo<Values>(
    () => Object.fromEntries(Object.entries(edits).filter(([name, value]) => !same(value, data?.[name]))),
    [data, edits],
  )
  const dirty = Object.keys(changes).length > 0

  const set = (k: string) => (v: unknown) => setEdits((e) => ({ ...e, [k]: v }))
  const text = (k: string) => ({
    value: String(values[k] ?? ''),
    onChange: (e: { target: { value: string } }) => set(k)(e.target.value),
    disabled: !canEdit,
  })

  /** A save that failed. Refused for lack of permission: what was typed is dropped, so the page shows what is saved. */
  const saveFailed = (e: unknown) => {
    const message = e instanceof Error ? e.message : 'Failed to save'
    toast.error(message)
    if (e instanceof ApiError && e.status === 403) {
      setRefused(message)
      setEdits({})
      if (ad) setAdForm(ad)
    }
  }

  const save = async () => {
    if (!canEdit || !dirty) return // not theirs to change, or nothing changed: nothing is sent
    const sent = changes
    setSaving(true)
    try {
      const saved = await api.patch<{ values: Values }>('/api/settings', { values: sent })
      // The answer is every setting as it now stands, including what others changed meanwhile.
      qc.setQueryData(['settings'], saved.values)
      // What was typed while the request was on its way stays an unsaved edit.
      setEdits((e) => Object.fromEntries(Object.entries(e).filter(([name, value]) => !(name in sent) || !same(value, sent[name]))))
      toast.success('Settings saved')
    } catch (e) {
      saveFailed(e)
    } finally {
      setSaving(false)
    }
  }

  const saveAd = async () => {
    if (!canEdit) return
    try {
      await api.put('/api/advertisement', { values: adForm })
      toast.success('Advertisement updated')
      qc.invalidateQueries({ queryKey: ['advertisement'] })
    } catch (e) {
      saveFailed(e)
    }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(values, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'dentor-settings.json'
    a.click()
  }

  const sections = useMemo(() => TOGGLES, [])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Clinic identity, preferences and security"
        actions={
          data && (
            <>
              <Button variant="outline" onClick={exportJson}><Download className="h-4 w-4" /> Export</Button>
              {canEdit && (
                <Button onClick={save} loading={saving} disabled={!dirty}>
                  <Save className="h-4 w-4" /> {dirty ? 'Save Changes' : 'Saved'}
                </Button>
              )}
            </>
          )
        }
      />

      {/* Settings that could not be loaded are not shown as blank fields and switched-off switches. */}
      <Loaded
        load={loadState(settingsQuery)}
        what="the settings"
        card
        skeleton={
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        }
      >
      <div className="space-y-5">
        {!canEdit && (
          <div role="note" className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-[13px] text-slate-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="min-w-0">
              {refused === null
                ? 'You can view these settings, but only the clinic owner or an administrator can change them.'
                : `Your changes were not saved. ${refused}`}
            </p>
          </div>
        )}

        <Card>
          <CardHeader title="Clinic Identity" subtitle="Appears on invoices, prescriptions and certificates" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Clinic Name"><Input {...text('clinicName')} /></Field>
            <Field label="Legal Name"><Input {...text('legalName')} /></Field>
            <Field label="Phone"><Input {...text('phone')} /></Field>
            <Field label="Email"><Input {...text('email')} /></Field>
            <Field label="Address" className="sm:col-span-2"><Textarea {...text('address')} className="min-h-[56px]" /></Field>
            <Field label="GSTIN"><Input {...text('gstin')} /></Field>
            <Field label="Registration No."><Input {...text('registration')} /></Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Billing & Numbering" />
          <CardBody className="grid grid-cols-2 gap-4">
            <Field label="Invoice Prefix"><Input {...text('invoicePrefix')} /></Field>
            <Field label="Receipt Prefix"><Input {...text('receiptPrefix')} /></Field>
            <Field label="Currency">
              <Select {...text('currency')}>
                {['INR', 'USD', 'AED'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Date Format">
              <Select {...text('dateFormat')}>
                {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Clinical Defaults" />
          <CardBody className="grid grid-cols-2 gap-4">
            <Field label="Tooth Numbering">
              <Select {...text('toothNumbering')}>
                {['FDI', 'Universal', 'Palmer'].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Default Appointment Duration">
              <Select {...text('apptDuration')}>
                {['15', '30', '45', '60'].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>

        {sections.map((s) => (
          <Card key={s.section}>
            <CardHeader title={s.section} />
            <CardBody className="divide-y divide-slate-100 py-1">
              {s.items.map(([key, label, desc]) => (
                <Toggle
                  key={key}
                  checked={Boolean(values[key])}
                  onChange={(v) => set(key)(v)}
                  label={label}
                  description={desc}
                  phase2={PHASE2_KEYS.has(key)}
                  disabled={!canEdit}
                />
              ))}
            </CardBody>
          </Card>
        ))}

        <div ref={adRef}>
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-brand-700" /> Dashboard Advertisement</span>}
              subtitle="The banner shown to every dashboard user"
              actions={ad && (canEdit ? <Button size="sm" onClick={saveAd}>Save Banner</Button> : <Badge>View only</Badge>)}
            />
            {/* The banner is saved as a whole: a blank form for one that failed to load would wipe it. */}
            <Loaded load={loadState(adQuery)} what="the banner" skeleton={<CardBody><Skeleton className="h-32" /></CardBody>}>
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input value={String(adForm.title ?? '')} disabled={!canEdit} onChange={(e) => setAdForm((f) => ({ ...f, title: e.target.value }))} />
              </Field>
              <Field label="Subtitle" className="sm:col-span-2">
                <Input value={String(adForm.subtitle ?? '')} disabled={!canEdit} onChange={(e) => setAdForm((f) => ({ ...f, subtitle: e.target.value }))} />
              </Field>
              <Field label="Button Label">
                <Input value={String(adForm.button ?? '')} disabled={!canEdit} onChange={(e) => setAdForm((f) => ({ ...f, button: e.target.value }))} />
              </Field>
              <Field label="Status">
                <Select value={String(adForm.status ?? 'Active')} disabled={!canEdit} onChange={(e) => setAdForm((f) => ({ ...f, status: e.target.value }))}>
                  {['Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </CardBody>
            </Loaded>
          </Card>
        </div>

        <ChangePassword />
      </div>

      {canEdit && dirty && (
        <div className="sticky bottom-20 z-10 mt-5 flex justify-end lg:bottom-6">
          <Button onClick={save} loading={saving} size="lg" className="shadow-pop">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      )}
      </Loaded>
    </div>
  )
}

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const strength = useMemo(() => {
    let s = 0
    if (next.length >= 8) s++
    if (/[A-Z]/.test(next) && /[a-z]/.test(next)) s++
    if (/\d/.test(next)) s++
    if (/[^A-Za-z0-9]/.test(next)) s++
    return s
  }, [next])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return toast.error('New passwords do not match.')
    if (strength < 3) return toast.error('Use at least 8 characters with upper, lower, digit and symbol.')
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { current_password: current, new_password: next })
      toast.success('Password changed. Use it on your next sign-in.')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-brand-700" /> Change Password</span>} />
      <CardBody>
        <form onSubmit={submit} className="grid max-w-md grid-cols-1 gap-4">
          <Field label="Current Password" required>
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New Password" required>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            {next && (
              <div className="mt-1.5 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn('h-1 flex-1 rounded-full', i < strength ? (strength >= 4 ? 'bg-emerald-500' : strength >= 3 ? 'bg-amber-400' : 'bg-red-400') : 'bg-slate-200')} />
                ))}
              </div>
            )}
          </Field>
          <Field label="Confirm New Password" required>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" loading={busy}>Update Password</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

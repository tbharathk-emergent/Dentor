import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, KeyRound, Megaphone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { PageHeader, Skeleton } from '@/components/ui/bits'

type Values = Record<string, unknown>

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
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
      ['onlineBooking', 'Online booking', 'Allow patients to book from the patient portal'],
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
  const [values, setValues] = useState<Values>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const adRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<Values>({ queryKey: ['settings'], queryFn: () => api.get('/api/settings') })
  const { data: ad } = useQuery<Values>({ queryKey: ['advertisement'], queryFn: () => api.get('/api/advertisement') })
  const [adForm, setAdForm] = useState<Values>({})

  useEffect(() => { if (data) { setValues(data); setDirty(false) } }, [data])
  useEffect(() => { if (ad) setAdForm(ad) }, [ad])
  useEffect(() => {
    if (params.get('section') === 'advertisement') setTimeout(() => adRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [params])

  const set = (k: string) => (v: unknown) => { setValues((s) => ({ ...s, [k]: v })); setDirty(true) }
  const text = (k: string) => ({
    value: String(values[k] ?? ''),
    onChange: (e: { target: { value: string } }) => set(k)(e.target.value),
  })

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/settings', { values })
      toast.success('Settings saved')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const saveAd = async () => {
    try {
      await api.put('/api/advertisement', { values: adForm })
      toast.success('Advertisement updated')
      qc.invalidateQueries({ queryKey: ['advertisement'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Clinic identity, preferences and security"
        actions={
          <>
            <Button variant="outline" onClick={exportJson}><Download className="h-4 w-4" /> Export</Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              <Save className="h-4 w-4" /> {dirty ? 'Save Changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <div className="space-y-5">
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
              actions={<Button size="sm" onClick={saveAd}>Save Banner</Button>}
            />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input value={String(adForm.title ?? '')} onChange={(e) => setAdForm((f) => ({ ...f, title: e.target.value }))} />
              </Field>
              <Field label="Subtitle" className="sm:col-span-2">
                <Input value={String(adForm.subtitle ?? '')} onChange={(e) => setAdForm((f) => ({ ...f, subtitle: e.target.value }))} />
              </Field>
              <Field label="Button Label">
                <Input value={String(adForm.button ?? '')} onChange={(e) => setAdForm((f) => ({ ...f, button: e.target.value }))} />
              </Field>
              <Field label="Status">
                <Select value={String(adForm.status ?? 'Active')} onChange={(e) => setAdForm((f) => ({ ...f, status: e.target.value }))}>
                  {['Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </CardBody>
          </Card>
        </div>

        <ChangePassword />
      </div>

      {dirty && (
        <div className="sticky bottom-20 z-10 mt-5 flex justify-end lg:bottom-6">
          <Button onClick={save} loading={saving} size="lg" className="shadow-pop">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      )}
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

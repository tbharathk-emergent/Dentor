import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Inbox, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { loadState, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ListSkeleton, Loaded } from '@/components/ui/bits'

interface Application extends Doc {
  email: string
  kind: 'clinic' | 'consultant'
  status: 'Pending' | 'Approved' | 'Rejected'
  profile: Record<string, string>
  aadhaar_last4: string
  files: string[]
  reason?: string
  created_at: string
}

const FILE_LABELS: Record<string, string> = { dci_certificate: 'DCI certificate', clinic_image: 'Clinic photo' }
const STATUSES = ['Pending', 'Approved', 'Rejected'] as const

/**
 * Clinics and consultants who signed up in the apps (POST /api/auth/signup) wait here. Approving a
 * clinic opens it with the applicant as its owner; a consultant is approved into a chosen clinic.
 */
export function Applications({ clinics }: { clinics: { id: string; name: string; code: string }[] }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('Pending')
  const [approving, setApproving] = useState<Application | null>(null)
  const [rejecting, setRejecting] = useState<Application | null>(null)
  const query = useQuery<{ items: Application[] }>({
    queryKey: ['platform-applications', status],
    queryFn: () => api.get(`/api/platform/applications?status=${status}`),
  })
  const items = query.data?.items ?? []
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['platform-applications'] })
    qc.invalidateQueries({ queryKey: ['platform-clinics'] })
    qc.invalidateQueries({ queryKey: ['platform-overview'] })
  }

  const openFile = async (app: Application, name: string) => {
    // A new tab is opened first, as browsers block one opened after an await.
    const tab = window.open('', '_blank')
    try {
      const file = await api.get<{ data_url: string }>(`/api/platform/applications/${app.id}/files/${name}`)
      const blob = await (await fetch(file.data_url)).blob()
      if (tab) tab.location.href = URL.createObjectURL(blob)
    } catch (e) {
      tab?.close()
      toast.error((e as Error).message)
    }
  }

  return (
    <section className="mb-6" data-testid="applications">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sign-up applications</h2>
          <p className="text-[13px] text-slate-500">Clinics and consultants who applied in the apps. They can sign in once approved.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
          {STATUSES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <Loaded load={loadState(query)} what="the applications" card skeleton={<ListSkeleton rows={2} />}>
        {!items.length ? (
          <Card>
            <EmptyState icon={<Inbox className="h-6 w-6" />} title={`No ${status.toLowerCase()} applications`} message={status === 'Pending' ? 'New sign-ups from the Clinic and Consultant apps appear here.' : undefined} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {items.map((a) => {
              const p = a.profile
              const address = [p.door, p.street, p.area, p.landmark, p.city, p.state, p.pincode].filter(Boolean).join(', ')
              return (
                <Card key={a.id} className="p-4" data-testid={`application-${a.email}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-slate-900">{a.kind === 'clinic' ? p.clinic_name || p.name : p.name}</span>
                        <Badge tone={a.kind === 'clinic' ? 'brand' : 'violet'}>{a.kind === 'clinic' ? 'Clinic' : 'Consultant'}</Badge>
                      </div>
                      <div className="truncate text-xs text-slate-500">{a.email} · {p.mobile}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {a.kind === 'clinic' && <Item label="Owner" value={p.name} />}
                    <Item label="DCI number" value={p.dci_number} />
                    <Item label="Qualification" value={[p.institution, p.graduation_year].filter(Boolean).join(', ')} />
                    <Item label="Specialisation" value={p.specialisation} />
                    <Item label="Aadhaar" value={a.aadhaar_last4 ? `ends ${a.aadhaar_last4}` : ''} />
                    {a.kind === 'clinic' && <Item label="GST" value={p.gst} />}
                    <Item label="Address" value={address} wide />
                    <Item label="Experience" value={p.experience} wide />
                    <Item label="Applied" value={new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} />
                    {a.status === 'Rejected' && <Item label="Reason" value={a.reason} wide />}
                  </dl>
                  {!!a.files.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.files.map((f) => (
                        <Button key={f} size="sm" variant="outline" onClick={() => openFile(a, f)}>
                          <FileText className="h-3.5 w-3.5" /> {FILE_LABELS[f] ?? f}
                        </Button>
                      ))}
                    </div>
                  )}
                  {a.status === 'Pending' && (
                    <div className="mt-3 flex gap-1.5">
                      <Button size="sm" onClick={() => setApproving(a)} data-testid="application-approve">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setRejecting(a)} data-testid="application-reject">
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Loaded>
      <ApproveDialog application={approving} clinics={clinics} onClose={() => setApproving(null)} onDone={refresh} />
      <RejectDialog application={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />
    </section>
  )
}

function Item({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  if (!value) return null
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-slate-400">{label}</dt>
      <dd className="break-words text-slate-700">{value}</dd>
    </div>
  )
}

function ApproveDialog({ application, clinics, onClose, onDone }: { application: Application | null; clinics: { id: string; name: string; code: string }[]; onClose: () => void; onDone: () => void }) {
  const [clinicId, setClinicId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const consultant = application?.kind === 'consultant'
  const close = () => {
    setClinicId('')
    setError('')
    onClose()
  }
  const approve = async () => {
    if (!application) return
    if (consultant && !clinicId) return setError('Choose the clinic this consultant joins.')
    setBusy(true)
    try {
      const res = await api.post<{ emailed?: boolean }>(`/api/platform/applications/${application.id}/approve`, consultant ? { clinic_id: clinicId } : {})
      toast.success(res.emailed === false ? 'Approved. The email could not be sent: tell the applicant they can sign in.' : 'Approved. The applicant can sign in now.')
      onDone()
      close()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={!!application}
      onClose={close}
      title="Approve this application?"
      subtitle={application?.email}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={approve} loading={busy} data-testid="approve-confirm">Approve</Button>
        </>
      }
    >
      {consultant ? (
        <Field label="Clinic" required error={error} hint="The consultant's login and profile are created in this clinic.">
          <Select value={clinicId} onChange={(e) => setClinicId(e.target.value)} data-testid="approve-clinic">
            <option value="">Choose a clinic</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-slate-600">
          A new clinic, <strong>{application?.profile.clinic_name}</strong>, opens on the Standard plan with {application?.profile.name} as its owner.
          {error && <span className="mt-2 block text-xs text-red-600">{error}</span>}
        </p>
      )}
    </Dialog>
  )
}

function RejectDialog({ application, onClose, onDone }: { application: Application | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => {
    setReason('')
    setError('')
    onClose()
  }
  const reject = async () => {
    if (!application) return
    if (reason.trim().length < 3) return setError('Say why, so the applicant knows what to change.')
    setBusy(true)
    try {
      await api.post(`/api/platform/applications/${application.id}/reject`, { reason: reason.trim() })
      toast.success('Application rejected. The applicant sees the reason when signing in.')
      onDone()
      close()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={!!application}
      onClose={close}
      title="Reject this application?"
      subtitle={application?.email}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="danger" onClick={reject} loading={busy} data-testid="reject-confirm">Reject</Button>
        </>
      }
    >
      <Field label="Reason" required error={error}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: the DCI certificate is not readable" data-testid="reject-reason" />
      </Field>
    </Dialog>
  )
}

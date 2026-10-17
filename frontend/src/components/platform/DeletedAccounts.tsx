import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserX } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { loadState } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ListSkeleton, Loaded } from '@/components/ui/bits'

interface Deleted {
  kind: 'patient' | 'staff'
  id: string
  name: string
  mobile?: string
  email?: string
  role?: string
  clinic?: string
  deleted_at: string
  test_account?: boolean
}

const when = (iso: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

/** Logins deleted with "Delete my account" in the three apps (backend app/account_deletion.py): restore one on request. */
export function DeletedAccounts() {
  const qc = useQueryClient()
  const [restoring, setRestoring] = useState<Deleted | null>(null)
  const [busy, setBusy] = useState(false)
  const query = useQuery<{ patients: Deleted[]; staff: Deleted[] }>({
    queryKey: ['platform-deleted-accounts'],
    queryFn: () => api.get('/api/platform/deleted-accounts'),
  })
  const items = [...(query.data?.patients ?? []), ...(query.data?.staff ?? [])].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))

  const restore = async () => {
    if (!restoring || busy) return
    setBusy(true)
    try {
      await api.post(`/api/platform/deleted-accounts/${restoring.kind}/${restoring.id}/restore`, {})
      toast.success(`${restoring.name || 'The login'} can sign in again`)
      setRestoring(null)
      await qc.invalidateQueries({ queryKey: ['platform-deleted-accounts'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore the login.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6" data-testid="deleted-accounts">
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-900">Deleted accounts</h2>
        <p className="text-[13px] text-slate-500">Logins deleted from the Patient, Clinic Owner and Consultant apps. Clinic records were kept; restore a login when its owner asks.</p>
      </div>
      <Loaded load={loadState(query)} what="the deleted accounts" card skeleton={<ListSkeleton rows={2} />}>
        {!items.length ? (
          <Card><EmptyState icon={<UserX className="h-6 w-6" />} title="No deleted accounts" /></Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {items.map((a) => (
              <div key={`${a.kind}-${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`deleted-${a.kind}-${a.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{a.name || '—'}</span>
                    <Badge tone={a.kind === 'patient' ? 'blue' : 'violet'}>{a.kind === 'patient' ? 'Patient app' : a.role || 'Staff'}</Badge>
                    {a.test_account && <Badge tone="amber">Test</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {[a.mobile && `+91 ${a.mobile}`, a.email, a.clinic].filter(Boolean).join(' · ')} · deleted {when(a.deleted_at)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRestoring(a)}>Restore</Button>
              </div>
            ))}
          </Card>
        )}
      </Loaded>
      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        onConfirm={restore}
        title="Restore this login?"
        message={restoring ? `${restoring.name || 'This login'} will be able to sign in again with the same password.` : ''}
        confirmLabel="Restore"
        tone="primary"
        loading={busy}
      />
    </section>
  )
}

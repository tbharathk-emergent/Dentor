import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { loadState, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Field'
import { EmptyState, ListSkeleton, Loaded } from '@/components/ui/bits'

interface Ticket extends Doc {
  code: string
  type: string
  subject: string
  description: string
  status: string
  clinic: string
  raised_name: string
  raised_role: string
  created_at: string
  timeline: { status: string; at: string; by: string; text: string }[]
}

/** Tickets from the Clinic and Consultant apps, plan requests and store enquiries: answer, mark in progress or resolved. */
export function Tickets() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const [open, setOpen] = useState<Ticket | null>(null)
  const query = useQuery<{ items: Ticket[] }>({ queryKey: ['platform-tickets', status], queryFn: () => api.get(`/api/platform/tickets?status=${status}`) })
  const items = query.data?.items ?? []
  return (
    <section className="mb-6" data-testid="tickets">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Support tickets</h2>
          <p className="text-[13px] text-slate-500">Queries, plan requests and store enquiries from the apps.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
          {(['open', 'resolved'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {s === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>
      <Loaded load={loadState(query)} what="the tickets" card skeleton={<ListSkeleton rows={2} />}>
        {!items.length ? (
          <Card><EmptyState icon={<LifeBuoy className="h-6 w-6" />} title={status === 'open' ? 'No open tickets' : 'No resolved tickets'} /></Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {items.map((t) => (
              <button key={t.id} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setOpen(t)} data-testid={`ticket-${t.code}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{t.code} · {t.subject}</span>
                    <Badge tone="slate">{t.type}</Badge>
                  </div>
                  <div className="truncate text-xs text-slate-500">{[t.raised_name, t.raised_role, t.clinic].filter(Boolean).join(' · ')} · {new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
          </Card>
        )}
      </Loaded>
      <Answer ticket={open} onClose={() => setOpen(null)} onDone={() => qc.invalidateQueries({ queryKey: ['platform-tickets'] })} />
    </section>
  )
}

function Answer({ ticket, onClose, onDone }: { ticket: Ticket | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async (status: '' | 'In progress' | 'Resolved') => {
    if (!ticket) return
    if (!text.trim() && !status) return toast.error('Write an answer or change the status.')
    setBusy(true)
    try {
      await api.post(`/api/platform/tickets/${ticket.id}/answer`, { text: text.trim(), status })
      toast.success(status ? `Ticket ${status.toLowerCase()}` : 'Answer sent')
      setText('')
      onDone()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={!!ticket} onClose={onClose} title={ticket ? `${ticket.code} · ${ticket.subject}` : ''} subtitle={ticket ? `${ticket.raised_name} · ${ticket.clinic || ticket.raised_role}` : ''}
      footer={ticket && ticket.status !== 'Resolved' ? (
        <>
          <Button variant="ghost" onClick={() => send('In progress')} disabled={busy}>Mark in progress</Button>
          <Button variant="outline" onClick={() => send('')} loading={busy} data-testid="ticket-answer">Send answer</Button>
          <Button onClick={() => send('Resolved')} disabled={busy} data-testid="ticket-resolve">Resolve</Button>
        </>
      ) : undefined}>
      {ticket && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">{ticket.description}</p>
          <ul className="space-y-1 text-xs text-slate-500">
            {ticket.timeline.map((s, i) => <li key={i}>{s.status} · {new Date(s.at).toLocaleString('en-IN')} · {s.by}{s.text ? `: ${s.text}` : ''}</li>)}
          </ul>
          {ticket.status !== 'Resolved' && (
            <Field label="Answer"><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} data-testid="ticket-text" /></Field>
          )}
        </div>
      )}
    </Dialog>
  )
}

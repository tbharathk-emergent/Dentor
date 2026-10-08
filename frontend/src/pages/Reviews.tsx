import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Flag, MessageSquareQuote, ShieldCheck, Star, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useList, type Doc } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Avatar, EmptyState, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { downloadCSV } from '@/components/growth/csv'

const CHANNELS = ['Google', 'WhatsApp', 'DENTOR App', 'Facebook']
const STATUS_TONES: Record<string, Tone> = { Approved: 'green', Pending: 'amber', Flagged: 'violet', Rejected: 'red' }

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap text-[15px] leading-none tracking-tight text-amber-500', className)}>
      {'★'.repeat(n)}
      <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - n))}</span>
    </span>
  )
}

function ReviewStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'slate'} dot>
      {status}
    </Badge>
  )
}

export default function Reviews() {
  const qc = useQueryClient()
  const { data, isLoading } = useList('reviews', { limit: 500, sort: 'created_at', order: 'desc' })
  const reviews = data?.items ?? []

  const [scope, setScope] = useState('All')
  const [q, setQ] = useState('')
  const [rating, setRating] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [confirm, setConfirm] = useState<{ ids: string[]; status: 'Approved' | 'Rejected' } | null>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [detail, setDetail] = useState<Doc | null>(null)
  const [response, setResponse] = useState('')
  const [internalNote, setInternalNote] = useState('')

  useEffect(() => {
    if (detail) {
      setResponse(detail.response || '')
      setInternalNote(detail.moderationNote || '')
    }
  }, [detail])

  const kpis = useMemo(() => {
    const total = reviews.length
    const approved = reviews.filter((r) => r.status === 'Approved').length
    const needsMod = reviews.filter((r) => r.status === 'Pending' || r.status === 'Flagged').length
    const rejected = reviews.filter((r) => r.status === 'Rejected').length
    const avg = total ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / total).toFixed(1) : '0.0'
    return { total, approved, needsMod, rejected, avg }
  }, [reviews])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return reviews.filter((r) => {
      if (scope !== 'All' && r.type !== scope) return false
      if (rating && Number(r.rating) !== Number(rating)) return false
      if (status === 'Pending') {
        if (r.status !== 'Pending' && r.status !== 'Flagged') return false
      } else if (status && r.status !== status) return false
      if (channel && r.channel !== channel) return false
      if (date && r.dateISO !== date) return false
      if (term && !Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(term))) return false
      return true
    })
  }, [reviews, scope, q, rating, status, channel, date])

  const distribution = useMemo(() => {
    const total = reviews.length || 1
    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((r) => Number(r.rating) === star).length
      return { star, count, pct: Math.round((count / total) * 100) }
    })
  }, [reviews])

  const sources = useMemo(
    () => CHANNELS.map((c) => ({ channel: c, count: reviews.filter((r) => r.channel === c).length })),
    [reviews],
  )

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)))

  const openConfirm = (ids: string[], next: 'Approved' | 'Rejected') => {
    setConfirmNote('')
    setConfirm({ ids, status: next })
  }

  const runModeration = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      await Promise.all(
        confirm.ids.map((id) =>
          api.patch(`/api/reviews/${id}`, {
            status: confirm.status,
            moderationNote: confirmNote,
            moderated: 'Today · Administrator',
          }),
        ),
      )
      qc.invalidateQueries({ queryKey: ['reviews'] })
      toast.success(`${confirm.ids.length} review(s) ${confirm.status.toLowerCase()}`)
      setSelected(new Set())
      setConfirm(null)
      setDetail(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setConfirmBusy(false)
    }
  }

  const saveResponse = async (then?: () => void) => {
    if (!detail) return
    try {
      await api.patch(`/api/reviews/${detail.id}`, { response, moderationNote: internalNote })
      qc.invalidateQueries({ queryKey: ['reviews'] })
      if (then) then()
      else {
        toast.success('Response saved')
        setDetail(null)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const exportCSV = () => {
    downloadCSV(
      'DENTOR-Reviews.csv',
      ['ID', 'Type', 'Subject', 'Reviewer', 'Rating', 'Status', 'Date', 'Channel', 'Review'],
      filtered.map((r) => [r.code, r.type, r.subject, r.reviewer, r.rating, r.status, r.date, r.channel, r.text]),
    )
    toast.success(`${filtered.length} reviews exported`)
  }

  const hasFilters = Boolean(q || rating || status || channel || date || scope !== 'All')

  const columns: Column<Doc>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-slate-300 accent-brand-700"
        />
      ),
      cell: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 accent-brand-700"
        />
      ),
      className: 'w-10',
    },
    {
      key: 'subject',
      header: 'Clinic / Consultant',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.subject} className="h-8 w-8 text-[11px]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">{r.subject}</div>
            <div className="truncate text-xs text-slate-500">
              {r.type} · ⌖ {r.location}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'reviewer',
      header: 'Reviewer',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-700">{r.reviewer}</div>
          <div className="text-xs text-slate-400">{r.channel}</div>
        </div>
      ),
    },
    {
      key: 'review',
      header: 'Review',
      cell: (r) => (
        <div className="max-w-[260px] text-[13px] italic text-slate-600">
          <span className="line-clamp-2">“{r.text}”</span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <Stars n={Number(r.rating)} />
          <span className="ml-1.5 text-xs text-slate-400">{r.rating}/5</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <ReviewStatusBadge status={r.status} /> },
    { key: 'date', header: 'Date', cell: (r) => <span className="whitespace-nowrap text-[13px] text-slate-500">{r.date}</span> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => openConfirm([r.id], 'Approved')}>
            Approve
          </Button>
          <Button size="sm" variant="danger-outline" onClick={() => openConfirm([r.id], 'Rejected')}>
            Reject
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Reviews & Ratings"
        subtitle="Moderate clinic and consultant feedback, protect quality and publish approved experiences"
        actions={
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {/* KPI cards — clickable status filters */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Total reviews" hint="All feedback channels" value={kpis.total} icon={<MessageSquareQuote className="h-5 w-5" />} onClick={() => setStatus('')} />
        <StatCard label="Approved" hint="Published and visible" value={kpis.approved} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" onClick={() => setStatus('Approved')} />
        <StatCard label="Needs moderation" hint="Pending or flagged" value={kpis.needsMod} icon={<Flag className="h-5 w-5" />} accent="amber" onClick={() => setStatus('Pending')} />
        <StatCard label="Rejected" hint="Not published" value={kpis.rejected} icon={<XCircle className="h-5 w-5" />} accent="red" onClick={() => setStatus('Rejected')} />
        <StatCard label="Average rating" hint="★ Excellent reputation" value={`${kpis.avg}/5`} icon={<Star className="h-5 w-5" />} accent="blue" className="col-span-2 sm:col-span-1" />
      </div>

      <Tabs
        className="mb-3"
        value={scope}
        onChange={setScope}
        tabs={[
          { key: 'All', label: 'All Reviews', count: reviews.length },
          { key: 'Clinic', label: 'Clinic Reviews', count: reviews.filter((r) => r.type === 'Clinic').length },
          { key: 'Consultant', label: 'Consultant Reviews', count: reviews.filter((r) => r.type === 'Consultant').length },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search reviewer, clinic, consultant or review…" className="min-w-0 flex-1 sm:max-w-xs" />
        <Select value={rating} onChange={(e) => setRating(e.target.value)} className="w-32">
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
          <option value="">All Status</option>
          {['Pending', 'Approved', 'Flagged', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-36">
          <option value="">All Channels</option>
          {CHANNELS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <div className="w-40">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* Bulk moderation bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5">
          <span className="text-sm font-medium text-brand-900">{selected.size} review{selected.size > 1 ? 's' : ''} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => openConfirm([...selected], 'Approved')}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="danger-outline" onClick={() => openConfirm([...selected], 'Rejected')}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            loading={isLoading}
            onRowClick={(r) => setDetail(r)}
            empty={
              <EmptyState
                icon={<MessageSquareQuote className="h-6 w-6" />}
                title={hasFilters ? 'No reviews match these filters' : 'No reviews yet'}
                message={hasFilters ? 'Try widening your search or clearing a filter.' : 'Patient feedback will appear here as it arrives.'}
              />
            }
            mobileCard={(r) => (
              <div>
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-brand-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{r.subject}</span>
                      <ReviewStatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-slate-500">{r.type} · {r.location} · {r.date}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars n={Number(r.rating)} className="text-[13px]" />
                      <span className="text-xs text-slate-500">{r.reviewer} · {r.channel}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] italic text-slate-600">“{r.text}”</p>
                    <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="secondary" onClick={() => openConfirm([r.id], 'Approved')}>Approve</Button>
                      <Button size="sm" variant="danger-outline" onClick={() => openConfirm([r.id], 'Rejected')}>Reject</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            footer={
              filtered.length ? (
                <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
                  Showing {filtered.length} of {reviews.length} reviews
                </div>
              ) : undefined
            }
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Rating Distribution" subtitle="Across all channels" />
            <CardBody className="space-y-2.5">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-2.5">
                  <span className="w-7 shrink-0 text-xs font-medium text-slate-600">{d.star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs text-slate-500">{d.pct}%</span>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Review Sources" subtitle="Where feedback arrives" />
            <CardBody className="space-y-2">
              {sources.map((s) => (
                <div key={s.channel} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[13px] font-medium text-slate-700">{s.channel}</span>
                  <Badge tone="brand">{s.count}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Moderation confirm dialog */}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.status === 'Approved' ? 'Approve Review(s)' : 'Reject Review(s)'}
        subtitle={`${confirm?.ids.length ?? 0} review(s) selected for moderation`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant={confirm?.status === 'Rejected' ? 'danger' : 'primary'}
              onClick={runModeration}
              loading={confirmBusy}
            >
              Confirm {confirm?.status}
            </Button>
          </>
        }
      >
        <p className="mb-1 text-sm font-medium text-slate-800">
          {confirm?.status === 'Approved' ? 'Publish selected reviews?' : 'Reject selected reviews?'}
        </p>
        <p className="mb-4 text-[13px] text-slate-500">
          {confirm?.status === 'Approved'
            ? 'Approved reviews will be published to connected DENTOR review surfaces.'
            : 'Rejected reviews remain available in the audit history but will not be published.'}
        </p>
        <Field label="Moderation Note">
          <Textarea value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="Optional internal reason" />
        </Field>
      </Dialog>

      {/* Review details dialog */}
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Review Details"
        subtitle={detail ? `${detail.code} · Submitted through ${detail.channel}` : undefined}
        size="lg"
        footer={
          detail && (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="secondary" onClick={() => saveResponse()}>Save Response</Button>
              <Button variant="danger-outline" onClick={() => openConfirm([detail.id], 'Rejected')}>Reject</Button>
              <Button onClick={() => saveResponse(() => openConfirm([detail.id], 'Approved'))}>
                <ShieldCheck className="h-4 w-4" /> Approve & Publish
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={detail.reviewer} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{detail.reviewer}</div>
                <div className="text-xs text-slate-500">{detail.subject} · {detail.type}</div>
              </div>
              <div className="flex items-center gap-2">
                <Stars n={Number(detail.rating)} />
                <ReviewStatusBadge status={detail.status} />
              </div>
            </div>
            <blockquote className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic text-slate-700">
              “{detail.text}”
            </blockquote>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ['Treatment / Visit', detail.visit],
                ['Location', detail.location],
                ['Sentiment', detail.sentiment],
                ['Submitted', detail.date],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{k}</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{v || '—'}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">Moderation & Response</h4>
              <div className="space-y-3">
                <Field label="Public Response" hint="Published alongside the review once approved.">
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write a professional response to the reviewer"
                  />
                </Field>
                <Field label="Internal Note">
                  <Textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Visible to the clinic team only"
                    className="min-h-[60px]"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

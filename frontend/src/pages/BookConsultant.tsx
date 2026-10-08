import { useMemo, useState } from 'react'
import { BriefcaseMedical, CalendarDays, CalendarPlus, MapPin, Star, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, fmtTime, todayISO, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { BookingWizard } from '@/components/consult/BookingWizard'

export default function BookConsultant() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('Visiting')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selected, setSelected] = useState<Doc | null>(null)
  const [historyQ, setHistoryQ] = useState('')
  const [cancelTarget, setCancelTarget] = useState<Doc | null>(null)

  const { data, isLoading } = useList('consultants', {
    q,
    ...(type !== 'All' ? { type } : {}),
    sort: 'code',
    order: 'asc',
    limit: 100,
  })
  const consultants = data?.items ?? []

  // Full roster for the wizard's consultant select (independent of the page filter).
  const { data: allData } = useList('consultants', { sort: 'code', order: 'asc', limit: 100 })
  const allConsultants = allData?.items ?? []

  const { data: history, isLoading: historyLoading } = useList('consultant_bookings', {
    q: historyQ,
    sort: 'date',
    order: 'desc',
    limit: 200,
  })
  const bookings = history?.items ?? []

  const stats = useMemo(() => {
    const visiting = allConsultants.filter((c) => c.type === 'Visiting' && c.status !== 'Inactive').length
    const upcoming = bookings.filter((b) => b.status === 'Confirmed' && b.date >= todayISO()).length
    const month = todayISO().slice(0, 7)
    const thisMonth = bookings.filter((b) => String(b.date || '').startsWith(month) && b.status !== 'Cancelled').length
    return { visiting, upcoming, thisMonth }
  }, [allConsultants, bookings])

  const update = useUpdate('consultant_bookings')

  const openWizard = (c: Doc | null) => {
    setSelected(c)
    setWizardOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Book a Consultant"
        subtitle="Refer patients to visiting specialists and confirm a consultation in minutes"
        actions={
          <Button onClick={() => openWizard(null)}>
            <CalendarPlus className="h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatCard label="Visiting specialists" value={stats.visiting} icon={<Stethoscope className="h-5 w-5" />} />
        <StatCard label="Upcoming consultations" value={stats.upcoming} icon={<CalendarDays className="h-5 w-5" />} accent="blue" />
        <StatCard label="Booked this month" value={stats.thisMonth} icon={<BriefcaseMedical className="h-5 w-5" />} accent="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search consultant, specialty or location…"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        <Segmented
          className="ml-auto"
          value={type}
          onChange={setType}
          options={[
            { key: 'Visiting', label: 'Visiting' },
            { key: 'In-house', label: 'In-house' },
            { key: 'All', label: 'All' },
          ]}
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !consultants.length ? (
        <Card>
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title="No consultants match"
            message="Try a different name, specialty or switch the type filter."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {consultants.map((c) => (
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="truncate text-xs text-slate-500">{c.specialty}</div>
                  </div>
                </div>
                <Badge tone={c.type === 'Visiting' ? 'violet' : 'brand'}>{c.type}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">{c.credentials}</span>
                <span>{c.experience} yrs exp</span>
                <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {c.rating ?? '—'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Availability</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{c.availability || '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fee</div>
                  <div className="truncate text-[13px] font-semibold text-slate-800">{fmtINR(c.fee)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{c.location}</span>
                </span>
                <Button size="sm" disabled={c.status === 'Inactive'} onClick={() => openWizard(c)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Book
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Booking history */}
      <Card className="mt-6">
        <CardHeader
          title="Booking History"
          subtitle="Consultant bookings with their mirror appointment in the Consultation Room"
          actions={
            <SearchInput
              value={historyQ}
              onChange={setHistoryQ}
              placeholder="Search patient, consultant or ref…"
              className="w-full sm:w-64"
            />
          }
        />
        {historyLoading ? (
          <ListSkeleton rows={3} />
        ) : !bookings.length ? (
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title={historyQ ? 'No bookings match' : 'No consultant bookings yet'}
            message={historyQ ? 'Try a different patient, consultant or booking reference.' : 'Book your first specialist consultation above.'}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="w-24 shrink-0">
                  <div className="text-[13px] font-bold text-slate-800">{fmtDate(b.date)}</div>
                  <div className="text-xs text-slate-500">{fmtTime(b.time)}</div>
                </div>
                <Avatar name={b.patient} className="hidden sm:flex" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {b.patient} <span className="font-normal text-slate-400">· {b.patientCode}</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {b.consultant} · {b.reason}
                  </div>
                </div>
                <span className="hidden text-xs text-slate-400 md:block">{b.code}</span>
                <StatusBadge status={b.status} />
                {b.status === 'Confirmed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setCancelTarget(b)}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BookingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        consultant={selected}
        consultants={allConsultants.filter((c) => c.status !== 'Inactive')}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            update.mutate(
              { id: cancelTarget.id, status: 'Cancelled' },
              { onSuccess: () => { toast.success('Consultant booking cancelled'); setCancelTarget(null) } },
            )
          }
        }}
        title="Cancel this consultation?"
        message={
          cancelTarget
            ? `${cancelTarget.patient} · ${cancelTarget.consultant} · ${fmtDate(cancelTarget.date)} at ${fmtTime(cancelTarget.time)}. The slot will become available again.`
            : ''
        }
        confirmLabel="Cancel Booking"
      />
    </div>
  )
}

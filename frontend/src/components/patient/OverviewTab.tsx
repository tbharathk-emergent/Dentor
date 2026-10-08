import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarPlus, HeartPulse, Receipt } from 'lucide-react'
import { fmtDate, fmtINR, fmtTime, todayISO, useList, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

function InfoItem({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-slate-800">{value || '—'}</div>
    </div>
  )
}

function ApptRow({ a }: { a: Doc }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="w-16 shrink-0">
        <div className="text-[13px] font-bold text-slate-800">{fmtDate(a.date).slice(0, 6)}</div>
        <div className="text-xs text-slate-500">{fmtTime(a.time)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-slate-800">{a.treatment || 'Consultation'}</div>
        <div className="truncate text-xs text-slate-500">{a.doctor} · {a.chair}</div>
      </div>
      <StatusBadge status={a.status} />
    </li>
  )
}

export function OverviewTab({ patient, onGoTab }: { patient: Doc; onGoTab: (tab: string) => void }) {
  const navigate = useNavigate()
  const code = patient.code

  const { data: apptData, isLoading: apptsLoading } = useList('appointments', { patientCode: code, limit: 200, sort: 'date', order: 'desc' })
  const { data: invData, isLoading: invLoading } = useList('invoices', { patientCode: code, sort: 'date', order: 'desc', limit: 200 })

  const today = todayISO()
  const { upcoming, recent } = useMemo(() => {
    const items = apptData?.items ?? []
    const up = items
      .filter((a) => a.date >= today && !['Cancelled', 'Completed'].includes(a.status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    const past = items.filter((a) => a.date < today || a.status === 'Completed')
    return { upcoming: up.slice(0, 4), recent: past.slice(0, 4) }
  }, [apptData, today])

  const fin = useMemo(() => {
    const items = invData?.items ?? []
    return items.reduce(
      (acc, i) => ({
        count: acc.count + 1,
        total: acc.total + Number(i.total ?? 0),
        paid: acc.paid + Number(i.paid ?? 0),
        balance: acc.balance + Number(i.balance ?? 0),
      }),
      { count: 0, total: 0, paid: 0, balance: 0 },
    )
  }, [invData])

  const hasAllergy = patient.allergy && !['none', 'none recorded', 'not recorded'].includes(String(patient.allergy).toLowerCase())

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Contact & personal */}
        <Card>
          <CardHeader title="Contact & Personal Information" />
          <CardBody className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <InfoItem label="Patient ID" value={code} />
            <InfoItem label="Age / Gender" value={`${patient.age ?? '—'} yrs · ${patient.gender || '—'}`} />
            <InfoItem label="Mobile" value={patient.mobile ? <a href={`tel:${patient.mobile}`} className="text-brand-700 hover:underline">{patient.mobile}</a> : '—'} />
            <InfoItem label="Email" value={patient.email} />
            <InfoItem label="Address" value={[patient.address, patient.city].filter(Boolean).join(', ')} />
            <InfoItem label="Source" value={patient.source} />
            <InfoItem label="Assigned Dentist" value={patient.doctor} />
            <InfoItem label="Primary Treatment" value={patient.treatment} />
            <InfoItem label="Last Visit" value={fmtDate(patient.lastVisit)} />
          </CardBody>
        </Card>

        {/* Appointments */}
        <Card>
          <CardHeader
            title="Appointments"
            subtitle="Upcoming and recent visits"
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate('/appointments?new=1')}>
                <CalendarPlus className="h-4 w-4" /> Book
              </Button>
            }
          />
          {apptsLoading ? (
            <CardBody className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardBody>
          ) : !upcoming.length && !recent.length ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No appointments yet"
              message="Book this patient's first appointment to get their care underway."
              action={
                <Button size="sm" onClick={() => navigate('/appointments?new=1')}>
                  <CalendarPlus className="h-4 w-4" /> Book Appointment
                </Button>
              }
            />
          ) : (
            <CardBody className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Upcoming</h4>
                {upcoming.length ? (
                  <ul className="divide-y divide-slate-100">{upcoming.map((a) => <ApptRow key={a.id} a={a} />)}</ul>
                ) : (
                  <p className="py-2 text-[13px] text-slate-400">Nothing scheduled.</p>
                )}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent</h4>
                {recent.length ? (
                  <ul className="divide-y divide-slate-100">{recent.map((a) => <ApptRow key={a.id} a={a} />)}</ul>
                ) : (
                  <p className="py-2 text-[13px] text-slate-400">No past visits recorded.</p>
                )}
              </div>
            </CardBody>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {/* Medical */}
        <Card>
          <CardHeader title="Medical Information" />
          <CardBody className="space-y-3.5">
            <div className={cn('rounded-lg px-3 py-2.5', hasAllergy ? 'bg-red-50 ring-1 ring-inset ring-red-200' : 'bg-slate-50')}>
              <div className={cn('text-[10px] font-semibold uppercase tracking-wide', hasAllergy ? 'text-red-500' : 'text-slate-400')}>
                Known Allergies
              </div>
              <div className={cn('mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold', hasAllergy ? 'text-red-700' : 'text-slate-700')}>
                {hasAllergy && <HeartPulse className="h-4 w-4" />}
                {patient.allergy || 'None recorded'}
              </div>
            </div>
            <InfoItem label="Medical History" value={patient.history || 'None recorded'} />
            <InfoItem label="Blood Group" value={patient.blood} />
            <InfoItem label="Risk Level" value={patient.risk} />
          </CardBody>
        </Card>

        {/* Financial summary */}
        <Card>
          <CardHeader
            title="Financial Summary"
            subtitle={invLoading ? 'Loading…' : `${fin.count} invoice${fin.count === 1 ? '' : 's'}`}
            actions={
              <Button size="sm" variant="ghost" onClick={() => onGoTab('invoices')}>
                <Receipt className="h-4 w-4" /> View
              </Button>
            }
          />
          {invLoading ? (
            <CardBody><Skeleton className="h-20 w-full" /></CardBody>
          ) : (
            <CardBody className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2.5 text-center">
                <div className="text-[15px] font-bold text-slate-900">{fmtINR(fin.total)}</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Billed</div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-2.5 py-2.5 text-center">
                <div className="text-[15px] font-bold text-emerald-700">{fmtINR(fin.paid)}</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-600/70">Paid</div>
              </div>
              <div className={cn('rounded-lg px-2.5 py-2.5 text-center', fin.balance > 0 ? 'bg-red-50' : 'bg-slate-50')}>
                <div className={cn('text-[15px] font-bold', fin.balance > 0 ? 'text-red-600' : 'text-slate-900')}>{fmtINR(fin.balance)}</div>
                <div className={cn('text-[10px] font-medium uppercase tracking-wide', fin.balance > 0 ? 'text-red-500/80' : 'text-slate-400')}>Balance</div>
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  )
}

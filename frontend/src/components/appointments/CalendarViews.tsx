import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtTime, loadState } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ListSkeleton, Loaded } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

interface Appt {
  id: string; code: string; patient: string; date: string; date_label: string; time: string; time_label: string; treatment: string; doctor: string;
  status: string; kind: string; rescheduled_from: null | { date_label: string; time_label: string }; reschedule_reason: string
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * The CMS design's weekly view (cms.fig 334:3694), monthly view (320:140), the day by doctor (313:14323) and the
 * rescheduled list (306:13494). They read the Clinic app API, so a move made anywhere shows here.
 */
export function CalendarViews({ view, date, onOpenDay }: { view: 'week' | 'month' | 'rescheduled' | 'doctors'; date: string; onOpenDay: (date: string) => void }) {
  if (view === 'week') return <WeekView date={date} onOpenDay={onOpenDay} />
  if (view === 'month') return <MonthView date={date} onOpenDay={onOpenDay} />
  if (view === 'doctors') return <DoctorColumns date={date} />
  return <Rescheduled />
}

function useRange(from: string, to: string) {
  return useQuery<{ items: Appt[] }>({
    queryKey: ['clinic-app-range', from, to],
    queryFn: () => api.get(`/api/clinic-app/appointments?date_from=${from}&date_to=${to}&limit=500`),
  })
}

function WeekView({ date, onOpenDay }: { date: string; onOpenDay: (d: string) => void }) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(date + 'T00:00'), { weekStartsOn: 1 }))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor])
  const range = useRange(iso(days[0]), iso(days[6]))
  return (
    <div data-testid="week-view">
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-semibold text-slate-800" data-testid="week-label">{format(days[0], 'd MMM')} – {format(days[6], 'd MMM yyyy')}</span>
        <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <Loaded load={loadState(range)} what="the week" card skeleton={<ListSkeleton rows={4} />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => {
            const items = (range.data?.items ?? []).filter((a) => a.date === iso(d)).sort((a, b) => a.time.localeCompare(b.time))
            return (
              <Card key={iso(d)} className="min-w-0 p-2" data-testid={`week-day-${iso(d)}`}>
                <button onClick={() => onOpenDay(iso(d))} className="mb-1 flex w-full items-baseline justify-between text-left">
                  <span className="text-xs font-semibold uppercase text-slate-500">{format(d, 'EEE d')}</span>
                  <span className="text-[11px] text-slate-400">{items.length}</span>
                </button>
                <ul className="space-y-1">
                  {items.map((a) => (
                    <li key={a.id} className={cn('rounded-md border-l-4 bg-slate-50 px-2 py-1 text-xs', a.status === 'Cancelled' ? 'border-slate-300 line-through opacity-60' : a.kind === 'consultant' ? 'border-violet-400' : 'border-brand-500')}>
                      <div className="font-semibold text-slate-800">{a.time_label} · {a.patient}</div>
                      <div className="truncate text-slate-500">{a.treatment} · {a.doctor}</div>
                    </li>
                  ))}
                  {!items.length && <li className="text-[11px] text-slate-300">—</li>}
                </ul>
              </Card>
            )
          })}
        </div>
      </Loaded>
    </div>
  )
}

function MonthView({ date, onOpenDay }: { date: string; onOpenDay: (d: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date(date + 'T00:00')))
  const key = format(month, 'yyyy-MM')
  const counts = useQuery<{ days: Record<string, number>; today: string }>({ queryKey: ['clinic-app-month', key], queryFn: () => api.get(`/api/clinic-app/appointments/month?month=${key}`) })
  const first = startOfWeek(month, { weekStartsOn: 1 })
  const last = endOfMonth(month)
  const cells: Date[] = []
  for (let d = first; d <= last || cells.length % 7; d = addDays(d, 1)) cells.push(d)
  return (
    <div data-testid="month-view">
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-semibold text-slate-800" data-testid="month-label">{format(month, 'MMMM yyyy')}</span>
        <Button size="sm" variant="outline" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <Loaded load={loadState(counts)} what="the month" card skeleton={<ListSkeleton rows={4} />}>
        <Card className="p-2">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const k = iso(d)
              const n = counts.data?.days[k] ?? 0
              const inMonth = d.getMonth() === month.getMonth()
              return (
                <button key={k} onClick={() => onOpenDay(k)} data-testid={`month-day-${k}`}
                  className={cn('flex aspect-square flex-col items-center justify-center rounded-lg border text-sm', inMonth ? 'border-slate-200 bg-white' : 'border-transparent text-slate-300',
                    k === counts.data?.today && 'border-brand-600')}>
                  <span>{d.getDate()}</span>
                  {inMonth && n > 0 && <span className="mt-0.5 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">{n}</span>}
                </button>
              )
            })}
          </div>
        </Card>
      </Loaded>
    </div>
  )
}

function DoctorColumns({ date }: { date: string }) {
  const range = useRange(date, date)
  const items = range.data?.items ?? []
  const doctors = [...new Set(items.map((a) => a.doctor))].sort()
  return (
    <Loaded load={loadState(range)} what="the day" card skeleton={<ListSkeleton rows={4} />}>
      {!items.length ? (
        <Card><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No appointments on this day" /></Card>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2" data-testid="doctor-columns">
          {doctors.map((doc) => (
            <Card key={doc} className="w-56 shrink-0 p-2" data-testid={`doctor-column-${doc}`}>
              <div className="mb-1 truncate text-sm font-semibold text-slate-800">{doc}</div>
              <ul className="space-y-1">
                {items.filter((a) => a.doctor === doc).sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
                  <li key={a.id} className="rounded-md bg-slate-50 px-2 py-1 text-xs">
                    <div className="flex items-center justify-between gap-1"><span className="font-semibold">{fmtTime(a.time)}</span><StatusBadge status={a.status} /></div>
                    <div className="truncate text-slate-600">{a.patient} · {a.treatment}</div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </Loaded>
  )
}

function Rescheduled() {
  const list = useQuery<{ items: Appt[] }>({ queryKey: ['clinic-app-rescheduled'], queryFn: () => api.get('/api/clinic-app/appointments?scope=all&rescheduled=true&limit=200') })
  const items = list.data?.items ?? []
  return (
    <Loaded load={loadState(list)} what="the rescheduled appointments" card skeleton={<ListSkeleton rows={4} />}>
      {!items.length ? (
        <Card><EmptyState icon={<History className="h-6 w-6" />} title="Nothing rescheduled" message="Appointments moved to another day or time appear here with their original time." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100 p-0" data-testid="rescheduled-list">
          {items.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" data-testid={`rescheduled-${a.code}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{a.patient} · {a.treatment}</div>
                <div className="text-xs text-slate-500">{a.doctor}{a.reschedule_reason ? ` · ${a.reschedule_reason}` : ''}</div>
              </div>
              <div className="text-xs text-slate-500"><span className="line-through">{a.rescheduled_from?.date_label} {a.rescheduled_from?.time_label}</span> → <span className="font-semibold text-slate-800">{a.date_label} {a.time_label}</span></div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </Card>
      )}
    </Loaded>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  IndianRupee,
  Megaphone,
  Pill,
  Receipt,
  StickyNote,
  UserPlus,
  Users,
  Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtINR, fmtTime, todayISO, useUpdate } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar, EmptyState, Skeleton, StatCard } from '@/components/ui/bits'

interface DashboardData {
  patients: number
  newPatientsThisMonth: number
  consultants: number
  appointmentsToday: number
  byStatus: Record<string, number>
  morning: number
  evening: number
  revenue: number
  outstanding: number
  todayCollection: number
  pharmacyLowStock: number
  pharmacyAvailable: number
  frs: number
  activities: { id: string; message: string; at: string }[]
  scheduleNotes: { id: string; time: string; title: string; priority: string; assigned: string }[]
  todayAppointments: {
    id: string
    time: string
    patient: string
    treatment: string
    doctor: string
    chair: string
    status: string
  }[]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showMoney, setShowMoney] = useState(() => sessionStorage.getItem('dentor.money') === '1')

  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get(`/api/dashboard?date=${todayISO()}`),
    refetchInterval: 60_000,
  })

  const { data: ad } = useQuery<Record<string, string>>({
    queryKey: ['advertisement'],
    queryFn: () => api.get('/api/advertisement'),
  })

  const updateAppt = useUpdate('appointments', { invalidate: ['dashboard'] })

  const money = (v: number | undefined) => (showMoney ? fmtINR(v) : '₹ •••••')
  const toggleMoney = () => {
    const next = !showMoney
    setShowMoney(next)
    sessionStorage.setItem('dentor.money', next ? '1' : '0')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const checkIn = (id: string) => {
    updateAppt.mutate({ id, status: 'Waiting' }, { onSuccess: () => refetch() })
  }
  const complete = (id: string) => {
    updateAppt.mutate({ id, status: 'Completed' }, { onSuccess: () => refetch() })
  }

  const quickActions = [
    { label: 'New Patient', icon: UserPlus, onClick: () => navigate('/patients?new=1') },
    { label: 'New Appointment', icon: CalendarPlus, onClick: () => navigate('/appointments?new=1') },
    { label: 'Record Payment', icon: Receipt, onClick: () => navigate('/accounts?pay=1') },
    { label: 'Schedule Note', icon: StickyNote, onClick: () => navigate('/schedule-notes?new=1') },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {greeting}, {user?.name?.replace(/^Dr\.?\s*/i, 'Dr. ') || 'there'}
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500 sm:text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}Here's what's happening at the clinic today.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleMoney}>
          {showMoney ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showMoney ? 'Hide financials' : 'Show financials'}
        </Button>
      </div>

      {/* Quick actions — the receptionist's main verbs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-card transition hover:border-brand-400 hover:bg-brand-50/40 sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm transition group-hover:scale-105">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-semibold text-slate-800 sm:text-sm">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Advertisement banner */}
      {ad?.status === 'Active' && ad?.title && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-ink-900 to-brand-800 px-4 py-3.5 text-white sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Megaphone className="h-5 w-5 shrink-0 text-brand-300" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{ad.title}</div>
              {ad.subtitle && <div className="truncate text-xs text-slate-300">{ad.subtitle}</div>}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="border-0 bg-white/15 text-white hover:bg-white/25"
            onClick={() => navigate('/settings?section=advertisement')}
          >
            {ad.button || 'Manage'}
          </Button>
        </div>
      )}

      {/* KPI grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <StatCard label="Appointments today" value={data?.appointmentsToday ?? 0} icon={<CalendarDays className="h-5 w-5" />} accent="brand" onClick={() => navigate('/appointments')} />
          <StatCard label="Waiting now" value={data?.byStatus?.Waiting ?? 0} icon={<Clock className="h-5 w-5" />} accent="amber" onClick={() => navigate('/appointments?status=Waiting')} />
          <StatCard label="Completed today" value={data?.byStatus?.Completed ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" onClick={() => navigate('/appointments?status=Completed')} />
          <StatCard label="Total patients" value={data?.patients ?? 0} hint={`+${data?.newPatientsThisMonth ?? 0} this month`} icon={<Users className="h-5 w-5" />} accent="blue" onClick={() => navigate('/patients')} />
          <StatCard label="Collection today" value={money(data?.todayCollection)} icon={<IndianRupee className="h-5 w-5" />} accent="green" onClick={() => navigate('/accounts?tab=payments')} />
          <StatCard label="Outstanding" value={money(data?.outstanding)} icon={<Receipt className="h-5 w-5" />} accent="red" onClick={() => navigate('/accounts?status=Pending')} />
          <StatCard label="Pharmacy low stock" value={data?.pharmacyLowStock ?? 0} hint={`${data?.pharmacyAvailable ?? 0} in stock`} icon={<Pill className="h-5 w-5" />} accent="amber" onClick={() => navigate('/pharmacy?filter=low')} />
          <StatCard label="FRS opportunities" value={data?.frs ?? 0} icon={<ClipboardList className="h-5 w-5" />} accent="brand" onClick={() => navigate('/frs')} />
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-3 sm:gap-5">
        {/* Today's appointments */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Today's Appointments"
            subtitle={`${data?.morning ?? 0} morning · ${data?.evening ?? 0} evening`}
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate('/appointments')}>
                View calendar
              </Button>
            }
          />
          {!data?.todayAppointments?.length ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No appointments today"
              message="Book the first appointment of the day."
              action={
                <Button size="sm" onClick={() => navigate('/appointments?new=1')}>
                  <CalendarPlus className="h-4 w-4" /> New Appointment
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.todayAppointments.map((a) => (
                <li key={a.id} className="flex min-w-0 items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[13px] font-bold text-slate-900">{fmtTime(a.time)}</div>
                  </div>
                  <Avatar name={a.patient} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{a.patient}</div>
                    <div className="truncate text-xs text-slate-500">
                      {a.treatment} · {a.doctor} · {a.chair}
                    </div>
                  </div>
                  <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                  {a.status === 'Scheduled' && (
                    <Button size="sm" variant="secondary" onClick={() => checkIn(a.id)}>
                      Check in
                    </Button>
                  )}
                  {a.status === 'Waiting' && (
                    <Button size="sm" variant="outline" onClick={() => complete(a.id)}>
                      Complete
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Right rail */}
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <Card>
            <CardHeader
              title="Schedule & Notes"
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigate('/schedule-notes')}>
                  Manage →
                </Button>
              }
            />
            {!data?.scheduleNotes?.length ? (
              <CardBody className="py-6 text-center text-[13px] text-slate-400">
                No reminders for today.
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.scheduleNotes.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-11 shrink-0 text-xs font-bold text-slate-700">{n.time}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-slate-800">{n.title}</div>
                      <div className="truncate text-[11px] text-slate-400">{n.assigned}</div>
                    </div>
                    <StatusBadge status={n.priority} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent Activity" />
            {!data?.activities?.length ? (
              <CardBody className="py-6 text-center text-[13px] text-slate-400">No activity yet.</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.activities.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-slate-700">{a.message}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(a.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

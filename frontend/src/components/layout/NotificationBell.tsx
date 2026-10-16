import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarDays, MessageSquare, Star, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { loadState } from '@/lib/hooks'
import { LoadError } from '@/components/ui/bits'

interface Notice {
  id: string
  title: string
  body: string
  kind: string
  data: Record<string, string>
  read: boolean
  created_at: string
}

const ICONS: Record<string, typeof Bell> = {
  appointment: CalendarDays,
  review: Star,
  patient: UserPlus,
  chat: MessageSquare,
}

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (Number.isNaN(min)) return ''
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.round(min / 60)} h ago`
  return `${Math.round(min / 1440)} d ago`
}

/** Activity from the patient and consultant apps that the front desk needs to see. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const notifications = useQuery<{ items: Notice[]; unread: number }>({
    queryKey: ['staff-notifications'],
    queryFn: () => api.get('/api/notifications'),
    refetchInterval: 45_000,
  })
  const { data } = notifications
  const load = loadState(notifications)
  const items = data?.items ?? []
  const unread = data?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const markRead = async (ids?: string[]) => {
    await api.post('/api/notifications/read', ids ? { ids } : {}).catch(() => undefined)
    qc.invalidateQueries({ queryKey: ['staff-notifications'] })
  }

  const openNotice = (n: Notice) => {
    if (!n.read) void markRead([n.id])
    setOpen(false)
    if (n.kind === 'review') navigate('/reviews')
    else if (n.kind === 'patient' && n.data.patient_id) navigate(`/patients/${n.data.patient_id}`)
    else if (n.kind === 'chat') navigate('/omni')
    else navigate('/appointments')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/15"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-40 rounded-xl border border-slate-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markRead()} className="text-xs font-medium text-brand-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {load.failed ? (
            <LoadError compact what="the notifications" load={load} className="m-3" />
          ) : !data ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">Loading…</p>
          ) : !items.length ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">
              Nothing yet. Bookings, cancellations and reviews from the patient app appear here.
            </p>
          ) : (
            <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const Icon = ICONS[n.kind] ?? Bell
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotice(n)}
                      className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !n.read && 'bg-brand-50/50')}
                    >
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-700')}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">{n.title}</span>
                        <span className="block text-xs text-slate-500">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

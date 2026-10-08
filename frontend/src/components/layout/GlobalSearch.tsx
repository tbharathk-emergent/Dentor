import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, FileText, Loader2, Search, User, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface SearchResult {
  type: 'patient' | 'appointment' | 'invoice'
  id: string
  title: string
  subtitle: string
  href: string
}

const ICONS = { patient: User, appointment: CalendarDays, invoice: FileText }

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isFetching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ['global-search', q],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: open && q.trim().length >= 2,
    placeholderData: (prev) => prev,
  })
  const results = q.trim().length >= 2 ? (data?.results ?? []) : []

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => setActive(0), [q])

  if (!open) return null

  const go = (r: SearchResult) => {
    onClose()
    navigate(r.href)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[12vh] sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop animate-fade-up">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
          <Search className="h-4.5 w-4.5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              else if (e.key === 'Enter' && results[active]) go(results[active])
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="Search patients, appointments, invoices…"
            className="h-13 w-full py-4 text-[15px] outline-none placeholder:text-slate-400"
          />
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-[13px] text-slate-400">
              Type at least 2 characters — search by name, ID, phone or treatment.
            </p>
          ) : results.length === 0 && !isFetching ? (
            <p className="px-3 py-6 text-center text-[13px] text-slate-400">No matches for “{q}”.</p>
          ) : (
            results.map((r, i) => {
              const Icon = ICONS[r.type]
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                    i === active && 'bg-brand-50',
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>
                    <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {r.type}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

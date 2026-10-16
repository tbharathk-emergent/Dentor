import { createContext, useContext, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CloudOff, Search, Inbox } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { LoadState } from '@/lib/hooks'
import { Button } from './Button'
import { Card } from './Card'
import { inputBase } from './Field'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputBase, 'h-10 pl-9')}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

export function Avatar({ name, className, src }: { name?: string; className?: string; src?: string }) {
  const initials = (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  if (src) {
    return <img src={src} alt={name} className={cn('h-9 w-9 rounded-full object-cover', className)} />
  }
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-800',
        className,
      )}
    >
      {initials}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Data that could not be loaded                                       */
/* ------------------------------------------------------------------ */

/** Why a request failed, in words for the person at the desk. */
function failureReason(error: unknown, short: boolean) {
  if (error instanceof ApiError) {
    // Below 500 the API explains itself (no permission, not found…); above, its message is a status line.
    if (error.status < 500) return error.message
    return short ? `The server reported a problem (${error.message}).` : `The server reported a problem (${error.message}). Try again; if it keeps happening, tell your administrator.`
  }
  return short ? 'The server could not be reached.' : 'The server could not be reached. Check the internet connection, then try again.'
}

/**
 * Says that something could not be loaded and offers to load it again. A failed request is not
 * "nothing here": this is shown where an empty state or a zero would otherwise claim there is no data.
 * `compact` is the one-line form, for a row of figures, a part of a dialog, or a refresh that failed
 * while older data is still on screen.
 *
 * "Try again" sends every failed request of the screen again, not only the one behind this message:
 * when the server is back, one press brings back the figures, the list and the tabs that are not open.
 */
export function LoadError({ what, load, compact, className }: { what: string; load: LoadState; compact?: boolean; className?: string }) {
  const queries = useQueryClient()
  const retry = (
    <Button
      size="sm"
      variant="outline"
      loading={load.retrying}
      onClick={() => void queries.refetchQueries({ type: 'active', predicate: (query) => query.state.status === 'error' })}
    >
      Try again
    </Button>
  )
  if (compact) {
    return (
      <div role="alert" className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left text-[13px] text-amber-900', className)}>
        <CloudOff className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 basis-40">
          <span className="font-semibold">{load.failed ? `Could not load ${what}.` : `Could not refresh ${what}.`}</span>{' '}
          {load.failed ? failureReason(load.error, true) : 'This is what was loaded earlier.'}
        </span>
        {retry}
      </div>
    )
  }
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <CloudOff className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">Could not load {what}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-slate-500">{failureReason(load.error, false)}</p>
      <div className="mt-4">{retry}</div>
    </div>
  )
}

/**
 * The part of a screen that shows loaded data. While the first answer is on its way it shows the
 * skeleton; if the request failed it shows `LoadError`; only with data in hand does it render its
 * children, so an empty state inside it always means "the server says there is nothing".
 * `card`: the caller is not inside a card, so the failure gets one of its own.
 */
export function Loaded({
  load,
  what,
  skeleton,
  card,
  children,
}: {
  load: LoadState
  /** Completes "Could not load …", e.g. "the team directory". */
  what: string
  skeleton?: ReactNode
  card?: boolean
  children: ReactNode
}) {
  if (load.failed) {
    const failure = <LoadError what={what} load={load} />
    return card ? <Card>{failure}</Card> : failure
  }
  if (load.loading) return <>{skeleton ?? <ListSkeleton rows={5} />}</>
  return (
    <>
      {load.stale && <LoadError compact what={what} load={load} className={card ? 'mb-3' : 'm-3'} />}
      {children}
    </>
  )
}

const FiguresUnknown = createContext(false)

/**
 * A row of `StatCard` tiles. Until their data has arrived, and when it could not be loaded, the
 * tiles show "—" instead of a number: a zero would be a claim. With `what`, the tiles have a
 * request of their own, so its failure is reported here; without it, the list below them (same
 * request) carries the message.
 */
export function Figures({ load, what, className, children }: { load: LoadState; what?: string; className?: string; children: ReactNode }) {
  if (what && load.failed) return <LoadError compact what={what} load={load} className="mb-4" />
  return (
    <FiguresUnknown.Provider value={load.loading || load.failed}>
      {what && load.stale && <LoadError compact what={what} load={load} className="mb-3" />}
      <div className={className}>{children}</div>
    </FiguresUnknown.Provider>
  )
}

/**
 * A figure with its label. The tile measures itself (a container query), because the same tile
 * sits two, three, four or five across: only a tile wide enough keeps its icon, so the number is
 * always complete and the label and hint wrap instead of being cut off.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  onClick,
  accent,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  onClick?: () => void
  accent?: 'brand' | 'amber' | 'red' | 'blue' | 'green' | 'slate'
  className?: string
}) {
  const unknown = useContext(FiguresUnknown)
  const accents = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-sky-50 text-sky-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        '@container flex items-center rounded-xl border border-slate-200 bg-white text-left shadow-card',
        onClick && 'transition hover:border-brand-300 hover:shadow-md cursor-pointer',
        className,
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-3 p-2.5 @[8rem]:p-3.5 @[12rem]:p-4">
        {icon && (
          <span className={cn('hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg @[12rem]:flex', accents[accent || 'brand'])}>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-xl font-bold leading-6 text-slate-900">{unknown ? '—' : value}</span>
          <span className="block break-words text-xs font-medium text-slate-500">{label}</span>
          {hint && !unknown && <span className="block break-words text-[11px] text-slate-400">{hint}</span>}
        </span>
      </span>
    </Comp>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

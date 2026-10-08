import type { ReactNode } from 'react'
import { Search, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
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
        'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-card sm:p-4',
        onClick && 'transition hover:border-brand-300 hover:shadow-md cursor-pointer',
        className,
      )}
    >
      {icon && (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accents[accent || 'brand'])}>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xl font-bold leading-6 text-slate-900">{value}</span>
        <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
        {hint && <span className="block truncate text-[11px] text-slate-400">{hint}</span>}
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

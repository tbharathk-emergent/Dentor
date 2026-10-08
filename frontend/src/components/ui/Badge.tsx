import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
}

export function Badge({
  tone = 'slate',
  children,
  className,
  dot,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

/** Shared mapping of domain statuses to badge tones. */
export function statusTone(status: string | undefined | null): Tone {
  const s = (status || '').toLowerCase()
  if (['completed', 'paid', 'active', 'in stock', 'delivered', 'confirmed', 'converted', 'done', 'approved', 'present', 'received'].includes(s)) return 'green'
  if (['scheduled', 'new', 'sent', 'dispatched', 'in progress', 'in-progress', 'ordered', 'open'].includes(s)) return 'blue'
  if (['waiting', 'pending', 'partial', 'low stock', 'due', 'follow-up', 'followup', 'on hold', 'trial'].includes(s)) return 'amber'
  if (['cancelled', 'canceled', 'no-show', 'no show', 'overdue', 'out of stock', 'inactive', 'failed', 'rejected', 'lost', 'absent'].includes(s)) return 'red'
  if (['checked-in', 'checked in', 'arrived', 'qualified', 'contacted'].includes(s)) return 'violet'
  return 'slate'
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null
  return (
    <Badge tone={statusTone(status)} className={className} dot>
      {status}
    </Badge>
  )
}

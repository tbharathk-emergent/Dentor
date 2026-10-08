import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: string; label: ReactNode; count?: number }[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        '-mx-4 flex gap-1 overflow-x-auto px-4 pb-px sm:mx-0 sm:px-0',
        'border-b border-slate-200',
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  active ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500',
                )}
              >
                {t.count}
              </span>
            )}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        )
      })}
    </div>
  )
}

/** Segmented control — for compact view switches (e.g. Grid/List, Today/Week). */
export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: string; label: ReactNode }[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap',
            o.key === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

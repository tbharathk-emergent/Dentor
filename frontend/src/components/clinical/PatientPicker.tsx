import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useList, type Doc } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { inputBase } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/bits'

/** Searchable patient combobox backed by the patients API. */
export function PatientPicker({
  value,
  onChange,
  placeholder = 'Search patient by name, ID or mobile…',
  className,
}: {
  value: Doc | null
  onChange: (p: Doc | null) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useList('patients', { q, limit: 12, sort: 'name', order: 'asc' }, { enabled: open })
  const items = data?.items ?? []

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const display = value ? `${value.name}${value.code ? ` · ${value.code}` : ''}` : ''

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        value={open ? q : display}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          setQ('')
          setOpen(true)
        }}
        placeholder={value && !open ? display : placeholder}
        className={cn(inputBase, 'h-10 pr-14')}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear patient"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange(null)
            setQ('')
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          {isLoading ? (
            <div className="px-3 py-3 text-[13px] text-slate-400">Searching patients…</div>
          ) : !items.length ? (
            <div className="px-3 py-3 text-[13px] text-slate-400">No patients match “{q}”.</div>
          ) : (
            items.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50',
                  value?.id === p.id && 'bg-brand-50/60',
                )}
              >
                <Avatar name={p.name} src={p.photo} className="h-8 w-8 text-xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.code} · {p.age}/{String(p.gender || '').charAt(0)} · {p.mobile}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { X } from 'lucide-react'
import { useList, type Doc } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/bits'

/** Search-as-you-type patient selector used by Rx compose and the pharmacy POS. */
export function PatientPicker({
  value,
  onSelect,
  onClear,
  placeholder = 'Search by name, ID or mobile…',
}: {
  value: Doc | null
  onSelect: (p: Doc) => void
  onClear: () => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { data } = useList('patients', { q: query, limit: 8 })

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
        <Avatar name={value.name} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{value.name}</div>
          <div className="text-xs text-slate-500">
            {value.code}
            {value.age ? ` · ${value.age}/${String(value.gender || '').charAt(0)}` : ''}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" type="button" onClick={onClear} aria-label="Clear patient">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && (data?.items?.length ?? 0) > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          {data!.items.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setQuery(''); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50"
            >
              <Avatar name={p.name} className="h-7 w-7 text-[11px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                <span className="block text-xs text-slate-500">
                  {p.code} · {p.age}/{String(p.gender || '').charAt(0)} · {p.mobile}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

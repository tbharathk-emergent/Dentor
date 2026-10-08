import { useState } from 'react'
import { X } from 'lucide-react'
import { useList, type Doc } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/bits'

/** Inline patient search picker used by ops modules (Lab, Inventory issues etc). */
export function PatientPicker({
  label = 'Patient',
  required,
  error,
  name,
  code,
  enabled = true,
  onSelect,
  onClear,
}: {
  label?: string
  required?: boolean
  error?: string
  name: string
  code: string
  enabled?: boolean
  onSelect: (p: Doc) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [showList, setShowList] = useState(false)
  const { data } = useList('patients', { q: query, limit: 8 }, { enabled })

  return (
    <div className="relative">
      <Field label={label} required={required} error={error}>
        {name ? (
          <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
            <Avatar name={name} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
              <div className="text-xs text-slate-500">{code || '—'}</div>
            </div>
            <Button variant="ghost" size="icon-sm" type="button" onClick={onClear} aria-label="Clear patient">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowList(true) }}
              onFocus={() => setShowList(true)}
              placeholder="Search by name, ID or mobile…"
            />
            {showList && (data?.items?.length ?? 0) > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                {data!.items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelect(p); setShowList(false); setQuery('') }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50"
                  >
                    <Avatar name={p.name} className="h-7 w-7 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.code} · {p.mobile}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>
    </div>
  )
}

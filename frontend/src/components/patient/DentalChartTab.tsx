import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, qs, type ListResponse } from '@/lib/api'
import { useCreate, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

export const TOOTH_CONDITIONS = [
  'Healthy', 'Caries', 'Filled', 'Crown', 'Root Canal', 'Missing', 'Implant', 'Fractured',
] as const
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number]

interface ToothState {
  condition: ToothCondition
  note?: string
}

const CONDITION_STYLE: Record<ToothCondition, { tooth: string; swatch: string }> = {
  Healthy: { tooth: 'border-slate-200 bg-white text-slate-500 hover:border-brand-400', swatch: 'border border-slate-300 bg-white' },
  Caries: { tooth: 'border-amber-400 bg-amber-100 text-amber-800', swatch: 'bg-amber-300' },
  Filled: { tooth: 'border-slate-400 bg-slate-200 text-slate-700', swatch: 'bg-slate-400' },
  Crown: { tooth: 'border-sky-400 bg-sky-100 text-sky-800', swatch: 'bg-sky-400' },
  'Root Canal': { tooth: 'border-red-400 bg-red-100 text-red-800', swatch: 'bg-red-400' },
  Missing: { tooth: 'border-dashed border-slate-300 bg-slate-50 text-slate-300', swatch: 'border border-dashed border-slate-400 bg-slate-50' },
  Implant: { tooth: 'border-violet-400 bg-violet-100 text-violet-800', swatch: 'bg-violet-400' },
  Fractured: { tooth: 'border-orange-400 bg-orange-100 text-orange-800', swatch: 'bg-orange-400' },
}

const QUADRANTS: { label: string; teeth: number[] }[] = [
  { label: 'Upper Right (18–11)', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { label: 'Upper Left (21–28)', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: 'Lower Right (48–41)', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { label: 'Lower Left (31–38)', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
]

export function DentalChartTab({ patientCode }: { patientCode: string }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [condition, setCondition] = useState<ToothCondition>('Healthy')
  const [note, setNote] = useState('')

  const { data, isLoading } = useList('charts', { patientId: patientCode, type: 'dental', limit: 1 })
  const chart: Doc | undefined = data?.items?.[0]
  const teeth: Record<string, ToothState> = useMemo(() => chart?.teeth ?? {}, [chart])

  const create = useCreate('charts')
  const update = useUpdate('charts')
  const saving = create.isPending || update.isPending

  const openTooth = (n: number) => {
    const state = teeth[String(n)]
    setCondition(state?.condition ?? 'Healthy')
    setNote(state?.note ?? '')
    setSelected(n)
  }

  const saveTooth = async () => {
    if (selected == null) return
    // Re-check the server for an existing chart doc so rapid consecutive saves
    // never create duplicate chart documents.
    let existing: Doc | undefined = chart
    if (!existing) {
      try {
        const res = await api.get<ListResponse<Doc>>(
          `/api/charts${qs({ patientId: patientCode, type: 'dental', limit: 1 })}`,
        )
        existing = res.items?.[0]
      } catch {
        /* fall through to create */
      }
    }
    const base: Record<string, ToothState> = { ...(existing?.teeth ?? {}), ...teeth }
    const next: Record<string, ToothState> = { ...base }
    if (condition === 'Healthy' && !note.trim()) {
      delete next[String(selected)]
    } else {
      next[String(selected)] = { condition, note: note.trim() }
    }
    const done = () => { toast.success(`Tooth ${selected} marked ${condition}`); setSelected(null) }
    if (existing) {
      update.mutate({ id: existing.id, teeth: next }, { onSuccess: done })
    } else {
      create.mutate({ patientId: patientCode, type: 'dental', teeth: next } as Partial<Doc>, { onSuccess: done })
    }
  }

  const summary = useMemo(() => {
    const counts: Partial<Record<ToothCondition, number>> = {}
    for (const t of Object.values(teeth)) counts[t.condition] = (counts[t.condition] ?? 0) + 1
    return counts
  }, [teeth])

  const renderTooth = (n: number) => {
    const state = teeth[String(n)]
    const cond = state?.condition ?? 'Healthy'
    return (
      <button
        key={n}
        onClick={() => openTooth(n)}
        title={state ? `${n} · ${cond}${state.note ? ` — ${state.note}` : ''}` : `Tooth ${n}`}
        aria-label={`Tooth ${n}, ${cond}`}
        className={cn(
          'relative flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          CONDITION_STYLE[cond].tooth,
        )}
      >
        {cond === 'Missing' ? <span className="text-sm leading-none">✕</span> : n}
        {state?.note && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />}
      </button>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Dental Chart (FDI)"
          subtitle="Tap a tooth to record its condition — changes save to the patient record instantly"
        />
        <CardBody>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[640px] space-y-5">
              {/* Upper arch */}
              <div>
                <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>{QUADRANTS[0].label}</span>
                  <span>{QUADRANTS[1].label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {QUADRANTS[0].teeth.map(renderTooth)}
                  <span className="mx-1.5 h-10 w-px shrink-0 bg-slate-300" />
                  {QUADRANTS[1].teeth.map(renderTooth)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Occlusal plane</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              {/* Lower arch */}
              <div>
                <div className="flex items-center gap-1">
                  {QUADRANTS[2].teeth.map(renderTooth)}
                  <span className="mx-1.5 h-10 w-px shrink-0 bg-slate-300" />
                  {QUADRANTS[3].teeth.map(renderTooth)}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>{QUADRANTS[2].label}</span>
                  <span>{QUADRANTS[3].label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
            {TOOTH_CONDITIONS.map((c) => (
              <span key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={cn('h-3 w-3 rounded', CONDITION_STYLE[c].swatch)} />
                {c}
                {summary[c] ? <span className="font-semibold text-slate-800">· {summary[c]}</span> : null}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Noted conditions list */}
      {Object.keys(teeth).length > 0 && (
        <Card>
          <CardHeader title="Recorded Findings" subtitle={`${Object.keys(teeth).length} tooth record${Object.keys(teeth).length === 1 ? '' : 's'}`} />
          <ul className="divide-y divide-slate-100">
            {Object.entries(teeth)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([n, t]) => (
                <li key={n} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold', CONDITION_STYLE[t.condition].tooth)}>
                    {n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{t.condition}</div>
                    {t.note && <div className="truncate text-xs text-slate-500">{t.note}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openTooth(Number(n))}>Edit</Button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={selected != null}
        onClose={() => setSelected(null)}
        title={`Tooth ${selected ?? ''}`}
        subtitle="Set the clinical condition and an optional note"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={saveTooth} loading={saving}>Save Tooth</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {TOOTH_CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondition(c)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition',
                  condition === c
                    ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span className={cn('h-3 w-3 shrink-0 rounded', CONDITION_STYLE[c].swatch)} />
                {c}
              </button>
            ))}
          </div>
          <Field label="Clinical Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Occlusal caries, D3 — plan composite restoration" className="min-h-[64px]" />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}

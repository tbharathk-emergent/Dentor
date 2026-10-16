import { useState, type FormEvent } from 'react'
import { Plus, Tags } from 'lucide-react'
import { fmtINR, useCreate, useList, useUpdate, type Doc } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, Loaded, SearchInput } from '@/components/ui/bits'

const CATEGORIES = ['Consultation', 'Endodontics', 'Orthodontics', 'Periodontics', 'Prosthodontics', 'Oral Surgery', 'Implantology', 'Cosmetic Dentistry', 'Paediatric']
const UNITS = ['Per Visit', 'Per Tooth', 'Per Arch', 'Per Quadrant', 'Full Mouth', 'Per Case']
const empty = { name: '', code: '', category: 'Consultation', price: '', tax: '0', duration: '30', unit: 'Per Visit', doctorShare: '0', description: '' }

/**
 * "add procedure form" (cms.fig 328:2428): a treatment with its fee, GST, duration and the doctor's share. The
 * list is the clinic's tariff (the Clinic app's Treatment Tariff and the booking form read it).
 */
export function TreatmentFees() {
  const { isClinicAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Doc | null>(null)
  const [open, setOpen] = useState(false)
  const { data, load } = useList('treatment_masters', { q, sort: 'category', order: 'asc', limit: 500 })
  const rows = data?.items ?? []
  return (
    <div data-testid="treatment-fees">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search treatments…" className="min-w-0 flex-1 sm:max-w-sm" />
        {isClinicAdmin && <Button onClick={() => { setEditing(null); setOpen(true) }} data-testid="fee-add"><Plus className="h-4 w-4" /> Add procedure</Button>}
      </div>
      <Card>
        <Loaded load={load} what="the treatments">
          {!rows.length ? (
            <EmptyState icon={<Tags className="h-6 w-6" />} title="No treatments" message="Add the clinic's procedures with their fees." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-2">Treatment</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Fee</th><th className="px-4 py-2 text-right">GST</th><th className="px-4 py-2 text-right">Minutes</th><th className="px-4 py-2 text-right">Doctor share</th><th className="px-4 py-2">Status</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0" data-testid={`fee-row-${r.code}`}>
                      <td className="px-4 py-2"><div className="font-semibold text-slate-800">{r.name}</div><div className="text-xs text-slate-400">{r.code} · {r.unit}</div></td>
                      <td className="px-4 py-2">{r.category}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmtINR(Number(r.price || 0))}</td>
                      <td className="px-4 py-2 text-right">{Number(r.tax || 0)}%</td>
                      <td className="px-4 py-2 text-right">{r.duration}</td>
                      <td className="px-4 py-2 text-right">{Number(r.doctorShare || 0)}%</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2 text-right">{isClinicAdmin && <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true) }}>Edit</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Loaded>
      </Card>
      <FeeForm open={open} editing={editing} onClose={() => setOpen(false)} />
    </div>
  )
}

function FeeForm({ open, editing, onClose }: { open: boolean; editing: Doc | null; onClose: () => void }) {
  const create = useCreate('treatment_masters', { successMessage: 'Procedure added' })
  const update = useUpdate('treatment_masters', { successMessage: 'Procedure updated' })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  const key = editing?.id ?? (open ? 'new' : '')
  if (key !== loaded) {
    setLoaded(key)
    setError('')
    setForm(editing ? { name: editing.name ?? '', code: editing.code ?? '', category: editing.category ?? 'Consultation', price: String(editing.price ?? ''), tax: String(editing.tax ?? 0),
      duration: String(editing.duration ?? 30), unit: editing.unit ?? 'Per Visit', doctorShare: String(editing.doctorShare ?? 0), description: editing.description ?? '' } : empty)
  }
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = { ...form, name: form.name.trim(), price: Number(form.price), tax: Number(form.tax), duration: Number(form.duration), doctorShare: Number(form.doctorShare), status: editing?.status ?? 'Active' }
    if (body.name.length < 2) return setError('Give the procedure a name.')
    if (!(body.price >= 0) || form.price === '') return setError('Enter the fee.')
    setError('')
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...body } as Doc & { id: string })
      else await create.mutateAsync(body as Partial<Doc>)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit procedure' : 'Add procedure'} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="fee-form" loading={create.isPending || update.isPending} data-testid="fee-save">Save</Button></>}>
      <form id="fee-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Procedure" required className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name')(e.target.value)} data-testid="fee-name" /></Field>
        <Field label="Code" hint="Left empty, one is given"><Input value={form.code} onChange={(e) => set('code')(e.target.value)} /></Field>
        <Field label="Speciality"><Select value={form.category} onChange={(e) => set('category')(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Fee (₹)" required><Input type="number" min="0" value={form.price} onChange={(e) => set('price')(e.target.value)} data-testid="fee-price" /></Field>
        <Field label="GST %"><Select value={form.tax} onChange={(e) => set('tax')(e.target.value)} data-testid="fee-tax">{['0', '5', '12', '18'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Duration (minutes)"><Input type="number" min="5" max="480" value={form.duration} onChange={(e) => set('duration')(e.target.value)} /></Field>
        <Field label="Unit"><Select value={form.unit} onChange={(e) => set('unit')(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Doctor's share %" hint="The commission split for the treating doctor"><Input type="number" min="0" max="100" value={form.doctorShare} onChange={(e) => set('doctorShare')(e.target.value)} data-testid="fee-share" /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set('description')(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600 sm:col-span-2" data-testid="fee-error">{error}</p>}
      </form>
    </Dialog>
  )
}

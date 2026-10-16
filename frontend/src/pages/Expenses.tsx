import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtINR, loadState, todayISO, useCreate, type Doc } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { EmptyState, Figures, Loaded, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { FINANCE_ROLES } from '@/components/layout/nav'

// The categories of the Clinic app design (dentor.fig "In-house Accounts / expenses" 203), kept by the API.
const CATEGORIES = ['Consultant', 'Duty Doctors', 'Purchase', 'Lab Orders', 'Miscellaneous', 'Staff', 'Domestic']
const MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

interface Line { id: string; source: string; date: string; category: string; payee: string; description: string; amount: number; mode: string; reference: string; code: string }
interface Lines { from: string; to: string; items: Line[]; total: number }

/** The periods the Accounts figures use; the API takes a year at most. */
const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'last', label: 'Last month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
] as const
type Period = (typeof PERIODS)[number]['key']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function range(period: Period): { from: string; to: string } {
  const today = todayISO()
  const [y, m] = today.split('-').map(Number)
  if (period === 'last') return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m - 1, 0)) }
  if (period === 'quarter') return { from: iso(new Date(y, m - 3, 1)), to: today }
  if (period === 'year') return { from: `${y}-01-01`, to: today }
  return { from: `${today.slice(0, 8)}01`, to: today }
}

/**
 * Money going out: rent, salaries, supplies, lab and consultant payments. The owner, administrators and
 * accountants record and see them here and in the Clinic app's Accounts. The list is the one the Accounts
 * figures add up: recorded expenses plus the lab payments and completed consultant visits of the period.
 */
export default function Expenses() {
  const { user, isSuperAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [period, setPeriod] = useState<Period>('month')
  const [open, setOpen] = useState(false)
  const allowed = isSuperAdmin || FINANCE_ROLES.includes(user?.role ?? '')
  const { from, to } = range(period)
  const params = new URLSearchParams({ date_from: from, date_to: to, ...(category ? { category } : {}) })
  const list = useQuery<Lines>({
    queryKey: ['expenses', 'lines', from, to, category],
    queryFn: () => api.get<Lines>(`/api/clinic-app/accounts/expenses?${params}`),
    enabled: allowed,
    placeholderData: (prev) => prev,
  })
  const needle = q.trim().toLowerCase()
  const items = (list.data?.items ?? []).filter((e) => !needle || [e.payee, e.description, e.reference, e.code].some((v) => v?.toLowerCase().includes(needle)))
  const total = items.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  if (!allowed) {
    return (
      <Card>
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Expenses are for the clinic's accounts team" message="Only the owner, an administrator or an accountant can see the clinic's expenses." />
      </Card>
    )
  }

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Money going out: rent, salaries, supplies, labs and consultants."
        actions={<Button onClick={() => setOpen(true)} data-testid="expense-add"><Plus className="h-4 w-4" /> Add expense</Button>} />
      <Figures load={loadState(list)} what="the expense total" className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Shown" value={list.data ? fmtINR(total) : '—'} hint={list.data ? `${items.length} entr${items.length === 1 ? 'y' : 'ies'}` : undefined} icon={<Wallet className="h-5 w-5" />} />
      </Figures>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Payee, description, number…" className="sm:max-w-xs" />
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto" data-testid="expense-period">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto" data-testid="expense-filter">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>
      <Loaded load={loadState(list)} what="the expenses" card>
        {!items.length ? (
          <Card><EmptyState icon={<Wallet className="h-6 w-6" />} title="No expenses in this period" message="Add one (rent, salaries, supplies…); paid lab orders and completed consultant visits appear on their own." /></Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Paid to</th><th className="px-4 py-2">What for</th><th className="px-4 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={`${e.source}-${e.id}`} className="border-b border-slate-100 last:border-0" data-testid={`expense-row-${e.code}`}>
                    <td className="px-4 py-2 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-2">{e.category}{e.source !== 'Recorded' && <span className="block text-xs text-slate-400">from {e.source.toLowerCase()}</span>}</td>
                    <td className="px-4 py-2">{e.payee}</td>
                    <td className="px-4 py-2 text-slate-500">{[e.description, e.mode, e.reference].filter(Boolean).join(' · ')}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtINR(Number(e.amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Loaded>
      <AddExpense open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function AddExpense({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreate('expenses', { successMessage: 'Expense recorded', invalidate: ['clinic-app'] })
  const [form, setForm] = useState({ category: '', amount: '', payee: '', description: '', mode: 'Cash', reference: '', date: todayISO() })
  const [error, setError] = useState('')
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.category) return setError('Choose the category.')
    if (!(Number(form.amount) > 0)) return setError('Enter the amount.')
    if (!form.payee.trim()) return setError('Say who was paid.')
    setError('')
    try {
      await create.mutateAsync({ ...form, amount: Number(form.amount) } as Partial<Doc>)
      setForm({ category: '', amount: '', payee: '', description: '', mode: 'Cash', reference: '', date: todayISO() })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Add expense" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="expense-form" loading={create.isPending} data-testid="expense-save">Save</Button></>}>
      <form id="expense-form" onSubmit={submit} className="space-y-3">
        <Field label="Category" required>
          <Select value={form.category} onChange={(e) => set('category')(e.target.value)} data-testid="expense-category">
            <option value="">Choose</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Amount (₹)" required><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount')(e.target.value)} data-testid="expense-amount" /></Field>
        <Field label="Paid to" required><Input value={form.payee} onChange={(e) => set('payee')(e.target.value)} data-testid="expense-payee" /></Field>
        <Field label="What for"><Input value={form.description} onChange={(e) => set('description')(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode"><Select value={form.mode} onChange={(e) => set('mode')(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} /></Field>
        </div>
        <Field label="Reference"><Input value={form.reference} onChange={(e) => set('reference')(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600" data-testid="expense-error">{error}</p>}
      </form>
    </Dialog>
  )
}

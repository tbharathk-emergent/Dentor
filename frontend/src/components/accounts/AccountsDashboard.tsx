import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtINR, loadState } from '@/lib/hooks'
import { Card } from '@/components/ui/Card'
import { Figures, StatCard } from '@/components/ui/bits'

interface Summary {
  collected: number
  collected_change: number | null
  expenses: number
  expenses_change: number | null
  net: number
  categories: { category: string; amount: number; entries: number }[]
}

const change = (pct: number | null) => (pct === null ? undefined : `${pct >= 0 ? '+' : ''}${pct}% on last month's same days`)

/**
 * The CMS design's accounts dashboard (cms.fig 346:178): income, expenses and net for this month, and where the
 * money went. For the owner, administrators and accountants (the API refuses the others).
 */
export function AccountsDashboard() {
  const summary = useQuery<Summary>({ queryKey: ['clinic-app', 'accounts', 'summary', 'web'], queryFn: () => api.get('/api/clinic-app/accounts/summary') })
  const s = summary.data
  const top = (s?.categories ?? []).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 4)
  return (
    <div className="mb-4" data-testid="accounts-dashboard">
      <Figures load={loadState(summary)} what="this month's income and expenses" className="mb-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <StatCard label="Income this month" value={s ? fmtINR(s.collected) : '—'} hint={s ? change(s.collected_change) : undefined} icon={<TrendingUp className="h-5 w-5" />} accent="green" />
        <StatCard label="Expenses this month" value={s ? fmtINR(s.expenses) : '—'} hint={s ? change(s.expenses_change) : undefined} icon={<TrendingDown className="h-5 w-5" />} accent="red" />
        <StatCard label="Net this month" value={s ? fmtINR(s.net) : '—'} icon={<Wallet className="h-5 w-5" />} accent={s && s.net < 0 ? 'red' : 'blue'} />
      </Figures>
      {!!top.length && (
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Where it went:</span>
          {top.map((c) => <span key={c.category}>{c.category} {fmtINR(c.amount)}</span>)}
          <Link to="/expenses" className="ml-auto font-semibold text-brand-700 hover:underline">All expenses →</Link>
        </Card>
      )}
    </div>
  )
}

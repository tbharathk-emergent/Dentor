import { useNavigate } from 'react-router-dom'
import { ExternalLink, Receipt } from 'lucide-react'
import { fmtDate, fmtINR, useList } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

export function InvoicesTab({ patientCode }: { patientCode: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useList('invoices', { patientCode, sort: 'date', order: 'desc', limit: 200 })
  const invoices = data?.items ?? []
  const totals = invoices.reduce(
    (acc, i) => ({ total: acc.total + Number(i.total ?? 0), paid: acc.paid + Number(i.paid ?? 0), balance: acc.balance + Number(i.balance ?? 0) }),
    { total: 0, paid: 0, balance: 0 },
  )

  return (
    <Card>
      <CardHeader
        title="Invoices"
        subtitle="Billing records for this patient — managed in Accounts"
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate('/accounts')}>
            <ExternalLink className="h-4 w-4" /> Open Accounts
          </Button>
        }
      />
      <DataTable
        rows={invoices}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={() => navigate('/accounts')}
        empty={
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No invoices yet"
            message="Invoices raised for this patient in Accounts will appear here."
          />
        }
        columns={[
          { key: 'number', header: 'Invoice', cell: (r) => <span className="font-semibold text-slate-800">{r.number}</span> },
          { key: 'date', header: 'Date', cell: (r) => <span className="whitespace-nowrap text-slate-600">{fmtDate(r.date)}</span> },
          { key: 'treatment', header: 'Treatment', cell: (r) => <span className="text-slate-600">{r.treatment || '—'}</span> },
          { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="font-medium text-slate-800">{fmtINR(r.total)}</span> },
          { key: 'paid', header: 'Paid', align: 'right', cell: (r) => <span className="text-emerald-700">{fmtINR(r.paid)}</span> },
          {
            key: 'balance', header: 'Balance', align: 'right',
            cell: (r) => (
              <span className={cn('font-medium', Number(r.balance ?? 0) > 0 ? 'text-red-600' : 'text-slate-500')}>
                {fmtINR(r.balance)}
              </span>
            ),
          },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{r.number}</span>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">{fmtDate(r.date)} · {r.treatment || '—'}</div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-slate-800">{fmtINR(r.total)}</span>
              <span className={cn(Number(r.balance ?? 0) > 0 ? 'font-medium text-red-600' : 'text-slate-400')}>
                {Number(r.balance ?? 0) > 0 ? `Due ${fmtINR(r.balance)}` : 'Settled'}
              </span>
            </div>
          </div>
        )}
        footer={
          invoices.length ? (
            <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-slate-100 px-4 py-3 text-[13px] sm:px-5">
              <span className="text-slate-500">Billed <span className="font-semibold text-slate-800">{fmtINR(totals.total)}</span></span>
              <span className="text-slate-500">Paid <span className="font-semibold text-emerald-700">{fmtINR(totals.paid)}</span></span>
              <span className="text-slate-500">Balance <span className={cn('font-semibold', totals.balance > 0 ? 'text-red-600' : 'text-slate-800')}>{fmtINR(totals.balance)}</span></span>
            </div>
          ) : undefined
        }
      />
    </Card>
  )
}

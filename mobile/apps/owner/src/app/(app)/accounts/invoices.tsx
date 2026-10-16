import { EmptyState, ListRow, QueryState, Screen, Segmented, StatusBadge, TextField, fmtINR, space, useLocalSearchParams } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useAccountInvoices, useReceipts } from '@/clinic/accounts'
import { PeriodControl } from '@/components/PeriodControl'
import { usePeriod } from '@/hooks/usePeriod'
import { useRouter } from '@/nav'

/** "Invoice" and "Reciept" lists (dentor.fig 198–201). */
export default function InvoicesAndReceipts() {
  const params = useLocalSearchParams<{ tab?: string }>()
  const router = useRouter()
  const period = usePeriod()
  const [tab, setTab] = useState<'invoices' | 'receipts'>(params.tab === 'receipts' ? 'receipts' : 'invoices')
  const [q, setQ] = useState('')
  const invoices = useAccountInvoices(period.range, q.trim())
  const receipts = useReceipts(period.range)
  return (
    <Screen testID="account-invoices-screen" title="Invoices & Receipts" back>
      <Segmented options={[{ key: 'invoices', label: 'Invoices' }, { key: 'receipts', label: 'Receipts' }]} value={tab} onChange={setTab} />
      <PeriodControl scope="invoices" />
      {tab === 'invoices' ? (
        <>
          <TextField testID="invoice-search" icon="search" value={q} onChangeText={setQ} placeholder="Patient or invoice number" autoCapitalize="none" />
          <QueryState query={invoices}>
            {(data) => data.items.length ? (
              <View style={{ gap: space.xs }}>
                {data.items.map((i) => (
                  <ListRow key={i.id} testID={`invoice-${i.number}`} title={`${i.patient} · ${fmtINR(i.total)}`} subtitle={`${i.number} · ${i.treatment}`} meta={i.date_label}
                    right={<StatusBadge status={i.status} />} chevron onPress={() => router.push({ pathname: '/accounts/invoice/[id]', params: { id: i.id } })} />
                ))}
              </View>
            ) : <EmptyState icon="file-text" title="No invoices in this period" />}
          </QueryState>
        </>
      ) : (
        <QueryState query={receipts}>
          {(data) => data.items.length ? (
            <View style={{ gap: space.xs }}>
              {data.items.map((p) => (
                <ListRow key={p.id} testID={`receipt-${p.receipt}`} title={`${p.patient} · ${fmtINR(p.amount)}`} subtitle={`${p.receipt} · ${p.mode}${p.invoice ? ` · ${p.invoice}` : ''}`} meta={p.date_label} />
              ))}
            </View>
          ) : <EmptyState icon="check-square" title="No receipts in this period" />}
        </QueryState>
      )}
    </Screen>
  )
}

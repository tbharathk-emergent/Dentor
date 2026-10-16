import { QueryState, Screen, space } from '@dentor/shared'
import { View } from 'react-native'
import { PeriodControl } from '@/components/PeriodControl'
import { BreakdownCard } from '@/components/finance/BreakdownCard'
import { CollectionSummary } from '@/components/finance/CollectionSummary'
import { OutstandingInvoices } from '@/components/finance/OutstandingInvoices'
import { RecentPayments } from '@/components/finance/RecentPayments'
import { useFinance } from '@/hooks/useFinance'
import { usePeriod } from '@/hooks/usePeriod'
import { useRefresh } from '@/hooks/useRefresh'

export default function FinanceScreen() {
  const period = usePeriod()
  const finance = useFinance(period.range)
  const { refreshing, refresh } = useRefresh(finance)

  return (
    <Screen testID="finance-screen" title="Finance" subtitle="Billing, collections and dues" refreshing={refreshing} onRefresh={refresh}>
      <PeriodControl scope="finance" updating={finance.isPlaceholderData} />
      <QueryState query={finance}>
        {(data) => (
          <View style={{ gap: space.lg, opacity: finance.isPlaceholderData ? 0.5 : 1 }}>
            <CollectionSummary billed={data.billed} collected={data.collected} />
            <BreakdownCard
              testID="by-mode"
              title="Collections by payment mode"
              buckets={data.by_mode}
              countNoun="payment"
              tone="green"
              emptyText="No payments were received in this period."
            />
            <BreakdownCard testID="by-doctor" title="Revenue by doctor" buckets={data.by_doctor} countNoun="invoice" emptyText="No invoices were raised in this period." />
            <BreakdownCard
              testID="by-treatment"
              title="Revenue by treatment"
              buckets={data.by_treatment}
              countNoun="invoice"
              emptyText="No invoices were raised in this period."
            />
            <OutstandingInvoices invoices={data.outstanding} total={data.outstanding_total} />
            <RecentPayments payments={data.recent_payments} />
          </View>
        )}
      </QueryState>
    </Screen>
  )
}

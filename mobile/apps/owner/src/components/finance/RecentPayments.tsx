import { Card, EmptyState, ListRow, Section, T, colors, fmtINR } from '@dentor/shared'
import { ExpandableList } from '@/components/ExpandableList'
import type { RecentPayment } from '@/types'

/** Payments received in the chosen period, newest first. */
export function RecentPayments({ payments }: { payments: RecentPayment[] }) {
  return (
    <Section title="Recent payments">
      <Card padded={false} testID="payments-card">
        {payments.length === 0 ? (
          <EmptyState testID="payments-empty" icon="credit-card" title="No payments in this period" message="Payments recorded at the front desk appear here." />
        ) : (
          <ExpandableList
            testID="payments-list"
            items={payments}
            keyOf={(payment) => payment.id}
            render={(payment) => (
              <ListRow
                testID="recent-payment"
                title={payment.patient || 'Unnamed patient'}
                subtitle={[payment.mode, payment.date_label].filter(Boolean).join(' · ')}
                meta={[payment.receipt, payment.invoice && `for ${payment.invoice}`].filter(Boolean).join(' ')}
                right={
                  <T variant="bodyStrong" color={colors.green} testID="payment-amount">
                    {fmtINR(payment.amount)}
                  </T>
                }
              />
            )}
          />
        )}
      </Card>
    </Section>
  )
}

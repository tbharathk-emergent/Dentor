import { Card, Divider, T, colors } from '@dentor/shared'
import { Fragment } from 'react'
import { PaymentRow } from '@/components/payments/PaymentRow'
import type { Payment } from '@/types'

/** Receipts in one card, or a line saying there are none yet. */
export function PaymentList({ payments, emptyText }: { payments: Payment[]; emptyText: string }) {
  return (
    <Card testID="payment-list">
      {payments.length === 0 ? (
        <T variant="small" color={colors.textMuted}>{emptyText}</T>
      ) : (
        payments.map((payment, index) => (
          <Fragment key={payment.id}>
            {index > 0 && <Divider />}
            <PaymentRow payment={payment} />
          </Fragment>
        ))
      )}
    </Card>
  )
}

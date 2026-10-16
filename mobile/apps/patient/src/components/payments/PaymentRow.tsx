import { T, colors, fmtDate, fmtINR, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { Payment } from '@/types'

/** One receipt: how much, how and when it was paid. */
export function PaymentRow({ payment }: { payment: Payment }) {
  const how = [payment.mode, payment.reference].filter(Boolean).join(' · ')
  return (
    <View testID="payment-row" style={styles.row}>
      <View style={styles.text}>
        <T variant="smallStrong">{payment.receipt || 'Payment'}</T>
        <T variant="small" color={colors.textMuted}>{[fmtDate(payment.date), how].filter(Boolean).join(' · ')}</T>
      </View>
      <T variant="bodyStrong" color={colors.green}>{fmtINR(payment.amount)}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
})

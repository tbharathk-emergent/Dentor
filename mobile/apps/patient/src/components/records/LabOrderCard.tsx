import { StatusBadge, fmtDate, space } from '@dentor/shared'
import { StyleSheet, Text, View } from 'react-native'
import type { LabOrder } from '@/types'

/**
 * A crown, denture or other piece being made by the dental lab, as the design shows it
 * (frame "Lab record" 49:664): a white card, radius 12, with the drop shadow; "Case ID" in
 * Roboto 11 #6b7280 with the status on the right, the piece in Roboto Bold 14 #111827, the
 * details in Roboto 11 #6b7280. The design's "View Report" is not offered: lab orders carry no
 * report file in the app.
 */
export function LabOrderCard({ order }: { order: LabOrder }) {
  const details = [order.teeth && `Teeth: ${order.teeth}`, order.stage && `Stage: ${order.stage}`, order.due && `Expected: ${fmtDate(order.due)}`].filter(Boolean).join(' | ')
  return (
    <View testID="lab-order" style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.meta}>Case ID: {order.code}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text style={styles.title}>{order.caseType || 'Lab work'}</Text>
      {!!details && <Text style={styles.meta}>{details}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 4, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 0.5, borderColor: '#e5e7eb', backgroundColor: '#ffffff',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  meta: { fontFamily: 'Roboto-Regular', fontSize: 11, lineHeight: 16, color: '#6b7280' },
  title: { fontFamily: 'Roboto-Bold', fontSize: 14, lineHeight: 21, color: '#111827' },
})

import { fmtINR, space } from '@dentor/shared'
import { StyleSheet, Text, View } from 'react-native'

/**
 * "Total Paid" and "Total Pending", as in the design (frame "Payments" 92:405): two 133 x 41
 * boxes, radius 10, outlined #aca4a4; the first filled #47b5be with a white label, the second
 * white with a #1d8992 label; amounts bold 18 in black.
 */
export function MoneySummary({ paid, outstanding }: { paid: number; outstanding: number }) {
  return (
    <View testID="money-summary" style={styles.row}>
      <Figure label="Total Paid" value={paid} filled testID="summary-paid" />
      <Figure label="Total Pending" value={outstanding} testID="summary-outstanding" />
    </View>
  )
}

function Figure({ label, value, filled, testID }: { label: string; value: number; filled?: boolean; testID: string }) {
  return (
    <View style={[styles.box, filled && styles.filled]}>
      <Text style={[styles.label, { color: filled ? '#ffffff' : '#1d8992' }]}>{label}</Text>
      <Text testID={testID} numberOfLines={1} style={styles.amount}>{fmtINR(value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 15 },
  box: { flex: 1, maxWidth: 160, minHeight: 41, paddingVertical: 4, paddingHorizontal: space.sm, borderRadius: 10, borderWidth: 1, borderColor: '#aca4a4', backgroundColor: '#ffffff', alignItems: 'center' },
  filled: { backgroundColor: '#47b5be' },
  label: { fontFamily: 'NotoSans-Bold', fontSize: 14, lineHeight: 17 },
  amount: { fontFamily: 'NotoSans-Bold', fontSize: 18, lineHeight: 22, color: '#000000' },
})

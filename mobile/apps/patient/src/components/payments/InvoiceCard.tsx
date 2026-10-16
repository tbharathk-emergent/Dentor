import { StatusBadge, fmtDate, fmtINR, space } from '@dentor/shared'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Invoice } from '@/types'

/**
 * A bill as the design shows it (frame "Payments" 92:405): white card, radius 10, outlined
 * #aca4a4; the treatment in #1d8992 bold 16, "Invoice ID" and "Date" in 16, the amount bold 18
 * on the right with the status above it, and a small "View" button. The design's "Download"
 * is not offered: the app has no invoice file to download yet.
 */
export function InvoiceCard({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  return (
    <Pressable testID={`invoice-card-${invoice.id}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.left}>
        <Text numberOfLines={1} style={styles.title}>{invoice.treatment || 'Invoice'}</Text>
        <Text numberOfLines={1} style={styles.line}>Invoice ID: {invoice.number}</Text>
        <Text numberOfLines={1} style={styles.line}>Date: {fmtDate(invoice.date)}</Text>
      </View>
      <View style={styles.right}>
        <StatusBadge status={invoice.status} />
        <Text style={styles.amount}>{fmtINR(invoice.total)}</Text>
        {invoice.balance > 0 && <Text style={styles.due}>{fmtINR(invoice.balance)} to pay</Text>}
        <View style={styles.view}>
          <Text style={styles.viewText}>View</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // design: a #47b5be stripe down the left edge
  card: { flexDirection: 'row', gap: space.md, padding: space.md, paddingLeft: 14, borderRadius: 10, borderWidth: 1, borderLeftWidth: 8, borderColor: '#aca4a4', borderLeftColor: '#47b5be', backgroundColor: '#ffffff' },
  left: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  title: { fontFamily: 'NotoSans-Bold', fontSize: 16, lineHeight: 21, color: '#1d8992' },
  line: { fontFamily: 'NotoSans-Regular', fontSize: 15, lineHeight: 21, color: '#000000' },
  amount: { fontFamily: 'NotoSans-Bold', fontSize: 18, lineHeight: 22, color: '#000000' },
  due: { fontFamily: 'NotoSans-SemiBold', fontSize: 12, lineHeight: 16, color: '#bb4d00' },
  view: { minHeight: 18, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#1d8992', justifyContent: 'center' },
  viewText: { fontFamily: 'NotoSans-Medium', fontSize: 12, lineHeight: 16, color: '#ffffff' },
})

import { Card, StatusBadge, T, colors, fmtDate, fmtINR, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { ClinicalItem } from '@/types'

/** A treatment or a procedure on the patient's record. */
export function ClinicalItemCard({ item, testID }: { item: ClinicalItem; testID?: string }) {
  // "46" reads better as "Tooth 46"; "Full mouth" or "Upper arch" already say what they are.
  const where = /^\d/.test(item.tooth) ? `Tooth ${item.tooth}` : item.tooth
  const facts = [where, item.doctor, fmtDate(item.date)].filter(Boolean).join(' · ')
  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.head}>
        <T variant="bodyStrong" style={styles.name}>{item.name}</T>
        <StatusBadge status={item.status} />
      </View>
      <T variant="small" color={colors.textMuted}>{facts}</T>
      {!!item.notes && <T variant="small">{item.notes}</T>}
      {item.cost > 0 && <T variant="smallStrong" color={colors.brand800}>{fmtINR(item.cost)}</T>}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  name: { flex: 1 },
})

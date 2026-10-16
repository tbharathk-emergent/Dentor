import { Card, Icon, IconTile, T, colors, fmtDate, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { Prescription } from '@/types'

/** A prescription in the list: what it was for, who wrote it and how many medicines it has. */
export function PrescriptionCard({ prescription, onPress }: { prescription: Prescription; onPress: () => void }) {
  const count = prescription.meds.length
  return (
    <Card testID={`prescription-card-${prescription.id}`} onPress={onPress} style={styles.card}>
      <IconTile icon="file-text" />
      <View style={styles.body}>
        <T variant="bodyStrong" numberOfLines={2}>{prescription.diagnosis || 'Prescription'}</T>
        <T variant="small" color={colors.textMuted} numberOfLines={1}>{prescription.doctor} · {fmtDate(prescription.date)}</T>
        <T variant="small" color={colors.textMuted}>
          {prescription.code} · {count} {count === 1 ? 'medicine' : 'medicines'}
        </T>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textFaint} />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { flex: 1, minWidth: 0, gap: 2 },
})

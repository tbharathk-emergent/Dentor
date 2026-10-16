import { colors, font, radius, space } from '@dentor/shared'
import { StyleSheet, Text, View } from 'react-native'

export interface Stat {
  key: string
  label: string
  value: number
}

/** Compact counters for the brand-coloured header: four across, even on a small phone. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View key={s.key} testID={`stat-${s.key}`} accessibilityLabel={`${s.label}: ${s.value}`} style={styles.tile}>
          <Text testID={`stat-${s.key}-value`} numberOfLines={1} style={[font.h2, { color: colors.onBrand }]}>{s.value}</Text>
          <Text numberOfLines={1} style={[font.tiny, { color: colors.brand100 }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: 2, borderRadius: radius.md, backgroundColor: colors.brand800 },
})

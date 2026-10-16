import { StyleSheet, Text, View } from 'react-native'

export interface Stat {
  key: string
  label: string
  value: number
  dot?: string
}

/**
 * Today's figures as the design draws them (Consultant "Home" 6933:11981): two large tiles
 * (the first #f3f2f2 with #0a338e text, the second #0a338e with #fdc500 text) over two small
 * ones with a coloured dot, all radius 6 with a #b3b3b3 outline, in Radio Canada Bold.
 * The labels are the app's own figures for today.
 */
export function ScheduleTiles({ big, small }: { big: [Stat, Stat]; small: [Stat, Stat] }) {
  return (
    <View testID="schedule-tiles" style={styles.frame}>
      <View style={styles.row}>
        {big.map((s, i) => (
          <View key={s.key} testID={`stat-${s.key}`} accessibilityLabel={`${s.label}: ${s.value}`} style={[styles.tile, styles.big, i === 1 && styles.dark]}>
            <Text numberOfLines={2} style={[styles.label, i === 1 && styles.gold]}>{s.label}</Text>
            <Text testID={`stat-${s.key}-value`} numberOfLines={1} style={[styles.bigValue, i === 1 && styles.gold]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {small.map((s) => (
          <View key={s.key} testID={`stat-${s.key}`} accessibilityLabel={`${s.label}: ${s.value}`} style={styles.tile}>
            <View style={styles.smallHead}>
              <Text numberOfLines={1} style={styles.smallLabel}>{s.label}</Text>
              {!!s.dot && <View style={[styles.dot, { backgroundColor: s.dot }]} />}
            </View>
            <Text testID={`stat-${s.key}-value`} numberOfLines={1} style={styles.smallValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { gap: 10, padding: 11, borderRadius: 6, borderWidth: 1, borderColor: '#b3b3b3', backgroundColor: 'rgba(255,255,255,0.6)' },
  row: { flexDirection: 'row', gap: 16 },
  tile: {
    flex: 1, minWidth: 0, padding: 10, borderRadius: 6, borderWidth: 0.5, borderColor: '#b3b3b3', backgroundColor: '#f3f2f2',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  big: { minHeight: 126, alignItems: 'center', justifyContent: 'center' },
  dark: { backgroundColor: '#0a338e' },
  label: { fontFamily: 'RadioCanada-Bold', fontSize: 16, lineHeight: 20, color: '#0a338e', textAlign: 'center' },
  gold: { color: '#fdc500' },
  bigValue: { fontFamily: 'RadioCanada-Bold', fontSize: 52, lineHeight: 62, color: '#0a338e' },
  smallHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  smallLabel: { flexShrink: 1, fontFamily: 'RadioCanada-Bold', fontSize: 14, lineHeight: 18, color: '#0a338e' },
  dot: { width: 19, height: 19, borderRadius: 10 },
  smallValue: { fontFamily: 'RadioCanada-Bold', fontSize: 35, lineHeight: 42, color: '#0a338e' },
})

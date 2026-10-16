import { T, colors, fmtDate, space } from '@dentor/shared'
import { StyleSheet, Text, View } from 'react-native'
import { fmtMoney } from '@/lib/format'
import type { Overview } from '@/types'

/**
 * Today at a glance, whatever period is chosen below it, in the Clinic design's count tiles
 * (dentor.fig "Home after flip" 6973:7983): a white panel, radius 15, holding tiles with a
 * #ff0303 label band (radius 13) over a white box with the figure. The figures are the app's
 * own for today. Dashes stand in until they arrive so the panel does not change height.
 */
export function TodayStrip({ date, summary }: { date?: string; summary?: Overview['today_summary'] }) {
  const cells = [
    { key: 'appointments', label: 'Booked', value: summary ? String(summary.appointments) : '–' },
    { key: 'waiting', label: 'Waiting', value: summary ? String(summary.waiting) : '–' },
    { key: 'completed', label: 'Completed', value: summary ? String(summary.completed) : '–' },
    { key: 'collected', label: 'Collected', value: summary ? fmtMoney(summary.collected) : '–' },
  ]
  return (
    <View testID="today-strip" style={styles.panel}>
      <T variant="tiny" color={colors.textMuted} numberOfLines={1}>
        {date ? `TODAY · ${fmtDate(date).toUpperCase()}` : 'TODAY'}
      </T>
      <View style={styles.cells}>
        {cells.map((cell) => (
          <View key={cell.key} style={[styles.cell, cell.key === 'collected' && { flex: 1.5 }]}>
            <View style={styles.band}>
              <Text numberOfLines={1} style={styles.label}>{cell.label}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value} testID={`today-strip-${cell.key}`}>{cell.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm, padding: space.sm, borderRadius: 15, borderWidth: 1, borderColor: '#cccccc', backgroundColor: '#ffffff',
  },
  cells: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, minWidth: 0, borderRadius: 13, borderWidth: 1, borderColor: '#cccbcb', backgroundColor: '#ffffff', overflow: 'hidden',
  },
  band: { minHeight: 29, backgroundColor: '#ff0303', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  label: { fontFamily: 'NotoSans-SemiBold', fontSize: 11, lineHeight: 14, color: '#ffffff' },
  value: { fontFamily: 'NotoSans-Bold', fontSize: 22, lineHeight: 34, color: '#000000', textAlign: 'center', paddingHorizontal: 2 },
})

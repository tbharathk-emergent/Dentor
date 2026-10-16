import { Card, T, colors, radius, space, toothLook } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { CONDITIONS, HEALTHY, QUADRANTS } from '@/lib/teeth'
import type { ToothState } from '@/types'

/** Fill, border and text colour of a tooth (or a legend swatch): the reception app's, from the shared theme. */
function lookOf(condition: string): { box: ViewStyle; text: string } {
  // A condition this version does not know is drawn like a healthy tooth; its name still shows when tapped.
  const look = toothLook(condition) ?? toothLook(HEALTHY)!
  return { box: { backgroundColor: look.bg, borderColor: look.border, borderStyle: look.dashed ? 'dashed' : 'solid' }, text: look.fg }
}

/**
 * The 32 adult teeth (FDI numbers) in four quadrants, coloured by what the dentist charted.
 * Tapping a tooth shows its condition and note under the chart.
 */
export function DentalChart({ teeth }: { teeth: Record<string, ToothState> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const state = selected === null ? undefined : teeth[String(selected)]
  const condition = state?.condition || HEALTHY

  return (
    <View style={styles.wrap}>
      <Card testID="dental-chart" style={styles.chart}>
        <View style={styles.quadrants}>
          {QUADRANTS.map((quadrant) => (
            <View key={quadrant.key} style={styles.quadrant}>
              <T variant="tiny" color={colors.textMuted}>
                {quadrant.label} · {quadrant.teeth[0]}–{quadrant.teeth[quadrant.teeth.length - 1]}
              </T>
              <View style={styles.row}>
                {quadrant.teeth.map((tooth) => {
                  const charted = teeth[String(tooth)]?.condition || HEALTHY
                  const look = lookOf(charted)
                  return (
                    <Pressable
                      key={tooth}
                      testID={`tooth-${tooth}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Tooth ${tooth}, ${charted}`}
                      accessibilityState={{ selected: tooth === selected }}
                      hitSlop={4}
                      onPress={() => setSelected(tooth)}
                      style={[styles.tooth, look.box, tooth === selected && styles.toothOn]}
                    >
                      <T variant="tiny" color={look.text}>{tooth}</T>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          {CONDITIONS.map((name) => (
            <View key={name} style={styles.legendItem}>
              <View style={[styles.swatch, lookOf(name).box]} />
              <T variant="tiny" color={colors.textMuted}>{name}</T>
            </View>
          ))}
        </View>
      </Card>

      <Card testID="chart-detail" style={styles.detail}>
        {selected === null ? (
          <T variant="small" color={colors.textMuted}>Tap a tooth to see what your dentist recorded for it.</T>
        ) : (
          <>
            <T variant="tiny" color={colors.textMuted}>TOOTH {selected}</T>
            <T variant="h3" testID="chart-condition">{condition}</T>
            <T variant="small" color={colors.textMuted} testID="chart-note">
              {state?.note || (state ? 'No note recorded for this tooth.' : 'Nothing has been charted for this tooth.')}
            </T>
          </>
        )}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chart: { gap: space.lg },
  // Two quadrants side by side when there is room (upper right | upper left, as on a chart).
  quadrants: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.md },
  quadrant: { flexGrow: 1, flexBasis: 240, gap: space.xs },
  row: { flexDirection: 'row', gap: space.xs },
  tooth: { flex: 1, height: 44, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toothOn: { borderWidth: 2, borderColor: colors.brand700, borderStyle: 'solid' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  detail: { gap: 2 },
})

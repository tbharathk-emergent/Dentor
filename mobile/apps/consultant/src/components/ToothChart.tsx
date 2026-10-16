import { Card, colors, font, radius, space, T, TOOTH_CONDITIONS, toothLook, type ToothLook } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { ToothState } from '@/types'

/** The conditions and their colours are the reception web app's (shared theme). */
const CONDITIONS = TOOTH_CONDITIONS.map((name) => ({ name: name as string, look: toothLook(name)! }))
/** A condition the list does not know (recorded by a newer version of the reception app). */
const OTHER: ToothLook = { bg: colors.brand50, fg: colors.brand800, border: colors.brand600 }
const lookOf = (condition: string) => toothLook(condition) ?? OTHER

const range = (from: number, to: number) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from < to ? from + i : from - i))

/** FDI numbering, in the order the teeth appear when you look at the patient. */
const QUADRANTS = [
  { label: 'Upper right', teeth: range(18, 11) },
  { label: 'Upper left', teeth: range(21, 28) },
  { label: 'Lower right', teeth: range(48, 41) },
  { label: 'Lower left', teeth: range(31, 38) },
]

/** Two quadrants side by side need about this much room for comfortable tooth buttons. */
const SIDE_BY_SIDE_FROM = 600

/**
 * The 32 permanent teeth, coloured by recorded condition. Tap a tooth to read its note.
 * Teeth the clinic has not charted are healthy.
 */
export function ToothChart({ teeth }: { teeth: Record<string, ToothState> }) {
  const { width } = useWindowDimensions()
  const [selected, setSelected] = useState<number | null>(null)
  const stateOf = (tooth: number): ToothState => teeth[String(tooth)] ?? { condition: 'Healthy' }
  const picked = selected === null ? null : stateOf(selected)
  const charted = Object.keys(teeth).length
  const hasOther = Object.values(teeth).some((t) => !CONDITIONS.some((c) => c.name === t.condition))

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ gap: space.lg }}>
        <T variant="small" color={colors.textMuted} testID="chart-summary">
          {charted === 0 ? 'Nothing is charted yet: every tooth is recorded as healthy.' : `${charted} of 32 teeth have a recorded condition. Tap a tooth to read its note.`}
        </T>
        <View style={styles.quadrants}>
          {QUADRANTS.map((q) => (
            <View key={q.label} style={[styles.quadrant, { flexBasis: width >= SIDE_BY_SIDE_FROM ? '47%' : '100%' }]}>
              <T variant="tiny" color={colors.textMuted}>{`${q.label.toUpperCase()} · ${q.teeth[0]}–${q.teeth[7]}`}</T>
              <View style={styles.teeth}>
                {q.teeth.map((tooth) => {
                  const state = stateOf(tooth)
                  const look = lookOf(state.condition)
                  const on = tooth === selected
                  return (
                    <Pressable
                      key={tooth}
                      testID={`tooth-${tooth}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Tooth ${tooth}, ${state.condition}`}
                      accessibilityState={{ selected: on }}
                      onPress={() => setSelected(on ? null : tooth)}
                      style={[
                        styles.tooth,
                        { backgroundColor: look.bg, borderColor: look.border },
                        look.dashed && { borderStyle: 'dashed' },
                        on && styles.toothOn,
                      ]}
                    >
                      <Text style={[font.tiny, { color: look.fg }]}>{tooth}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
        </View>

        <View testID="tooth-note" style={styles.note}>
          {selected === null || !picked ? (
            <T variant="small" color={colors.textMuted}>Tap a tooth to see its condition and note.</T>
          ) : (
            <>
              <T variant="bodyStrong">{`Tooth ${selected} · ${picked.condition}`}</T>
              <T variant="small" color={colors.textMuted}>{picked.note?.trim() || 'No note recorded for this tooth.'}</T>
            </>
          )}
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <T variant="smallStrong">Legend</T>
        <View style={styles.legend}>
          {[...CONDITIONS, ...(hasOther ? [{ name: 'Other', look: OTHER }] : [])].map((c) => (
            <View key={c.name} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: c.look.bg, borderColor: c.look.border }, c.look.dashed && { borderStyle: 'dashed' }]} />
              <T variant="small">{c.name}</T>
            </View>
          ))}
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  quadrants: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  quadrant: { flexGrow: 0, gap: space.sm },
  teeth: { flexDirection: 'row', gap: space.xs },
  tooth: { flex: 1, minWidth: 0, height: 44, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  toothOn: { borderWidth: 3, borderColor: colors.brand700, borderStyle: 'solid' },
  note: { gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.slateBg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5 },
})

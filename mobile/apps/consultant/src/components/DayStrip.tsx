import { addDays, Chip, colors, fmtDayShort, font, IconButton, radius, space, T } from '@dentor/shared'
import { type ComponentRef, useCallback, useEffect, useMemo, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { rangeLabel } from '@/lib/dates'

const DAYS_SHOWN = 14
const CELL_WIDTH = 52
const CELL_GAP = space.sm

/**
 * Two weeks of days to pick from, with week-by-week paging and a jump back to today.
 * A dot marks the days that have appointments.
 */
export function DayStrip({
  start,
  selected,
  today,
  counts,
  onSelect,
  onShiftWeek,
  onToday,
}: {
  /** First day shown (yyyy-mm-dd). */
  start: string
  selected: string
  today: string
  /** Appointments per day, for the markers. */
  counts: Record<string, number>
  onSelect: (date: string) => void
  onShiftWeek: (weeks: -1 | 1) => void
  onToday: () => void
}) {
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(start, i)), [start])
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)

  // Keep the selected day in view (it may be in the second week).
  const reveal = useCallback(() => {
    const index = days.indexOf(selected)
    if (index >= 0) scroller.current?.scrollTo({ x: Math.max(0, (index - 2) * (CELL_WIDTH + CELL_GAP)), animated: false })
  }, [days, selected])
  useEffect(reveal, [reveal])

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <T variant="smallStrong" numberOfLines={2} style={styles.range} testID="week-range">
          {rangeLabel(days[0], days[DAYS_SHOWN - 1])}
        </T>
        <IconButton testID="week-prev" icon="chevron-left" label="Previous week" onPress={() => onShiftWeek(-1)} />
        <IconButton testID="week-next" icon="chevron-right" label="Next week" onPress={() => onShiftWeek(1)} />
        <Chip testID="week-today" label="Today" selected={selected === today} onPress={onToday} />
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={reveal}
        contentContainerStyle={styles.days}
      >
        {days.map((day) => {
          const { dow, day: number } = fmtDayShort(day)
          const on = day === selected
          const count = counts[day] ?? 0
          return (
            <Pressable
              key={day}
              testID={`day-${day}`}
              accessibilityRole="button"
              accessibilityLabel={`${dow} ${number}, ${count} appointment${count === 1 ? '' : 's'}`}
              accessibilityState={{ selected: on }}
              onPress={() => onSelect(day)}
              style={[styles.cell, day === today && styles.today, on && styles.cellOn]}
            >
              <Text style={[font.tiny, { color: on ? colors.brand100 : colors.textMuted }]}>{dow.toUpperCase()}</Text>
              <Text style={[font.h3, { color: on ? colors.onBrand : colors.text }]}>{number}</Text>
              <View style={[styles.dot, count > 0 && { backgroundColor: on ? colors.onBrand : colors.brand600 }]} />
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  range: { flex: 1, minWidth: 0 },
  days: { gap: CELL_GAP, paddingVertical: 2 },
  cell: {
    width: CELL_WIDTH, minHeight: 68, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  today: { borderColor: colors.brand600 },
  cellOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
})

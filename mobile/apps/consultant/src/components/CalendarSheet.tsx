import { colors, font, IconButton, parseISODate, radius, Sheet, space, T, toISODate } from '@dentor/shared'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MONTHS_LONG } from '@/lib/dates'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Month-by-month date picker in a bottom sheet. Picking a day closes it. */
export function CalendarSheet({
  visible,
  onClose,
  title,
  value,
  today,
  minDate,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  title: string
  /** Selected day (yyyy-mm-dd) or ''. */
  value: string
  today: string
  /** Days before this one cannot be picked. */
  minDate?: string
  onPick: (date: string) => void
}) {
  const [month, setMonth] = useState(() => firstOfMonth(value || today))
  // Each time the sheet opens, show the month of the current value.
  useEffect(() => {
    if (visible) setMonth(firstOfMonth(value || today))
  }, [visible, value, today])

  const cells = useMemo(() => {
    const first = parseISODate(month)
    const lead = (first.getDay() + 6) % 7 // Monday-first offset
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const days: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= count; d += 1) days.push(toISODate(new Date(first.getFullYear(), first.getMonth(), d)))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [month])

  const shift = (months: number) => {
    const d = parseISODate(month)
    setMonth(toISODate(new Date(d.getFullYear(), d.getMonth() + months, 1)))
  }
  const shown = parseISODate(month)
  const canGoBack = !minDate || month > firstOfMonth(minDate)

  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="calendar-sheet">
      <View style={styles.bar}>
        <View style={!canGoBack && { opacity: 0.3 }}>
          <IconButton testID="calendar-prev" icon="chevron-left" label="Previous month" onPress={() => canGoBack && shift(-1)} />
        </View>
        <T variant="h3" center style={{ flex: 1 }} testID="calendar-month">{`${MONTHS_LONG[shown.getMonth()]} ${shown.getFullYear()}`}</T>
        <IconButton testID="calendar-next" icon="chevron-right" label="Next month" onPress={() => shift(1)} />
      </View>
      <View>
        <View style={styles.week}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={[font.tiny, styles.weekday]}>{d}</Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={styles.week}>
            {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />
              const off = !!minDate && day < minDate
              const on = day === value
              return (
                <Pressable
                  key={day}
                  testID={`calendar-day-${day}`}
                  accessibilityRole="button"
                  accessibilityLabel={day}
                  accessibilityState={{ selected: on, disabled: off }}
                  disabled={off}
                  onPress={() => {
                    onPick(day)
                    onClose()
                  }}
                  style={[styles.cell, styles.day, day === today && styles.today, on && styles.dayOn, off && { opacity: 0.3 }]}
                >
                  <Text style={[font.bodyStrong, { color: on ? colors.onBrand : colors.text }]}>{parseISODate(day).getDate()}</Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </Sheet>
  )
}

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  week: { flexDirection: 'row', gap: space.xs, marginBottom: space.xs },
  weekday: { flex: 1, textAlign: 'center', color: colors.textMuted },
  cell: { flex: 1, height: 44 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  today: { borderColor: colors.brand600 },
  dayOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})

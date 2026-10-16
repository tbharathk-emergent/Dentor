import { T, colors, fmtDayShort, radius, space } from '@dentor/shared'
import { Pressable, ScrollView, StyleSheet } from 'react-native'

/** A row of days to swipe through; the chosen one is filled in the brand colour. */
export function DateStrip({ dates, value, onChange }: { dates: string[]; value: string; onChange: (date: string) => void }) {
  return (
    <ScrollView
      testID="day-strip"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      {dates.map((date, index) => {
        const { dow, day, month } = fmtDayShort(date)
        const on = date === value
        const tint = on ? colors.onBrand : colors.textMuted
        return (
          <Pressable
            key={date}
            testID={`date-${date}`}
            accessibilityRole="button"
            accessibilityLabel={`${dow} ${day} ${month}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(date)}
            style={[styles.day, on && styles.dayOn]}
          >
            <T variant="tiny" color={tint}>{index === 0 ? 'Today' : dow}</T>
            <T variant="h2" color={on ? colors.onBrand : colors.text}>{day}</T>
            <T variant="tiny" color={tint}>{month}</T>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so half-visible days hint that the row scrolls.
  strip: { flexGrow: 0, marginHorizontal: -space.lg },
  content: { gap: space.sm, paddingHorizontal: space.lg },
  day: {
    width: 62, paddingVertical: space.sm, alignItems: 'center', gap: 2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  dayOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})

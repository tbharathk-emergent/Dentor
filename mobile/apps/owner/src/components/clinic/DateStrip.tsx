import { T, colors, fmtDayShort, radius, space } from '@dentor/shared'
import { Pressable, ScrollView, StyleSheet } from 'react-native'

/** The design's "Select Date" row (dentor.fig 7970:3530): days to swipe through, the chosen one filled. */
export function DateStrip({ dates, value, onChange, today }: { dates: string[]; value: string; onChange: (date: string) => void; today?: string }) {
  return (
    <ScrollView testID="day-strip" horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.content}>
      {dates.map((date) => {
        const { dow, day, month } = fmtDayShort(date)
        const on = date === value
        const tint = on ? '#ffffff' : colors.textMuted
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
            <T variant="tiny" color={tint}>{date === today ? 'Today' : dow}</T>
            <T variant="h2" color={on ? '#ffffff' : colors.text}>{day}</T>
            <T variant="tiny" color={tint}>{month}</T>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, marginHorizontal: -space.lg },
  content: { gap: space.sm, paddingHorizontal: space.lg },
  day: { width: 58, paddingVertical: space.sm, alignItems: 'center', gap: 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dayOn: { backgroundColor: colors.header, borderColor: colors.header },
})

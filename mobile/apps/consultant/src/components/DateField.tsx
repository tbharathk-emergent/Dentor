import { colors, fmtDate, font, Icon, radius, space, T } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarSheet } from './CalendarSheet'

/** A date shown as "13 Oct 2026"; tapping it opens a calendar. Optional dates can be cleared. */
export function DateField({
  label,
  value,
  onChange,
  today,
  minDate,
  placeholder = 'Choose a date',
  error,
  required,
  clearable,
  testID,
}: {
  label: string
  /** yyyy-mm-dd, or '' when no date is set. */
  value: string
  onChange: (date: string) => void
  today: string
  minDate?: string
  placeholder?: string
  error?: string
  required?: boolean
  clearable?: boolean
  testID: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text style={[font.smallStrong, { color: colors.text }]}>
        {label}
        {required && <Text style={{ color: colors.red }}> *</Text>}
      </Text>
      <View style={styles.row}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? fmtDate(value) : 'not set'}. Tap to choose a date.`}
          onPress={() => setOpen(true)}
          style={[styles.field, !!error && { borderColor: colors.red }]}
        >
          <Icon name="calendar" size={18} color={colors.textFaint} />
          <Text testID={`${testID}-value`} numberOfLines={1} style={[styles.value, !value && { color: colors.textFaint }]}>
            {value ? fmtDate(value) : placeholder}
          </Text>
        </Pressable>
        {clearable && !!value && (
          <Pressable
            testID={`${testID}-clear`}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            onPress={() => onChange('')}
            style={styles.clear}
          >
            <Icon name="x" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {!!error && <T variant="small" color={colors.red}>{error}</T>}
      <CalendarSheet visible={open} onClose={() => setOpen(false)} title={label} value={value} today={today} minDate={minDate} onPick={onChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.md,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface,
  },
  value: { ...font.body, flex: 1, minWidth: 0, color: colors.text },
  clear: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
})

import { T, colors, radius, space } from '@dentor/shared'
import { Pressable, ScrollView, StyleSheet } from 'react-native'

/**
 * Section switcher for four or more sections: pills in a row that scrolls sideways on small
 * phones, so labels are never cut short. (The kit's `Segmented` suits two or three.)
 */
export function SegmentTabs<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.content}>
      {options.map((option) => {
        const on = option.key === value
        return (
          <Pressable
            key={option.key}
            testID={`segment-${option.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            style={[styles.pill, on && styles.pillOn]}
          >
            <T variant="smallStrong" color={on ? colors.onBrand : colors.textMuted}>{option.label}</T>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, marginHorizontal: -space.lg },
  content: { gap: space.sm, paddingHorizontal: space.lg },
  pill: {
    minHeight: 40, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pillOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})

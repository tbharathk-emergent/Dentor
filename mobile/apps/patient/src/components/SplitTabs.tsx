import { space } from '@dentor/shared'
import { Pressable, StyleSheet, Text, View } from 'react-native'

/**
 * Two or three side-by-side choices as the design draws them (frame "upcoming" 76:2423):
 * separate buttons, radius 10, the chosen one #007ba4 with white text, the others white,
 * bold 13. Each option gets the testID `segment-<key>`, like the shared Segmented control.
 */
export function SplitTabs<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (key: K) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((option) => {
        const on = option.key === value
        return (
          <Pressable
            key={option.key}
            testID={`segment-${option.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            style={[styles.option, on && styles.on]}
          >
            <Text style={[styles.label, { color: on ? '#ffffff' : '#000000' }]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  option: {
    flex: 1, minHeight: 34, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#000000', backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm,
  },
  on: { backgroundColor: '#007ba4' },
  label: { fontFamily: 'NotoSans-Bold', fontSize: 13, lineHeight: 18 },
})

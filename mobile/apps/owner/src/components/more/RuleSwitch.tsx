import { T, colors, radius, space, TOUCH } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { ClinicRule } from '@/lib/rules'

/**
 * One clinic rule as a switch. The whole row is the control, so the touch target is the row
 * and not the small track. The label under the track reads On, Off or Saving….
 */
export function RuleSwitch({
  rule,
  on,
  saving,
  disabled,
  onToggle,
}: {
  rule: ClinicRule
  on: boolean
  saving: boolean
  disabled: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <Pressable
      testID={`rule-${rule.key}`}
      accessibilityRole="switch"
      accessibilityLabel={rule.title}
      accessibilityHint={rule.description}
      accessibilityState={{ checked: on, disabled, busy: saving }}
      disabled={disabled}
      onPress={() => onToggle(!on)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.slateBg }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T variant="bodyStrong">{rule.title}</T>
        <T variant="small" color={colors.textMuted}>
          {rule.description}
        </T>
      </View>
      <View style={styles.control}>
        <View style={[styles.track, on && styles.trackOn]}>
          <View style={styles.thumb} />
        </View>
        <T variant="tiny" color={on && !saving ? colors.brand700 : colors.textMuted} numberOfLines={1} testID={`rule-${rule.key}-state`}>
          {saving ? 'Saving…' : on ? 'On' : 'Off'}
        </T>
      </View>
    </Pressable>
  )
}

const TRACK_WIDTH = 46
const THUMB = 22
const INSET = 3

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + space.lg, paddingVertical: space.md, paddingHorizontal: space.lg },
  control: { width: 56, alignItems: 'center', gap: 4 },
  track: { width: TRACK_WIDTH, height: THUMB + INSET * 2, padding: INSET, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignItems: 'flex-start' },
  trackOn: { backgroundColor: colors.brand600, alignItems: 'flex-end' },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: colors.surface },
})

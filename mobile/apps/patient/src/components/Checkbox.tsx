import { Icon, T, TOUCH, colors, radius, space } from '@dentor/shared'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

/** A tick box with its label; the whole row is the touch target. */
export function Checkbox({
  checked,
  onChange,
  children,
  error,
  testID,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** The label; may contain nested pressable text. */
  children: ReactNode
  error?: string
  testID?: string
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxOn, !!error && !checked && styles.boxError]}>
          {checked && <Icon name="check" size={16} color={colors.onBrand} />}
        </View>
        <T variant="small" color={colors.textMuted} style={styles.label}>{children}</T>
      </Pressable>
      {!!error && <T variant="small" color={colors.red}>{error}</T>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  box: {
    width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  boxError: { borderColor: colors.red },
  label: { flex: 1 },
})

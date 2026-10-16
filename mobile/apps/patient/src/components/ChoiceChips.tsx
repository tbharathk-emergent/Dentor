import { Chip, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'

/** Pick one of a few short options (gender, blood group, relation…). */
export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  error,
  required,
  clearable,
  testID,
}: {
  label?: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  /** Tapping the selected chip again clears the choice. */
  clearable?: boolean
  /** Each chip gets `${testID}-${option}`. */
  testID: string
}) {
  return (
    <View style={styles.wrap}>
      {!!label && (
        <T variant="smallStrong">
          {label}
          {required && <T variant="smallStrong" color={colors.red}> *</T>}
        </T>
      )}
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option}
            testID={`${testID}-${option}`}
            label={option}
            selected={option === value}
            onPress={() => onChange(clearable && option === value ? '' : option)}
          />
        ))}
      </View>
      {!!error && <T variant="small" color={colors.red}>{error}</T>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})

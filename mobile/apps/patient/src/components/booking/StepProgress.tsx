import { ProgressBar, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'

/** "Step 2 of 4" with a bar, so the patient knows how much is left. */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <T variant="h3" style={styles.label} testID="booking-step">{label}</T>
        <T variant="small" color={colors.textMuted}>Step {step} of {total}</T>
      </View>
      <ProgressBar value={step} max={total} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  text: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  label: { flex: 1 },
})

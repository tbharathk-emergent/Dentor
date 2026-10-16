import { colors, IconTile, radius, shadow, space, T, type IconName } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'

function ActionTile({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
      <IconTile icon={icon} size={40} />
      {/* Beside the icon where there is room for a whole word; under it on a small phone. */}
      <T variant="smallStrong" style={styles.label}>{label}</T>
    </Pressable>
  )
}

/** What a consultant does from a patient's record. */
export function PatientActions({ onPrescribe, onAddTreatment }: { onPrescribe: () => void; onAddTreatment: () => void }) {
  return (
    <View style={styles.row}>
      <ActionTile testID="write-prescription" icon="edit-3" label="Write prescription" onPress={onPrescribe} />
      <ActionTile testID="add-treatment" icon="plus-circle" label="Add treatment" onPress={onAddTreatment} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1, minWidth: 0, minHeight: 64, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, padding: space.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand200, backgroundColor: colors.surface, ...shadow,
  },
  // Wide enough for the longest word ("prescription"), so no word is ever split.
  label: { flexGrow: 1, flexShrink: 1, flexBasis: 96, color: colors.brand800 },
})

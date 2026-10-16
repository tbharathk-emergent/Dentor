import { Icon, IconTile, T, colors, radius, shadow, space } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { ClinicListing } from '@/types'

/** A clinic the patient can register with; tapping selects it. */
export function ClinicOption({ clinic, selected, onPress }: { clinic: ClinicListing; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={`clinic-option-${clinic.id}`}
      accessibilityRole="radio"
      accessibilityLabel={clinic.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardOn]}
    >
      <IconTile icon="map-pin" />
      <View style={styles.body}>
        <T variant="bodyStrong">{clinic.name}</T>
        <T variant="small" color={colors.textMuted}>{[clinic.city, clinic.code].filter(Boolean).join(' · ')}</T>
        {!!clinic.address && <T variant="small" color={colors.textMuted}>{clinic.address}</T>}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Icon name="check" size={14} color={colors.onBrand} />}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, ...shadow,
  },
  cardOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  radio: {
    width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})

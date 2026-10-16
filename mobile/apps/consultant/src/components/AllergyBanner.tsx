import { colors, Icon, radius, space, T } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'

/** Hard-to-miss allergy warning. Renders nothing when the patient has no recorded allergy. */
export function AllergyBanner({ allergy, testID = 'allergy-banner' }: { allergy?: string | null; testID?: string }) {
  const text = (allergy ?? '').trim()
  if (!text) return null
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLabel={`Allergy: ${text}`} style={styles.box}>
      <Icon name="alert-triangle" size={22} color={colors.onBrand} />
      <View style={styles.text}>
        <T variant="tiny" color={colors.onBrand} style={styles.caption}>ALLERGY</T>
        <T variant="bodyStrong" color={colors.onBrand}>{text}</T>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.red },
  text: { flex: 1, minWidth: 0 },
  caption: { letterSpacing: 0.8 },
})

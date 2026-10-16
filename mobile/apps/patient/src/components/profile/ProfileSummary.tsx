import { Avatar, Badge, T, colors, space } from '@dentor/shared'
import { StyleSheet, Text, View } from 'react-native'

/**
 * Who is signed in, centred as in the design (frame "Profile" 95:430): the photo (or
 * initials), the name in League Spartan SemiBold 24, then the patient code, mobile and clinic.
 */
export function ProfileSummary({
  name,
  code,
  photo,
  mobile,
  clinicName,
}: {
  name: string
  code: string
  photo?: string
  mobile?: string
  clinicName?: string
}) {
  return (
    <View testID="profile-summary" style={styles.wrap}>
      <Avatar name={name} uri={photo || undefined} size={91} />
      <Text testID="profile-name" numberOfLines={2} style={styles.name}>{name}</Text>
      <View style={styles.line}>
        <Badge testID="profile-code" label={code} tone="slate" />
        {!!mobile && <T variant="small" color={colors.textMuted}>+91 {mobile}</T>}
      </View>
      {!!clinicName && <T variant="small" color={colors.textMuted} numberOfLines={1}>{clinicName}</T>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  name: { fontFamily: 'LeagueSpartan-SemiBold', fontSize: 24, lineHeight: 28, color: '#000000', textAlign: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
})

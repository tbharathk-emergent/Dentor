import { Avatar, Badge, Button, Card, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { Profile } from '@/types'

/** One patient record on this mobile number: the active one is marked, the others can be switched to. */
export function ProfileRow({
  profile,
  active,
  switching,
  disabled,
  onSwitch,
}: {
  profile: Profile
  active: boolean
  /** The switch to this profile is in progress. */
  switching: boolean
  /** Another switch is in progress. */
  disabled: boolean
  onSwitch: () => void
}) {
  const facts = [profile.code, profile.age ? `${profile.age} yrs` : '', profile.gender].filter(Boolean).join(' · ')
  return (
    <Card testID={`profile-row-${profile.code}`} style={styles.card}>
      <Avatar name={profile.name} uri={profile.photo || undefined} size={48} />
      <View style={styles.body}>
        <T variant="bodyStrong" numberOfLines={1}>{profile.name}</T>
        <T variant="small" color={colors.textMuted} numberOfLines={1}>{facts}</T>
        <T variant="small" color={colors.textMuted} numberOfLines={1}>{profile.clinic_name}</T>
      </View>
      {active ? (
        <Badge testID="profile-active" label="In use" tone="green" />
      ) : (
        <Button testID={`profile-switch-${profile.code}`} label="Switch" variant="secondary" size="sm" loading={switching} disabled={disabled} onPress={onSwitch} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { flex: 1, minWidth: 0, gap: 2 },
})

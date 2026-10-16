import { Avatar, Card, colors, Divider, Icon, space, T } from '@dentor/shared'
import { View } from 'react-native'
import { dotJoin } from '@/lib/people'
import type { ProfileResponse } from '@/types'

/** Who is signed in and where they practise. */
export function ProfileCard({ profile, clinic }: ProfileResponse) {
  const years = Number(profile.experience)
  return (
    <Card testID="profile-card" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={profile.name} size={60} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="h2" numberOfLines={2} testID="profile-name">{profile.name}</T>
          <T variant="small" color={colors.textMuted} testID="profile-specialty">{profile.specialty || 'Consultant'}</T>
          <T variant="small" color={colors.textMuted} testID="profile-credentials">
            {dotJoin(profile.credentials, years > 0 && `${years} years' experience`)}
          </T>
        </View>
      </View>
      <Divider />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Icon name="map-pin" size={18} color={colors.brand700} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="bodyStrong" testID="profile-clinic">{clinic.name || 'Clinic'}</T>
          {!!clinic.address && <T variant="small" color={colors.textMuted}>{clinic.address}</T>}
          {!!clinic.phone && <T variant="small" color={colors.textMuted}>{clinic.phone}</T>}
        </View>
      </View>
    </Card>
  )
}

import { QueryState, Screen } from '@dentor/shared'
import { ProfileForm } from '@/components/ProfileForm'
import { useProfile } from '@/hooks/useProfile'

export default function EditProfileScreen() {
  const me = useProfile()
  if (me.data) return <ProfileForm profile={me.data.profile} />
  return (
    <Screen testID="screen-edit-profile" title="Edit details" back>
      <QueryState query={me}>{() => null}</QueryState>
    </Screen>
  )
}

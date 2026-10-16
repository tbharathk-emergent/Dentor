import { QueryState, Screen } from '@dentor/shared'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { useMe } from '@/hooks/useMe'

export default function EditProfile() {
  const me = useMe()
  if (me.data) return <ProfileForm me={me.data} />
  return (
    <Screen testID="edit-profile-screen" title="Edit profile" back>
      <QueryState query={me}>{() => null}</QueryState>
    </Screen>
  )
}

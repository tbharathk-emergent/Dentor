import { ConfirmSheet, Screen, useSession } from '@dentor/shared'
import { useState } from 'react'
import { MenuCard } from '@/components/profile/MenuCard'
import { ProfileSummary } from '@/components/profile/ProfileSummary'
import { useMe } from '@/hooks/useMe'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useRouter } from '@/nav'
import type { PatientSession } from '@/types'

export default function ProfileTab() {
  const router = useRouter()
  const { data: session, signOut } = useSession<PatientSession>()
  const me = useMe()
  const { refreshing, onRefresh } = useRefresh(me.refetch)
  useRefreshOnFocus(me.refetch)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const profile = session?.profile
  const others = (session?.profiles.length ?? 1) - 1

  const logOut = async () => {
    setLeaving(true)
    await signOut()
  }

  return (
    <Screen testID="profile-screen" title="My Profile" refreshing={refreshing} onRefresh={onRefresh}>
      <ProfileSummary
        name={me.data?.profile.name ?? profile?.name ?? ''}
        code={profile?.code ?? ''}
        photo={me.data?.profile.photo ?? profile?.photo}
        mobile={session?.account?.mobile}
        clinicName={me.data?.clinic.name ?? profile?.clinic_name}
      />

      {/* The design's four rows first (frame "Profile" 95:430). Help is not built yet. */}
      <MenuCard
        size={20}
        items={[
          { key: 'edit', title: 'Profile', icon: 'user', onPress: () => router.push('/account/edit') },
          { key: 'settings', title: 'Settings', icon: 'settings', onPress: () => router.push('/account/settings') },
          { key: 'rate', title: 'Rate Us', icon: 'thumbs-up', onPress: () => router.push('/reviews/new') },
        ]}
      />

      {/* The app's own rows, which the design does not show. */}
      <MenuCard
        items={[
          {
            key: 'family',
            title: 'Family members',
            subtitle: others > 0 ? `${others} other ${others === 1 ? 'profile' : 'profiles'} on your number` : 'Add and switch between profiles',
            icon: 'users',
            onPress: () => router.push('/account/family'),
          },
          { key: 'clinic', title: 'Clinic information', subtitle: me.data?.clinic.name ?? profile?.clinic_name, icon: 'map-pin', onPress: () => router.push('/account/clinic') },
          { key: 'password', title: 'Change password', icon: 'lock', onPress: () => router.push('/account/password') },
          { key: 'logout', title: 'Log out', icon: 'log-out', onPress: () => setConfirmLogout(true) },
          { key: 'delete', title: 'Delete account', subtitle: 'Remove your app login', icon: 'trash-2', danger: true, onPress: () => router.push('/account/delete') },
        ]}
      />

      <ConfirmSheet
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logOut}
        title="Log out?"
        message="You will need your mobile number and password (or a code by SMS) to log in again."
        confirmLabel="Log out"
        loading={leaving}
      />
    </Screen>
  )
}

import { BiometricSetting, Screen, useSession } from '@dentor/shared'
import { MenuCard } from '@/components/profile/MenuCard'
import { useRouter } from '@/nav'
import type { PatientSession } from '@/types'

/**
 * Settings, from the design's frame "settings" (96:532): fingerprint sign-in, privacy and terms.
 * The design's Notification Setting and Help rows are tracked in docs/IMPLEMENTATION_PLAN.md.
 */
export default function Settings() {
  const router = useRouter()
  const { data } = useSession<PatientSession>()
  const account = data?.account
  return (
    <Screen testID="settings-screen" title="Settings" back>
      {!!account && (
        <BiometricSetting scope="patient" enrollPath="/api/patient/auth/device/enroll" revokePath="/api/patient/auth/device/revoke" label={account.name || `+91 ${account.mobile}`} />
      )}
      <MenuCard
        items={[
          { key: 'notification-settings', title: 'Notification Setting', icon: 'bell', onPress: () => router.push('/account/notification-settings') },
          { key: 'privacy', title: 'Privacy Policy', icon: 'lock', onPress: () => router.push('/account/privacy') },
          { key: 'terms', title: 'Terms And Conditions', icon: 'lock', onPress: () => router.push('/account/terms') },
        ]}
      />
    </Screen>
  )
}

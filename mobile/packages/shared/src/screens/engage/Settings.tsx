import { useRouter } from '../../navigation'
import { Screen } from '../../ui/layout'
import { BiometricSetting } from '../../ui/auth'
import { MenuRows } from '../../ui/menu'

/**
 * "Settings" (dentor.fig 281 Clinic app, 426 Consultant app): notification setting, password manager,
 * fingerprint, privacy policy, terms and help, in the design's order. The design's "Uploads" row
 * (letterhead, signature, seal) waits for a decision on letterhead printing and is left out.
 */
export function SettingsScreen({ scope, email }: { scope: 'owner' | 'consultant'; email?: string }) {
  const router = useRouter()
  return (
    <Screen testID="settings-screen" title="Settings" back>
      <MenuRows
        items={[
          { key: 'notification-settings', testID: 'settings-notification-settings', title: 'Notification Setting', subtitle: 'Mute, silence, sleep mode', icon: 'bell-off', onPress: () => router.push('/notification-settings') },
          { key: 'change-password', testID: 'settings-change-password', title: 'Password Manager', subtitle: 'Signs out your other devices', icon: 'lock', onPress: () => router.push('/change-password') },
        ]}
      />
      {!!email && <BiometricSetting scope={scope} enrollPath="/api/auth/device/enroll" revokePath="/api/auth/device/revoke" label={email} />}
      <MenuRows
        items={[
          { key: 'privacy', testID: 'settings-privacy', title: 'Privacy Policy', icon: 'shield', onPress: () => router.push('/privacy') },
          { key: 'terms', testID: 'settings-terms', title: 'Terms And Conditions', icon: 'file-text', onPress: () => router.push('/terms') },
          { key: 'help', testID: 'settings-help', title: 'Help', icon: 'help-circle', onPress: () => router.push('/help') },
        ]}
      />
    </Screen>
  )
}

import { Avatar, Badge, LogoutDialog, MenuRows, Screen, T, colors, space, useNotifications, useSession } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import sad from '@/assets/design/mascot-sad.png'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

export default function MoreScreen() {
  const router = useRouter()
  const { data: session, signOut } = useSession<StaffSession>()
  const notifications = useNotifications('/api')
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const user = session?.user
  const unread = notifications.data?.unread ?? 0

  const leave = async () => {
    setLeaving(true)
    await signOut()
  }

  return (
    <Screen testID="more-screen" title="My Profile" subtitle="Clinic settings and your account">
      {/* design (dentor.fig "Profile" 12:5): the photo and the name centred above the rows */}
      <View testID="account-card" style={{ alignItems: 'center', gap: space.xs }}>
        <Avatar name={user?.name} size={91} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T variant="h3" numberOfLines={1} testID="account-name">
            {user?.name ?? ''}
          </T>
          <T variant="small" color={colors.textMuted} numberOfLines={1} testID="account-email">
            {user?.email ?? ''}
          </T>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>
            {[user?.role, user?.clinic?.name].filter(Boolean).join(' · ')}
          </T>
        </View>
      </View>

      {/* design (dentor.fig "Profile" 233): Profile, Post A Offer, Settings, Help in that order, with round
          #ff0004 icons and JetBrains Mono labels; the app's own rows follow. "Status" waits for decision D8. */}
      <MenuRows
        items={[
          { key: 'clinic-profile', testID: 'more-clinic-profile', title: 'Profile', subtitle: 'Clinic name, plan and contact details', icon: 'user', onPress: () => router.push('/clinic-profile') },
          ...(can(user?.role, 'admin')
            ? [{ key: 'offer', testID: 'more-offer', title: 'Post A Offer', subtitle: 'Offers to your patients', icon: 'percent' as const, onPress: () => router.push('/offers') }]
            : []),
          { key: 'settings', testID: 'more-settings', title: 'Settings', subtitle: 'Notifications, password, fingerprint', icon: 'settings', onPress: () => router.push('/settings') },
          { key: 'help', testID: 'more-help', title: 'Help', subtitle: 'FAQ and contact', icon: 'help-circle', onPress: () => router.push('/help') },
          ...(can(user?.role, 'admin')
            ? [{ key: 'clinic-rules', testID: 'more-clinic-rules', title: 'Clinic rules', subtitle: 'Booking, payments, consent and security', icon: 'sliders' as const, onPress: () => router.push('/clinic-rules') }]
            : []),
          {
            key: 'notifications',
            testID: 'more-notifications',
            title: 'Notifications',
            subtitle: unread > 0 ? `${unread} unread` : 'Nothing new',
            icon: 'bell',
            right: unread > 0 ? <Badge testID="more-unread" label={unread > 99 ? '99+' : String(unread)} tone="red" /> : undefined,
            onPress: () => router.push('/notifications'),
          },
          { key: 'support', testID: 'more-support', title: 'Raise a Ticket', subtitle: 'Dentor support', icon: 'life-buoy', onPress: () => router.push('/support') },
          { key: 'sign-out', testID: 'more-sign-out', title: 'Sign out', subtitle: user?.email, icon: 'log-out', danger: true, onPress: () => setConfirming(true) },
        ]}
      />

      <LogoutDialog visible={confirming} mascot={sad} onCancel={() => setConfirming(false)} onConfirm={leave} />
    </Screen>
  )
}

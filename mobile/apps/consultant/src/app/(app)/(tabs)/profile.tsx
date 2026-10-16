import { Badge, Button, Card, LogoutDialog, fmtINR, KeyValue, MenuRows, QueryState, Screen, Section, useNotifications, useSession } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import sad from '@/assets/design/mascot-sad.png'
import { ProfileCard } from '@/components/ProfileCard'
import { useProfile } from '@/hooks/useProfile'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRouter } from '@/nav'

export default function ProfileScreen() {
  const router = useRouter()
  const { signOut } = useSession()
  const me = useProfile()
  const pull = usePullToRefresh(me.refetch)
  const unread = useNotifications('/api').data?.unread ?? 0
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  return (
    <Screen testID="screen-profile" title="Profile" {...pull}>
      <QueryState query={me}>
        {(data) => (
          <>
            <ProfileCard profile={data.profile} clinic={data.clinic} />
            <Section title="Practice details">
              <Card>
                <View testID="profile-availability">
                  <KeyValue label="Availability" value={data.profile.availability} />
                </View>
                <View testID="profile-location">
                  <KeyValue label="Location" value={data.profile.location} />
                </View>
                <View testID="profile-phone">
                  <KeyValue label="Phone" value={data.profile.phone} />
                </View>
                <KeyValue label="Email" value={data.profile.email} />
                <KeyValue label="Consultation fee" value={data.profile.fee ? fmtINR(data.profile.fee) : ''} />
                <View testID="profile-about">
                  <KeyValue label="About" value={data.profile.about} />
                </View>
              </Card>
              <Button testID="edit-profile" label="Edit details" icon="edit-2" variant="secondary" full onPress={() => router.push('/edit-profile')} />
            </Section>
          </>
        )}
      </QueryState>

      {/* design (dentor.fig "Profile" 419): Profile, Settings, Ratings & Reviews, Help first, with round #0a338e icons
          and JetBrains Mono labels; the work rows follow. "Status" waits for decision D8. */}
      <MenuRows
        items={[
          { key: 'settings', testID: 'open-settings', title: 'Settings', subtitle: 'Notifications, password, fingerprint', icon: 'settings', onPress: () => router.push('/settings') },
          { key: 'reviews', testID: 'open-reviews', title: 'Ratings & Reviews', subtitle: 'What clinics say', icon: 'thumbs-up', onPress: () => router.push('/reviews') },
          { key: 'help', testID: 'open-help', title: 'Help', icon: 'help-circle', onPress: () => router.push('/help') },
        ]}
      />
      <Section title="Work">
        <MenuRows
          items={[
            { key: 'requests', testID: 'open-requests', title: 'Clinic requests', subtitle: 'Confirm, offer times, start and complete', icon: 'inbox', onPress: () => router.push('/requests') },
            { key: 'availability', testID: 'open-availability', title: 'Set availability', subtitle: 'The hours clinics can book you', icon: 'clock', onPress: () => router.push('/availability') },
            { key: 'prescriptions', testID: 'open-prescriptions', title: 'My prescriptions', subtitle: 'Everything you have issued', icon: 'file-text', onPress: () => router.push('/prescriptions') },
            {
              key: 'notifications',
              testID: 'open-notifications-row',
              title: 'Notifications',
              subtitle: 'Bookings, check-ins and cancellations',
              icon: 'bell',
              right: unread > 0 ? <Badge label={unread > 99 ? '99+' : String(unread)} tone="red" /> : undefined,
              onPress: () => router.push('/notifications'),
            },
            { key: 'chat', testID: 'open-chat', title: 'Chat', subtitle: 'Messages with the clinic', icon: 'message-circle', onPress: () => router.push('/chat') },
            { key: 'inventory', testID: 'open-inventory', title: 'Inventory', subtitle: 'Your kit and its use per case', icon: 'package', onPress: () => router.push('/inventory') },
            { key: 'wallet', testID: 'open-wallet', title: 'Refer and earn', subtitle: 'Your code and points', icon: 'award', onPress: () => router.push('/wallet') },
            { key: 'plans', testID: 'open-plans', title: 'Premium membership', icon: 'star', onPress: () => router.push('/plans') },
            { key: 'store', testID: 'open-store', title: 'E-com', subtitle: 'Dentor store', icon: 'shopping-bag', onPress: () => router.push('/store') },
            { key: 'jobs', testID: 'open-jobs', title: 'Job posts', icon: 'briefcase', onPress: () => router.push('/jobs') },
            { key: 'support', testID: 'open-support', title: 'Raise a ticket', icon: 'life-buoy', onPress: () => router.push('/support') },
          ]}
        />
      </Section>

      <Button testID="sign-out" label="Sign out" icon="log-out" variant="outline" full onPress={() => setConfirming(true)} />
      <LogoutDialog visible={confirming} mascot={sad} onCancel={() => setConfirming(false)} onConfirm={() => { setLeaving(true); void signOut() }} />
    </Screen>
  )
}

import { LogoutDialog, Screen, StaffHeader, space, useNotifications, useSession, todayISO } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import sad from '@/assets/design/mascot-sad.png'
import { SideMenu } from '@/components/SideMenu'
import { AdBanner, useAdvertisement } from '@/components/home/AdBanner'
import { Products } from '@/components/home/Products'
import { ReviewStrip } from '@/components/home/ReviewStrip'
import { Specialties } from '@/components/home/Specialties'
import { TodayStrip } from '@/components/overview/TodayStrip'
import { useClinicProfile } from '@/hooks/useClinicProfile'
import { useOverview } from '@/hooks/useOverview'
import { usePushRegistration } from '@/hooks/usePushRegistration'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import { BUILT } from '@/lib/features'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

/**
 * The clinic's home, as the Clinic app design draws it (dentor.fig "Home" 37:626 and "Home after
 * flip" 6973:7983): greeting header with the menu, the clinic's location, the clinic's own advertisement
 * that flips to today's figures, "BOOK APPOINTMENT" with the specialities, supplies and reviews.
 */
export default function Home() {
  usePushRegistration()
  const router = useRouter()
  const { data: session, signOut } = useSession<StaffSession>()
  const clinic = useClinicProfile()
  const today = todayISO()
  const overview = useOverview({ from: today, to: today })
  const notifications = useNotifications('/api')
  const { ad, active: advertisement } = useAdvertisement()
  const { refreshing, refresh } = useRefresh(clinic, overview, notifications, ad)
  const [flipped, setFlipped] = useState(false)
  const [menu, setMenu] = useState(false)
  // dentor.fig "logout" (316): the sad tooth asks first
  const [leaving, setLeaving] = useState(false)
  const user = session?.user
  const role = user?.role
  const place = [clinic.data?.clinic.address, clinic.data?.clinic.city].filter(Boolean).join(', ')

  return (
    <Screen
      testID="home-screen"
      header={
        <StaffHeader
          light
          name={user?.name ?? ''}
          code={user?.clinic?.name}
          unread={notifications.data?.unread}
          onBell={() => router.push('/notifications')}
          onSettings={() => router.push('/more')}
          onProfile={() => router.push('/more')}
          onMenu={() => setMenu(true)}
        />
      }
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {/* "Service To" and the clinic's location (the design's white pill) */}
      <View style={styles.serviceRow}>
        <Text style={styles.serviceLabel}>Service To</Text>
        <View testID="home-location" style={styles.locationPill}>
          <Text numberOfLines={1} style={styles.location}>{place || user?.clinic?.name || 'CLINIC LOCATION'}</Text>
        </View>
      </View>

      {/* the banner flips to today's figures; without an active advertisement of the clinic, today's figures show */}
      <View>
        {flipped || !advertisement ? (
          <TodayStrip date={overview.data?.today} summary={overview.data?.today_summary} />
        ) : (
          <AdBanner ad={advertisement} />
        )}
        {!!advertisement && (
          <Pressable testID="home-flip" accessibilityRole="button" accessibilityLabel={flipped ? 'Show the advertisement' : "Show today's figures"} onPress={() => setFlipped(!flipped)} style={styles.flip}>
            <Text style={styles.flipText}>FLIP</Text>
          </Pressable>
        )}
      </View>

      <Specialties onPick={BUILT.bookConsultant && can(role, 'front-desk') ? (specialty) => router.push({ pathname: '/consult/book', params: { specialty: specialty === 'General Dentistry' ? '' : specialty } }) : undefined} />
      <Products onOpen={BUILT.shop ? () => router.push('/store') : undefined} />
      <ReviewStrip />

      <SideMenu
        visible={menu}
        onClose={() => setMenu(false)}
        role={user?.role}
        clinicName={user?.clinic?.name}
        clinicPhone={clinic.data?.clinic.phone}
        onSignOut={() => setLeaving(true)}
      />
      <LogoutDialog visible={leaving} mascot={sad} onCancel={() => setLeaving(false)} onConfirm={() => { setLeaving(false); void signOut() }} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  serviceLabel: { fontFamily: 'Roboto-SemiBold', fontSize: 11, color: '#000000' },
  locationPill: {
    flex: 1, minHeight: 24, borderRadius: 8, borderWidth: 0.25, borderColor: '#8c8686', backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm,
  },
  location: { fontFamily: 'Roboto-SemiBold', fontSize: 10, color: '#000000' },
  flip: { position: 'absolute', top: 4, right: 18, minWidth: 44, minHeight: 22, borderRadius: 23, backgroundColor: '#ff0000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  flipText: { fontFamily: 'Roboto-SemiBold', fontSize: 12, color: '#ffffff' },
})

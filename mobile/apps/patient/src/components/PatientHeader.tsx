import { Avatar, IconButton, colors, face, space, useNotifications, useSession } from '@dentor/shared'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PATIENT_API } from '@/endpoints'
import { useContact } from '@/hooks/useContact'
import { useRouter } from '@/nav'
import type { PatientSession } from '@/types'

/**
 * The patient design's header band (patient-app.fig, frame "Home" 6:1887 and the module
 * screens): photo, "Hi, WelcomeBack", the patient's name and id in gold, the bell and the
 * settings gear, then the clinic's name on a white pill and, on Home, "Call Clinic".
 */
export function PatientHeader({ clinicName, clinicPhone, showCall, children }: { clinicName?: string; clinicPhone?: string; showCall?: boolean; children?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const contact = useContact()
  const { data: session } = useSession<PatientSession>()
  const profile = session?.profile
  const unread = useNotifications(PATIENT_API).data?.unread ?? 0
  return (
    <View testID="patient-header" style={[styles.band, { paddingTop: insets.top + 10 }]}>
      <View style={styles.column}>
        <View style={styles.row}>
          <Pressable testID="header-profile" accessibilityRole="button" accessibilityLabel="My profile" onPress={() => router.push('/profile')}>
            <Avatar name={profile?.name} uri={profile?.photo} size={46} />
          </Pressable>
          <View style={styles.who}>
            <Text style={styles.hello}>Hi, WelcomeBack</Text>
            <Text testID="header-name" numberOfLines={1} style={styles.name}>{profile?.name}</Text>
            <Text testID="header-code" numberOfLines={1} style={styles.code}>{profile?.code}</Text>
          </View>
          <IconButton testID="home-bell" icon="bell" label="Notifications" badge={unread} color={colors.accent} onPress={() => router.push('/notifications')} />
          <IconButton testID="header-settings" icon="settings" label="Settings" color={colors.accent} onPress={() => router.push('/account/settings')} />
        </View>
        <View style={styles.clinicRow}>
          <View testID="home-clinic" style={styles.clinicPill}>
            <Text numberOfLines={1} style={styles.clinicName}>{clinicName ?? profile?.clinic_name}</Text>
          </View>
          {showCall && !!clinicPhone && (
            <Pressable testID="home-call-clinic" accessibilityRole="button" accessibilityLabel="Call Clinic" onPress={() => contact.call(clinicPhone)} style={({ pressed }) => [styles.call, pressed && { opacity: 0.85 }]}>
              <Text style={styles.callText}>Call Clinic</Text>
            </Pressable>
          )}
        </View>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  band: { backgroundColor: colors.header, paddingBottom: 10 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  who: { flex: 1, minWidth: 0 },
  // design: League Spartan Light 12 white; Gabriela 14 and 12 in #ffc909
  hello: { fontFamily: 'LeagueSpartan-Light', fontSize: 12, lineHeight: 15, color: colors.headerText },
  name: { fontFamily: 'Gabriela-Regular', fontSize: 14, lineHeight: 18, color: colors.accent },
  code: { fontFamily: 'Gabriela-Regular', fontSize: 12, lineHeight: 15, color: colors.accent },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 10 },
  // design: white pill, radius 10, Gabriela 14 black, centred
  clinicPill: { flex: 1, minWidth: 0, minHeight: 22, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  clinicName: { fontFamily: 'Gabriela-Regular', fontSize: 14, lineHeight: 18, color: '#000000' },
  // design: #47b5be, radius 8, 77 x 25; label Plus Jakarta Sans Medium 10 white (Noto Sans Medium stands in)
  call: { minHeight: 25, borderRadius: 8, backgroundColor: colors.brand500, paddingHorizontal: 10, justifyContent: 'center' },
  callText: { ...face('medium'), fontSize: 11, lineHeight: 14, color: '#ffffff' },
})

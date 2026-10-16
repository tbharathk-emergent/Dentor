import { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { imageSource } from '../image'
import { useRouter } from '../navigation'
import { loadItem, saveItem } from '../storage'
import { colors, face, space } from '../theme'
import { MaterialDesignIcons } from '../ui/icons'

const seenKey = (app: string) => `dentor.${app}.welcomed`

/** Whether this device has been through the first-launch screens (permissions, onboarding, disclaimer). */
export async function welcomeSeen(app: string): Promise<boolean> {
  return (await loadItem(seenKey(app))) === '1'
}

/**
 * What the design's "PERMISSIONS" frame (dentor.fig 4151:3880, 6218:3647) asks for, and what this
 * version of the app really does with each. Nothing here is requested up front: photos are chosen
 * one at a time through the system picker (no library access), there is no push service yet, and
 * the location, camera, calendar and microphone features are not built (see IMPLEMENTATION_PLAN.md).
 */
const PERMISSIONS = [
  { key: 'location', icon: 'map-marker', tint: '#4a90e2', title: 'Location Access', use: 'To find nearby Consultants Accurately', state: 'Not used yet' },
  { key: 'camera', icon: 'camera', tint: '#e76f51', title: 'Camera Access', use: 'To upload dental reports and scan prescriptions.', state: 'Not used yet' },
  { key: 'photos', icon: 'image-multiple', tint: '#4a90e2', title: 'Photo & Media', use: 'To upload treatment documents.', state: 'You choose each photo' },
  { key: 'notifications', icon: 'bell', tint: '#e28a2b', title: 'Notifications', use: 'To remind you about appointments and medication.', state: 'In the app' },
  { key: 'calendar', icon: 'calendar', tint: '#4a90e2', title: 'Calendar Access (Optional)', use: 'To auto-add appointments to your calendar.', state: 'Not used yet' },
  { key: 'microphone', icon: 'microphone', tint: '#7ae24a', title: 'Microphone Access (Optional)', use: 'Required for voice consultations and audio recording during dental Assessments.', state: 'Not used yet' },
] as const

/**
 * The Clinic and Consultant apps' first launch: permissions, then the onboarding screen with
 * "Log In" and "Sign up", and the disclaimer every user agrees to once (dentor.fig "Onboarding"
 * 2174:146 / 3973:46118, "login" 2682:940, "Login agree" 3973:46397).
 */
export function StaffWelcomeScreen({ app, art, title, body }: { app: string; art: number | string; title: string; body: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const width = Math.min(useWindowDimensions().width, 480)
  const [step, setStep] = useState<'permissions' | 'onboarding'>('permissions')
  const [next, setNext] = useState<'/login' | '/signup' | null>(null)

  const agree = async () => {
    await saveItem(seenKey(app), '1')
    if (next) router.replace(next)
  }

  if (step === 'permissions') return <PermissionsPanel onContinue={() => setStep('onboarding')} />

  return (
    <ScrollView testID="welcome-onboarding" style={styles.root} contentContainerStyle={[styles.column, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <Image source={imageSource(art)} style={{ width: width * 0.85, height: (width * 0.85 * 341) / 305, alignSelf: 'center' }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable testID="welcome-login" accessibilityRole="button" onPress={() => setNext('/login')} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.primaryText}>Log In</Text>
      </Pressable>
      <Pressable testID="welcome-signup" accessibilityRole="button" onPress={() => setNext('/signup')} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.secondaryText}>Sign up</Text>
      </Pressable>

      <Modal visible={!!next} transparent animationType="fade" onRequestClose={() => setNext(null)}>
        <View style={styles.backdrop}>
          <View testID="welcome-disclaimer" style={styles.sheet}>
            <Text style={styles.disclaimerTitle}>Disclaimer:</Text>
            <Text style={styles.disclaimerText}>
              This app is not intended to supplement or be a substitute for the expertise and judgement of your dentist/doctor or any other healthcare professional.
            </Text>
            <Pressable testID="welcome-agree" accessibilityRole="button" onPress={agree} style={({ pressed }) => [styles.agree, pressed && { opacity: 0.85 }]}>
              <Text style={styles.agreeText}>Agree</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

/** "PERMISSIONS" (dentor.fig 4151:3880, 6218:3647; patient-app.fig 2:434): what each permission is for and what this version does with it. */
export function PermissionsPanel({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView testID="welcome-permissions" style={styles.root} contentContainerStyle={[styles.column, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
      <Text accessibilityRole="header" style={styles.permTitle}>Enable Permissions to Get Started</Text>
      <Text style={styles.permLead}>Dentor needs a few permissions to provide full dental care services. This version asks for none up front:</Text>
      {PERMISSIONS.map((p) => (
        <View key={p.key} testID={`permission-${p.key}`} style={styles.permRow}>
          <View style={[styles.permIcon, { backgroundColor: p.tint }]}>
            <MaterialDesignIcons name={p.icon} size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.permName}>{p.title}</Text>
            <Text style={styles.permUse}>{p.use}</Text>
          </View>
          <Text style={[styles.permState, p.state !== 'Not used yet' && { color: '#1b7f3a' }]}>{p.state}</Text>
        </View>
      ))}
      <Pressable testID="welcome-continue" accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
      <Text style={styles.privacy}>Dentor respects your privacy. Your data is encrypted and never shared without consent.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 28, gap: space.md },
  // dentor.fig 4151:3880: Roboto, #1b3b5b titles, #2b3b4d text, white rows with a #cdcccc border, radius 8
  permTitle: { fontFamily: 'Roboto-SemiBold', fontSize: 20, lineHeight: 25, color: '#1b3b5b', textAlign: 'center' },
  permLead: { fontFamily: 'Roboto-Regular', fontSize: 14, lineHeight: 18, color: '#2b3b4d', textAlign: 'center' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: 10, paddingVertical: space.sm, borderRadius: 8, borderWidth: 1, borderColor: '#cdcccc', backgroundColor: '#ffffff' },
  permIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  permName: { fontFamily: 'Roboto-SemiBold', fontSize: 14, lineHeight: 17, color: '#1b3b5b' },
  permUse: { fontFamily: 'Roboto-Regular', fontSize: 12, lineHeight: 16, color: '#2b3b4d' },
  permState: { ...face('medium'), fontSize: 11, lineHeight: 14, color: colors.textMuted, maxWidth: 84, textAlign: 'right' },
  privacy: { fontFamily: 'Roboto-Regular', fontSize: 12, lineHeight: 16, color: '#2b3b4d', textAlign: 'center' },
  // dentor.fig 2174:146: Poppins 16 / 14 (drawn with the app's body face), the brand button radius 10
  title: { ...face('semibold', true), fontSize: 16, lineHeight: 24, color: '#000000', textAlign: 'center', marginTop: space.md },
  body: { ...face('regular'), fontSize: 14, lineHeight: 21, color: '#838383', textAlign: 'center' },
  primary: { alignSelf: 'center', width: '80%', minWidth: 220, height: 50, marginTop: space.sm, borderRadius: 10, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'NotoSans-Medium', fontSize: 18, lineHeight: 24, color: '#ffffff' },
  secondary: { alignSelf: 'center', width: '80%', minWidth: 220, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'NotoSans-Medium', fontSize: 18, lineHeight: 24, color: colors.header },
  backdrop: { flex: 1, backgroundColor: 'rgba(238,245,254,0.96)', alignItems: 'center', justifyContent: 'center', padding: space.md },
  // dentor.fig 2682:940: a white card, radius 20, red "Disclaimer:" in Gabriela, Inter 16 text, red "Agree"
  sheet: { width: '100%', maxWidth: 400, borderRadius: 20, backgroundColor: '#ffffff', padding: 20, gap: space.md },
  disclaimerTitle: { fontFamily: 'Gabriela-Regular', fontSize: 20, lineHeight: 26, color: colors.header },
  disclaimerText: { ...face('regular'), fontSize: 16, lineHeight: 22, color: '#000000' },
  agree: { alignSelf: 'center', width: 125, height: 40, borderRadius: 10, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  agreeText: { fontFamily: 'Gabriela-Regular', fontSize: 20, lineHeight: 26, color: '#ffffff' },
})

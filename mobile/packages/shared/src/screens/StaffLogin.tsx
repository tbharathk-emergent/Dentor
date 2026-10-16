import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, errorMessage } from '../api'
import { useRouter } from '../navigation'
import { useSession } from '../session'
import { imageSource } from '../image'
import { colors, face, font, radius, space } from '../theme'
import { EMAIL_PATTERN } from '../validation'
import { MaterialDesignIcons } from '../ui/icons'
import { Banner, Button, TextField } from '../ui/primitives'
import { BiometricButton, RememberMe, useBiometricSignIn } from '../ui/auth'

/**
 * Email + password sign-in for the Clinic and Consultant apps, with "Remember me", fingerprint
 * sign-in once it is turned on in Settings, "Forget Password" (an emailed code) and "Sign Up"
 * (an application Dentor approves). The API only accepts the roles this app is built for, so
 * the wrong kind of account is told which app to use instead of being let in.
 */
export function StaffLoginScreen({
  app,
  appName,
  tagline,
  demoHint,
  design,
}: {
  app: 'owner' | 'consultant'
  appName: string
  tagline: string
  /** Shown in development builds only. */
  demoHint?: string
  /**
   * The app's design artwork (dentor.fig, frames "Log In"): the folded header, the logo drawn
   * on it and the line-art background. With it the screen takes the design's layout.
   */
  design?: { header: number | string; logo: number | string; pattern: number | string }
}) {
  const insets = useSafeAreaInsets()
  // The design header at a phone's size, centred on a tablet (iOS applies an aspect ratio before a maximum width).
  const heroWidth = Math.min(useWindowDimensions().width, 380)
  const heroSize = { width: heroWidth, height: Math.round((heroWidth * 300) / 361) }
  const logoSize = { width: Math.round(heroWidth * 0.7), height: Math.round((heroWidth * 0.7 * 105) / 262) }
  const { signIn } = useSession()
  const router = useRouter()
  const biometric = useBiometricSignIn(app, '/api/auth/device/login', { app })
  const [remember, setRemember] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const next: typeof errors = {}
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter the email address of your Dentor login.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (next.email || next.password || busy) return
    setBusy(true)
    try {
      const payload = await api.public.post('/api/auth/login', { email: email.trim().toLowerCase(), password, app })
      await signIn(payload, { remember })
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Could not sign in. Please try again.') })
    } finally {
      setBusy(false)
    }
  }

  const fingerprint = async () => {
    const payload = await biometric.signInWith()
    if (payload) await signIn(payload, { remember: true })
  }
  const bioError = !!biometric.error && <Banner testID="login-biometric-error" tone="red" icon="alert-circle" text={biometric.error} />

  if (design) {
    return (
      <KeyboardAvoidingView style={styles.designRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Image source={imageSource(design.pattern)} style={styles.pattern} resizeMode="cover" accessibilityIgnoresInvertColors />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.designHero, heroSize, { height: heroSize.height + insets.top, paddingTop: insets.top }]}>
            <Image source={imageSource(design.header)} style={styles.heroArt} resizeMode="stretch" accessibilityIgnoresInvertColors />
            <View style={styles.heroContent}>
              <Image source={imageSource(design.logo)} style={logoSize} resizeMode="contain" accessibilityLabel={`DENTOR, ${appName}`} />
              <Text accessibilityRole="header" style={styles.welcome}>Welcome</Text>
              <Text style={styles.tagline}>DENTISTRY AMASSED ! World’s first online Platform for Speciality Dental Treatments</Text>
            </View>
          </View>
          <View style={[styles.designBody, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
            {/* The design's label reads "Email or Mobile Number"; staff sign in with their email only. */}
            <Text style={styles.label}>Email</Text>
            <TextField testID="login-email" value={email} onChangeText={setEmail} placeholder="example@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            <Text style={styles.label}>Password</Text>
            <TextField testID="login-password" secure value={password} onChangeText={setPassword} placeholder="*************" error={errors.password} onSubmitEditing={submit} />
            <View style={styles.options}>
              <RememberMe value={remember} onChange={setRemember} />
              <Pressable testID="login-forgot" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/forgot')}>
                <Text style={styles.forgot}>Forget Password</Text>
              </Pressable>
            </View>
            {!!errors.form && <Banner tone="red" icon="alert-circle" text={errors.form} />}
            {bioError}
            <Pressable
              testID="login-submit"
              accessibilityRole="button"
              accessibilityLabel="Login"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => [styles.loginPill, (pressed || busy) && { opacity: 0.8 }]}
            >
              <Text style={styles.loginText}>{busy ? 'Logging in…' : 'Login'}</Text>
            </Pressable>
            {biometric.available && <BiometricButton name={biometric.name} label={biometric.info?.label} busy={biometric.busy} onPress={fingerprint} />}
            <Pressable testID="login-signup" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/signup')} style={styles.signup}>
              <Text style={styles.signupText}>
                Don’t have an account? <Text style={styles.signupLink}>Sign Up</Text>
              </Text>
            </Pressable>
            {__DEV__ && !!demoHint && <Banner testID="dev-build" tone="brand" icon="info" text={demoHint} />}
            <Text style={styles.company}>A Unit Of IQDS DENTAL INDIA Pvt. Ltd.,</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + space.xxl }]}>
          <View style={styles.logo}>
            <MaterialDesignIcons name="tooth-outline" size={34} color={colors.brand700} />
          </View>
          <Text style={[font.h1, { color: colors.onBrand }]}>{appName}</Text>
          <Text style={[font.body, { color: colors.brand100, textAlign: 'center' }]}>{tagline}</Text>
        </View>

        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }]}>
          <Text accessibilityRole="header" style={[font.h2, { color: colors.textStrong }]}>Sign in</Text>
          <TextField
            testID="login-email"
            label="Email"
            required
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="you@clinic.in"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <TextField
            testID="login-password"
            label="Password"
            required
            icon="lock"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            error={errors.password}
            onSubmitEditing={submit}
          />
          <View style={styles.options}>
            <RememberMe value={remember} onChange={setRemember} color={colors.text} />
            <Pressable testID="login-forgot" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/forgot')}>
              <Text style={[font.smallStrong, { color: colors.brand700 }]}>Forgot password?</Text>
            </Pressable>
          </View>
          {!!errors.form && <Banner tone="red" icon="alert-circle" text={errors.form} />}
          {bioError}
          <Button testID="login-submit" label="Sign in" onPress={submit} loading={busy} size="lg" full />
          {biometric.available && <BiometricButton name={biometric.name} label={biometric.info?.label} busy={biometric.busy} onPress={fingerprint} color={colors.brand700} />}
          <Button testID="login-signup" label="New to Dentor? Sign up" variant="ghost" full onPress={() => router.push('/signup')} />
          {/* Debug builds only (they use the development API). The native smoke tests look for
              this before typing a password, so they stop on a release build. */}
          {__DEV__ && !!demoHint && <Banner testID="dev-build" tone="brand" icon="info" text={demoHint} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  // The design layout (dentor.fig, "Log In" frames 2312:232 and 3973:6122)
  designRoot: { flex: 1, backgroundColor: colors.surface },
  pattern: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  designHero: { alignSelf: 'center' },
  heroArt: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroContent: { flex: 1, alignItems: 'center', paddingTop: '6%', paddingHorizontal: space.lg },
  welcome: { marginTop: space.md, fontFamily: 'LeagueSpartan-SemiBold', fontSize: 24, lineHeight: 28, color: '#fdc500', textAlign: 'center' },
  // Stretched to the column: iOS does not wrap a centred text that only has a maximum width.
  tagline: { marginTop: 2, alignSelf: 'stretch', paddingHorizontal: space.md, fontFamily: 'Roboto-Regular', fontSize: 11, lineHeight: 14, color: '#ffffff', textAlign: 'center' },
  designBody: { flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.sm, paddingHorizontal: 30, paddingTop: space.md },
  label: { fontFamily: 'LeagueSpartan-Medium', fontSize: 20, lineHeight: 24, color: '#000000', marginTop: space.sm },
  options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  forgot: { ...face('regular'), fontSize: 13, lineHeight: 18, color: colors.title, textAlign: 'right' },
  signup: { alignSelf: 'center', paddingVertical: space.xs },
  signupText: { ...face('regular'), fontSize: 14, lineHeight: 20, color: colors.text, textAlign: 'center' },
  signupLink: { ...face('semibold'), color: colors.title },
  loginPill: { alignSelf: 'center', width: '64%', minWidth: 200, height: 45, marginTop: space.md, borderRadius: 18, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  loginText: { fontFamily: 'NotoSans-Medium', fontSize: 24, lineHeight: 30, color: '#fdc500' },
  company: { marginTop: 'auto', paddingTop: space.xl, fontFamily: 'NotoSans-Bold', fontSize: 12, lineHeight: 16, color: '#070707', textAlign: 'center' },
  root: { flex: 1, backgroundColor: colors.brand700 },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.xxl },
  logo: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  card: {
    flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg, padding: space.xl,
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
})

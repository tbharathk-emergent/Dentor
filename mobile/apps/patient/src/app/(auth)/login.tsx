import { Banner, BiometricButton, Button, EMAIL_PATTERN, RememberMe, TextField, errorMessage, space, useBiometricSignIn, useSession } from '@dentor/shared'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AuthScaffold } from '@/components/auth/AuthScaffold'
import { useLogin } from '@/hooks/useAuth'
import { recallMobile, rememberMobile } from '@/lib/rememberedMobile'
import { isClean, mobileProblem, normalizeMobile } from '@/lib/validate'
import { useFocusEffect, useRouter } from '@/nav'

export default function Login() {
  const router = useRouter()
  const { signIn } = useSession()
  const login = useLogin()
  const [mobile, setMobile] = useState(recallMobile)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const biometric = useBiometricSignIn('patient', '/api/patient/auth/device/login')

  // Coming back from sign-up or a password reset: carry on with the number used there.
  useFocusEffect(useCallback(() => setMobile(recallMobile()), []))

  // The design's "Email or Mobile Number": the API accepts either.
  const isEmail = mobile.includes('@')
  const changeMobile = (value: string) => {
    setMobile(value)
    if (!value.includes('@')) rememberMobile(value)
  }

  const submit = () => {
    const who = isEmail
      ? EMAIL_PATTERN.test(mobile.trim()) ? undefined : 'Enter a valid email address, like name@example.com.'
      : mobileProblem(mobile)
    const found = { mobile: who, password: password ? undefined : 'Enter your password.' }
    setErrors(found)
    setFailure(null)
    if (!isClean(found) || login.isPending) return
    login.mutate(
      { identifier: isEmail ? mobile.trim().toLowerCase() : normalizeMobile(mobile), password },
      {
        onSuccess: (payload) => signIn(payload, { remember }),
        onError: (error) => setFailure(errorMessage(error, 'Could not log in. Please try again.')),
      },
    )
  }

  return (
    <AuthScaffold testID="login-screen" hero title="Welcome" subtitle="DENTISTRY AMASSED ! World’s first online Platform for Speciality Dental Treatments">
      {/* design: a #1d8992 card, radius 13, with the two labelled white fields */}
      <View style={styles.card}>
        <Text style={styles.label}>Email or Mobile Number</Text>
        <TextField
          testID="login-mobile"
          value={mobile}
          onChangeText={changeMobile}
          placeholder="example@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={120}
          error={errors.mobile}
        />
        <Text style={styles.label}>Password</Text>
        <TextField testID="login-password" secure value={password} onChangeText={setPassword} placeholder="*************" error={errors.password} onSubmitEditing={submit} />
      </View>
      <View style={styles.options}>
        <RememberMe value={remember} onChange={setRemember} color="#1d8992" />
        <Pressable testID="login-forgot" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/forgot')}>
          <Text style={styles.forgotText}>Forget Password</Text>
        </Pressable>
      </View>
      {!!failure && (
        <View testID="login-error">
          <Banner tone="red" icon="alert-circle" text={failure} />
        </View>
      )}
      <Pressable
        testID="login-submit"
        accessibilityRole="button"
        accessibilityLabel="Login"
        disabled={login.isPending}
        onPress={submit}
        style={({ pressed }) => [styles.login, (pressed || login.isPending) && { opacity: 0.8 }]}
      >
        <Text style={styles.loginText}>{login.isPending ? 'Logging in…' : 'Login'}</Text>
      </Pressable>
      {biometric.available && (
        <BiometricButton
          name={biometric.name}
          label={biometric.info?.label}
          busy={biometric.busy}
          color="#1d8992"
          onPress={async () => {
            const payload = await biometric.signInWith()
            if (payload) await signIn(payload, { remember: true })
          }}
        />
      )}
      {!!biometric.error && <Banner testID="login-biometric-error" tone="red" icon="alert-circle" text={biometric.error} />}
      <Pressable testID="login-signup" accessibilityRole="button" onPress={() => router.push('/signup')} style={styles.center}>
        <Text style={styles.signup}>Don’t have an account? <Text style={styles.signupLink}>Sign Up</Text></Text>
      </Pressable>
      {/* Not in the design: the app also signs in with a one-time code by SMS. */}
      <Button testID="login-otp" label="Log in with a code" variant="ghost" size="sm" onPress={() => router.push('/otp-login')} />

      {/* Debug builds only (they use the development API). The native smoke test looks for
          this before typing a password, so it stops on a release build. */}
      {__DEV__ && <Banner testID="dev-build" tone="brand" icon="info" text="Demo patient: mobile 9876543210, password Patient@2026" />}
    </AuthScaffold>
  )
}

const styles = StyleSheet.create({
  // design (frame "Log In" 1:7323)
  card: { gap: space.sm, padding: 12, paddingTop: 16, borderRadius: 13, backgroundColor: '#1d8992' },
  label: { fontFamily: 'LeagueSpartan-Medium', fontSize: 20, lineHeight: 24, color: '#000000', textAlign: 'center' },
  options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, marginTop: -space.xs },
  forgotText: { fontFamily: 'LeagueSpartan-Medium', fontSize: 14, lineHeight: 18, color: '#47b5be' },
  login: { alignSelf: 'center', width: '64%', minWidth: 200, height: 45, borderRadius: 30, backgroundColor: '#1d8992', alignItems: 'center', justifyContent: 'center' },
  loginText: { fontFamily: 'NotoSans-Medium', fontSize: 24, lineHeight: 30, color: '#fdc500' },
  center: { alignItems: 'center' },
  signup: { fontFamily: 'LeagueSpartan-Light', fontSize: 16, lineHeight: 20, color: '#070707', textAlign: 'center' },
  signupLink: { fontFamily: 'LeagueSpartan-Medium', color: '#1d8992' },
})

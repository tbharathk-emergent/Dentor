import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { api, errorMessage } from '../api'
import { useRouter } from '../navigation'
import { colors, face, space } from '../theme'
import { EMAIL_PATTERN, STRONG_PASSWORD_RULE, strongPasswordProblem } from '../validation'
import { CodeInput } from '../ui/codeInput'
import { Screen } from '../ui/layout'
import { MascotDialog } from '../ui/mascot'
import { Banner, Button, TextField } from '../ui/primitives'

/** Seconds left before another code may be sent, counting down. */
export function useCountdown() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return [left, setLeft] as const
}

const STAFF_PATHS = { send: '/api/auth/forgot', verify: '/api/auth/forgot/verify', reset: '/api/auth/forgot/reset' }

/**
 * "Forget Password" for staff (dentor.fig "Forgot Password", "Enter Verification Code", "Set
 * Password"): a four-digit code goes to the login's email, then a new password is chosen. Every
 * device signed in to the login is signed out. The API answers an unknown email the same way.
 */
export function StaffForgotScreen({ mascot }: { mascot: number | string }) {
  return <EmailResetScreen mascot={mascot} paths={STAFF_PATHS} rule={STRONG_PASSWORD_RULE} check={strongPasswordProblem} />
}

/** The same steps for any account kind: `paths` are its send / verify / reset endpoints. */
export function EmailResetScreen({ mascot, paths, rule, check, intro }: {
  /** The success pop-up's art; without it the success is a plain screen. */
  mascot?: number | string
  paths: { send: string; verify: string; reset: string }
  rule: string
  check: (password: string) => string | undefined
  intro?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(5)
  const [wait, setWait] = useCountdown()
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'))

  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await work()
    } catch (err) {
      setFailure(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const send = () => {
    const problem = EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter the email address of your Dentor login.'
    setErrors({ email: problem })
    if (problem) return
    void run(async () => {
      const res = await api.public.post(paths.send, { email: email.trim().toLowerCase() })
      setDevCode(res.dev_code ?? null)
      setMinutes(Math.max(1, Math.round((res.expires_in ?? 300) / 60)))
      setWait(res.resend_in ?? 30)
      setCode('')
      setStep('code')
    })
  }

  const verify = () => {
    const problem = code.length === 4 ? undefined : 'Enter the 4-digit code.'
    setErrors({ code: problem })
    if (problem) return
    void run(async () => {
      const res = await api.public.post(paths.verify, { email: email.trim().toLowerCase(), code })
      setTicket(res.ticket)
      setStep('password')
    })
  }

  const save = () => {
    const found = {
      password: check(password),
      confirm: confirm === password ? undefined : 'The two passwords do not match.',
    }
    setErrors(found)
    if (found.password || found.confirm) return
    void run(async () => {
      await api.public.post(paths.reset, { ticket, new_password: password })
      setStep('done')
    })
  }

  const problem = !!failure && <Banner testID="forgot-error" tone="red" icon="alert-circle" text={failure} />

  if (step === 'done' && !mascot) {
    return (
      <Screen pattern testID="forgot-done" title="Password updated" footer={<Button testID="forgot-login" label="Log in" size="lg" full onPress={() => router.replace('/login')} />}>
        <Banner tone="green" icon="check-circle" text="Log in with your new password. Every device that was logged in has been logged out." />
      </Screen>
    )
  }

  if (step === 'code' || step === 'done') {
    return (
      <Screen pattern testID="forgot-code" title="Verification Code" back onBack={() => setStep('email')}>
        <Text style={styles.lead}>Enter the 4-digit code we sent to {email.trim().toLowerCase()}. It works for {minutes} minutes.</Text>
        <CodeInput value={code} onChange={setCode} error={errors.code} />
        {__DEV__ && !!devCode && <Banner testID="dev-code" tone="brand" icon="info" text={`Development build: the code is ${devCode}`} />}
        {problem}
        <Button testID="forgot-verify" label="Verify" size="lg" full loading={busy} onPress={verify} />
        <Button testID="forgot-resend" label={wait > 0 ? `Send again in ${wait} s` : 'Send the code again'} variant="ghost" full disabled={wait > 0 || busy} onPress={send} />
        <MascotDialog
          testID="forgot-done"
          visible={step === 'done'}
          image={mascot ?? 0}
          title="Password updated"
          message="Log in with your new password. Every device that was signed in has been signed out."
          actions={[{ label: 'Log in', testID: 'forgot-login', onPress: () => router.replace('/login') }]}
        />
      </Screen>
    )
  }

  if (step === 'password') {
    return (
      <Screen pattern testID="forgot-password" title="Set Password" back onBack={() => setStep('email')}>
        <Text style={styles.lead}>Choose a new password for {email.trim().toLowerCase()}.</Text>
        <TextField testID="forgot-new" label="New password" required secure icon="lock" value={password} onChangeText={setPassword} error={errors.password} hint={rule} />
        <TextField testID="forgot-confirm" label="Confirm password" required secure icon="lock" value={confirm} onChangeText={setConfirm} error={errors.confirm} onSubmitEditing={save} />
        {problem}
        <Button testID="forgot-save" label="Create New Password" size="lg" full loading={busy} onPress={save} />
      </Screen>
    )
  }

  return (
    <Screen pattern testID="forgot-screen" title="Forgot Password" back onBack={toLogin}>
      <Text style={styles.lead}>{intro ?? 'Enter the email address you sign in with. We will email you a 4-digit code to set a new password.'}</Text>
      <TextField testID="forgot-email" label="Email" required icon="mail" value={email} onChangeText={setEmail} placeholder="example@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} onSubmitEditing={send} />
      {problem}
      <Button testID="forgot-send" label="Send Code" size="lg" full loading={busy} onPress={send} />
      <View style={{ height: space.sm }} />
      <Button testID="forgot-back" label="Back to login" variant="ghost" full onPress={toLogin} />
    </Screen>
  )
}

const styles = {
  lead: { ...face('regular'), fontSize: 15, lineHeight: 22, color: colors.text },
}

import { Banner, Button, Icon, T, colors, radius, space, toneColors } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { OTP_LENGTH, OtpInput } from '@/components/auth/OtpInput'
import type { OtpFlow } from '@/hooks/useOtp'

const spaced = (mobile: string) => `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`

/**
 * The code-entry step shared by sign-up, password reset and code login. It verifies the
 * code and hands the ticket to `onVerified`; the caller finishes its own flow from there.
 */
export function OtpStep({
  otp,
  onVerified,
  onChangeNumber,
  busy,
  submitLabel = 'Verify',
}: {
  otp: OtpFlow
  onVerified: (ticket: string) => void
  onChangeNumber: () => void
  /** The caller's follow-up request is running. */
  busy?: boolean
  submitLabel?: string
}) {
  const [code, setCode] = useState('')
  const [incomplete, setIncomplete] = useState(false)

  const submit = async () => {
    if (otp.verifying || busy) return
    if (code.length !== OTP_LENGTH) {
      setIncomplete(true)
      return
    }
    const ticket = await otp.verify(code)
    if (ticket) onVerified(ticket)
  }

  const resend = async () => {
    setCode('')
    setIncomplete(false)
    await otp.resend()
  }

  const error = incomplete && code.length !== OTP_LENGTH ? `Enter all ${OTP_LENGTH} digits of the code.` : otp.codeError

  return (
    <View style={styles.step}>
      <View style={styles.intro}>
        <T color={colors.textMuted}>
          Enter the {OTP_LENGTH}-digit code sent by SMS to{' '}
          <T variant="bodyStrong" testID="otp-mobile">{spaced(otp.mobile)}</T>.
        </T>
        <Button testID="otp-change-number" label="Use a different number" variant="ghost" size="sm" onPress={onChangeNumber} style={styles.inlineLink} />
      </View>

      <View style={styles.code}>
        <OtpInput testID="otp-code" value={code} onChange={setCode} onSubmit={submit} invalid={!!error} />
        {!!error && <T variant="small" color={colors.red} testID="otp-error">{error}</T>}
      </View>

      {!!otp.devOtp && (
        <View testID="otp-dev-hint" style={styles.hint}>
          <Icon name="info" size={16} color={toneColors.brand.fg} />
          <T variant="small" color={toneColors.brand.fg} style={styles.hintText}>
            Development server: no SMS is sent. Your code is{' '}
            <T variant="smallStrong" color={toneColors.brand.fg} testID="otp-dev-code">{otp.devOtp}</T>
          </T>
        </View>
      )}

      <Button testID="otp-submit" label={submitLabel} onPress={submit} loading={otp.verifying || busy} size="lg" full />

      {otp.requestError ? <Banner tone="amber" icon="clock" text={otp.requestError.message} /> : null}
      {otp.secondsLeft > 0 ? (
        <T variant="small" color={colors.textMuted} center testID="otp-resend-wait">
          You can ask for a new code in {otp.secondsLeft} s.
        </T>
      ) : (
        <Button testID="otp-resend" label="Send a new code" variant="ghost" onPress={resend} loading={otp.requesting} style={styles.resend} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  step: { gap: space.lg },
  intro: { gap: space.xs },
  inlineLink: { marginLeft: -space.md },
  code: { gap: space.sm },
  hint: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: toneColors.brand.bg },
  hintText: { flex: 1 },
  resend: { alignSelf: 'center' },
})

import { Banner, Button, Screen, TextField } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { SuccessView } from '@/components/SuccessView'
import { AuthScaffold } from '@/components/auth/AuthScaffold'
import { MobileStep } from '@/components/auth/MobileStep'
import { OtpStep } from '@/components/auth/OtpStep'
import { usePasswordResetFlow } from '@/hooks/usePasswordResetFlow'
import { PASSWORD_RULE } from '@/lib/validate'
import { useRouter } from '@/nav'

export default function ForgotPassword() {
  const router = useRouter()
  const flow = usePasswordResetFlow()
  // The login screen picks up the number used here.
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'))

  if (flow.step === 'done') {
    return (
      <Screen testID="reset-success" footer={<Button testID="reset-login" label="Log in" size="lg" full onPress={toLogin} />}>
        <SuccessView title="Password updated" message="Log in with your new password. Other devices that were logged in to this account have been logged out." />
      </Screen>
    )
  }

  if (flow.step === 'otp') {
    return (
      <AuthScaffold testID="forgot-otp" title="Check your messages" subtitle="We sent a code to reset your password" onBack={flow.backToMobile}>
        <OtpStep otp={flow.otp} onVerified={flow.onVerified} onChangeNumber={flow.backToMobile} />
      </AuthScaffold>
    )
  }

  const failure = flow.failure && (
    <Rows tight testID="reset-failure">
      <Banner tone="red" icon="alert-circle" text={flow.failure.message} />
      {flow.failure.unknownNumber && <Button testID="reset-signup" label="Create an account" variant="secondary" full onPress={() => router.replace('/signup')} />}
    </Rows>
  )

  if (flow.step === 'password') {
    return (
      <AuthScaffold testID="forgot-password" title="Choose a new password" subtitle={`For the account on +91 ${flow.otp.mobile}`} onBack={flow.backToMobile}>
        <TextField testID="reset-password" label="New password" required secure icon="lock" value={flow.password} onChangeText={flow.setPassword} error={flow.errors.password} hint={PASSWORD_RULE} />
        <TextField
          testID="reset-confirm"
          label="Confirm new password"
          required
          secure
          icon="lock"
          value={flow.confirm}
          onChangeText={flow.setConfirm}
          error={flow.errors.confirm}
          onSubmitEditing={flow.savePassword}
        />
        {failure}
        <Button testID="reset-submit" label="Update password" size="lg" full loading={flow.saving} onPress={flow.savePassword} />
      </AuthScaffold>
    )
  }

  return (
    <AuthScaffold testID="forgot-screen" title="Forgot your password?" subtitle="Enter your mobile number and we will text you a code" onBack={toLogin}>
      <MobileStep mobile={flow.mobile} onChange={flow.setMobile} error={flow.mobileError} problem={flow.otp.requestError} sending={flow.otp.requesting} onSubmit={flow.sendCode}>
        {failure}
      </MobileStep>
      <Button testID="forgot-by-email" label="Use my email instead" variant="secondary" full onPress={() => router.push('/forgot-email')} />
      <Button testID="forgot-login" label="Back to log in" variant="ghost" full onPress={toLogin} />
    </AuthScaffold>
  )
}

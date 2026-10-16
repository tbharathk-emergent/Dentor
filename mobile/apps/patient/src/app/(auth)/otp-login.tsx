import { Banner, Button } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { AuthScaffold } from '@/components/auth/AuthScaffold'
import { MobileStep } from '@/components/auth/MobileStep'
import { OtpStep } from '@/components/auth/OtpStep'
import { useOtpLoginFlow } from '@/hooks/useOtpLoginFlow'
import { useRouter } from '@/nav'

export default function OtpLogin() {
  const router = useRouter()
  const flow = useOtpLoginFlow()
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/login'))

  if (flow.step === 'otp') {
    return (
      <AuthScaffold testID="otp-login-code" title="Enter your code" subtitle="We sent it by SMS just now" onBack={flow.backToMobile}>
        <OtpStep otp={flow.otp} onVerified={flow.onVerified} onChangeNumber={flow.backToMobile} busy={flow.signingIn} submitLabel="Log in" />
      </AuthScaffold>
    )
  }

  return (
    <AuthScaffold testID="otp-login-screen" title="Log in with a code" subtitle="No password needed: we text a one-time code to your mobile" onBack={leave}>
      <MobileStep mobile={flow.mobile} onChange={flow.setMobile} error={flow.mobileError} problem={flow.otp.requestError} sending={flow.otp.requesting} onSubmit={flow.sendCode}>
        {flow.failure && (
          <Rows tight testID="otp-login-failure">
            <Banner tone="red" icon="alert-circle" text={flow.failure.message} />
            {flow.failure.unknownNumber && (
              <Button testID="otp-login-signup" label="Create an account" variant="secondary" full onPress={() => router.replace('/signup')} />
            )}
          </Rows>
        )}
      </MobileStep>
      <Button testID="otp-login-password" label="Log in with your password instead" variant="ghost" full onPress={leave} />
    </AuthScaffold>
  )
}

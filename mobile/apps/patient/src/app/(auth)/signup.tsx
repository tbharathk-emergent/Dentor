import { Banner, Button, Screen } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { SuccessView } from '@/components/SuccessView'
import { AuthScaffold } from '@/components/auth/AuthScaffold'
import { OtpStep } from '@/components/auth/OtpStep'
import { SignupForm } from '@/components/auth/SignupForm'
import { useSignupFlow } from '@/hooks/useSignupFlow'
import { useRouter } from '@/nav'

export default function Signup() {
  const router = useRouter()
  const flow = useSignupFlow()
  // The login screen picks up the number typed here.
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'))

  if (flow.step === 'done' && flow.account) {
    return (
      <Screen testID="signup-success" footer={<Button testID="signup-continue" label="Continue" size="lg" full loading={flow.entering} onPress={flow.enter} />}>
        <SuccessView
          title={`Welcome, ${flow.account.account.name.split(/\s+/)[0]}!`}
          message="Your Dentor account is ready. Next, choose your clinic to see your records and book visits."
        />
      </Screen>
    )
  }

  if (flow.step === 'otp') {
    return (
      <AuthScaffold testID="signup-otp" title="Verify your number" subtitle="One quick check and your account is ready" onBack={flow.backToForm}>
        <OtpStep otp={flow.otp} onVerified={flow.onVerified} onChangeNumber={flow.backToForm} busy={flow.creating} submitLabel="Verify and create account" />
      </AuthScaffold>
    )
  }

  const notice = flow.notice
  return (
    <AuthScaffold
      testID="signup-screen"
      title="Create your account"
      subtitle="It takes about a minute"
      onBack={toLogin}
    >
      <SignupForm
        values={flow.values}
        errors={flow.errors}
        onChange={flow.change}
        onSubmit={flow.submitForm}
        submitting={flow.submitting}
        notice={
          notice && (
            <Rows tight testID="signup-notice">
              <Banner tone={notice.tone} icon={notice.tone === 'red' ? 'alert-circle' : 'info'} text={notice.message} />
              {notice.registered && <Button testID="signup-login-instead" label="Log in instead" variant="secondary" full onPress={toLogin} />}
            </Rows>
          )
        }
      />
      <Button testID="signup-have-account" label="I already have an account" variant="ghost" full onPress={toLogin} />
    </AuthScaffold>
  )
}

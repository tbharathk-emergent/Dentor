import { EmailResetScreen } from '@dentor/shared'
import { PASSWORD_RULE, passwordProblem } from '@/lib/validate'

/** "Forget Password" by email (patient-app.fig 108:3392 to 108:9006), for accounts that have one. */
export default function ForgotByEmail() {
  return (
    <EmailResetScreen
      paths={{ send: '/api/patient/auth/email/forgot', verify: '/api/patient/auth/email/verify', reset: '/api/patient/auth/email/reset' }}
      rule={PASSWORD_RULE}
      check={passwordProblem}
      intro="Enter the email address on your Dentor account. We will email you a 4-digit code to set a new password."
    />
  )
}

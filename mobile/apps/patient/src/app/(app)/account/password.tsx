import { ChangePasswordScreen } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { PASSWORD_RULE, passwordProblem } from '@/lib/validate'

export default function ChangePassword() {
  return <ChangePasswordScreen endpoint={`${PATIENT_API}/account/change-password`} rule={PASSWORD_RULE} check={passwordProblem} />
}

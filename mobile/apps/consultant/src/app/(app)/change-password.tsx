import { ChangePasswordScreen } from '@dentor/shared'

export default function ChangePassword() {
  return (
    <ChangePasswordScreen
      endpoint="/api/auth/change-password"
      rule="Use at least 8 characters; your clinic may require upper and lower case letters, a digit and a symbol."
    />
  )
}

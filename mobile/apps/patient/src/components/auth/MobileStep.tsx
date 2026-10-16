import { Banner, Button } from '@dentor/shared'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { MobileField } from '@/components/auth/MobileField'
import type { OtpProblem } from '@/hooks/useOtp'

/** "Enter your number, get a code": the first step of password reset and of code login. */
export function MobileStep({
  mobile,
  onChange,
  error,
  problem,
  sending,
  onSubmit,
  children,
}: {
  mobile: string
  onChange: (mobile: string) => void
  error?: string
  /** Why the last code request failed (wait, no SMS provider, offline). */
  problem: OtpProblem | null
  sending: boolean
  onSubmit: () => void
  /** Shown between the field and the button, e.g. what went wrong after verification. */
  children?: ReactNode
}) {
  return (
    <>
      <MobileField testID="otp-mobile-input" value={mobile} onChange={onChange} error={error} onSubmit={onSubmit} />
      {children}
      {problem && (
        <View testID="otp-request-problem">
          <Banner tone={problem.status === 429 ? 'amber' : 'red'} icon={problem.status === 429 ? 'clock' : 'alert-circle'} text={problem.message} />
        </View>
      )}
      <Button testID="otp-send" label="Send code" size="lg" full loading={sending} onPress={onSubmit} />
    </>
  )
}

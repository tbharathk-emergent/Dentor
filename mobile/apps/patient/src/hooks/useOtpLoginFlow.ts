import { ApiError, errorMessage, useSession } from '@dentor/shared'
import { useState } from 'react'
import { useOtpLogin } from '@/hooks/useAuth'
import { useOtp } from '@/hooks/useOtp'
import { recallMobile, rememberMobile } from '@/lib/rememberedMobile'
import { mobileProblem, normalizeMobile } from '@/lib/validate'

/** What the server said after the code was accepted. */
export interface OtpLoginFailure {
  message: string
  /** No account exists for the number: offer to sign up. */
  unknownNumber?: boolean
}

/** Log in without a password: number → SMS code → signed in. */
export function useOtpLoginFlow() {
  const { signIn } = useSession()
  const otp = useOtp('login')
  const login = useOtpLogin()
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [mobile, setMobileValue] = useState(recallMobile)
  const [mobileError, setMobileError] = useState<string | undefined>()
  const [failure, setFailure] = useState<OtpLoginFailure | null>(null)

  /** The number is shared with the other signed-out screens. */
  const setMobile = (value: string) => {
    setMobileValue(value)
    rememberMobile(value)
  }

  const backToMobile = () => {
    otp.clearRequestError()
    setStep('mobile')
  }

  const sendCode = async () => {
    const problem = mobileProblem(mobile)
    setMobileError(problem)
    setFailure(null)
    if (problem || otp.requesting) return
    if (await otp.request(normalizeMobile(mobile))) setStep('otp')
  }

  const onVerified = (ticket: string) =>
    login.mutate(ticket, {
      onSuccess: (payload) => signIn(payload),
      onError: (error) => {
        // The code is spent, so the patient starts again from the number with the reason shown.
        setFailure({ message: errorMessage(error), unknownNumber: error instanceof ApiError && error.status === 404 })
        backToMobile()
      },
    })

  return { step, otp, mobile, mobileError, failure, signingIn: login.isPending, setMobile, sendCode, onVerified, backToMobile }
}

import { ApiError, errorMessage } from '@dentor/shared'
import { useState } from 'react'
import { useResetPassword } from '@/hooks/useAuth'
import { useOtp } from '@/hooks/useOtp'
import { recallMobile, rememberMobile } from '@/lib/rememberedMobile'
import { isClean, mobileProblem, normalizeMobile, passwordProblem } from '@/lib/validate'

export type ResetStep = 'mobile' | 'otp' | 'password' | 'done'

/** What the server said when saving the new password. */
export interface ResetFailure {
  message: string
  /** No account exists for the number: offer to sign up. */
  unknownNumber?: boolean
}

/** Forgot password: number → SMS code → new password → done. */
export function usePasswordResetFlow() {
  const otp = useOtp('reset')
  const reset = useResetPassword()
  const [step, setStep] = useState<ResetStep>('mobile')
  const [mobile, setMobileValue] = useState(recallMobile)
  const [mobileError, setMobileError] = useState<string | undefined>()
  const [ticket, setTicket] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [failure, setFailure] = useState<ResetFailure | null>(null)

  /** The number is shared with the other signed-out screens. */
  const setMobile = (value: string) => {
    setMobileValue(value)
    rememberMobile(value)
  }

  const sendCode = async () => {
    const problem = mobileProblem(mobile)
    setMobileError(problem)
    setFailure(null)
    if (problem || otp.requesting) return
    if (await otp.request(normalizeMobile(mobile))) setStep('otp')
  }

  const onVerified = (verifiedTicket: string) => {
    setTicket(verifiedTicket)
    setStep('password')
  }

  const savePassword = () => {
    const found = {
      password: passwordProblem(password),
      confirm: confirm === password ? undefined : 'The two passwords do not match.',
    }
    setErrors(found)
    setFailure(null)
    if (!isClean(found) || reset.isPending) return
    reset.mutate(
      { ticket, new_password: password },
      {
        onSuccess: () => setStep('done'),
        onError: (error) => {
          const message = errorMessage(error)
          const unknownNumber = error instanceof ApiError && error.status === 404
          setFailure({ message, unknownNumber })
          // No account, or the ten-minute verification ran out: start again from the number.
          if (unknownNumber || /verification/i.test(message)) {
            otp.clearRequestError()
            setStep('mobile')
          }
        },
      },
    )
  }

  return {
    step,
    otp,
    mobile,
    mobileError,
    password,
    confirm,
    errors,
    failure,
    saving: reset.isPending,
    setMobile,
    setPassword,
    setConfirm,
    sendCode,
    onVerified,
    savePassword,
    backToMobile: () => {
      otp.clearRequestError()
      setStep('mobile')
    },
  }
}

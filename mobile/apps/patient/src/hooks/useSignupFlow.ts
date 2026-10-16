import { ApiError, errorMessage, useSession } from '@dentor/shared'
import { useState } from 'react'
import { useSignup } from '@/hooks/useAuth'
import { useOtp } from '@/hooks/useOtp'
import { recallMobile, rememberMobile } from '@/lib/rememberedMobile'
import { EMPTY_SIGNUP, signupProblems, type SignupErrors, type SignupValues } from '@/lib/signup'
import { rememberSignupDetails } from '@/lib/storage'
import { isClean, normalizeMobile } from '@/lib/validate'
import type { AuthPayload } from '@/types'

export type SignupStep = 'form' | 'otp' | 'done'

/** What the server said about the sign-up, shown above the submit button. */
export interface SignupNotice {
  message: string
  tone: 'red' | 'amber'
  /** The number already has an account: offer to log in instead. */
  registered?: boolean
}

/**
 * Sign-up from form to finished account: details → SMS code → account created → welcome.
 * The session starts only when the patient leaves the welcome screen (`enter`), because
 * signing in switches the app to the next area at once.
 */
export function useSignupFlow() {
  const { signIn } = useSession()
  const otp = useOtp('signup')
  const signup = useSignup()
  const [step, setStep] = useState<SignupStep>('form')
  const [values, setValues] = useState<SignupValues>(() => ({ ...EMPTY_SIGNUP, mobile: recallMobile() }))
  const [errors, setErrors] = useState<SignupErrors>({})
  const [failure, setFailure] = useState<SignupNotice | null>(null)
  // A verified number stays verified for ten minutes, so fixing a field does not need a new code.
  const [verified, setVerified] = useState<{ mobile: string; ticket: string } | null>(null)
  const [account, setAccount] = useState<AuthPayload | null>(null)
  const [entering, setEntering] = useState(false)

  const change = <K extends keyof SignupValues>(key: K, value: SignupValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (key === 'mobile') rememberMobile(String(value))
  }

  const createAccount = (ticket: string) => {
    signup.mutate(
      {
        ticket,
        name: values.name.trim(),
        password: values.password,
        email: values.email.trim() || undefined,
        gender: values.gender,
        age: Number(values.age),
      },
      {
        onSuccess: async (payload) => {
          await rememberSignupDetails({ mobile: normalizeMobile(values.mobile), age: values.age, gender: values.gender })
          setAccount(payload)
          setStep('done')
        },
        onError: (error) => {
          const status = error instanceof ApiError ? error.status : 0
          const message = errorMessage(error)
          otp.clearRequestError()
          setStep('form')
          if (status === 409 && /email/i.test(message)) {
            setErrors((current) => ({ ...current, email: message }))
          } else if (status === 409) {
            setFailure({ message, tone: 'amber', registered: true })
          } else {
            // An expired verification needs a fresh code; anything else is for the patient to fix.
            if (/verification/i.test(message)) setVerified(null)
            setFailure({ message, tone: 'red' })
          }
        },
      },
    )
  }

  const submitForm = async () => {
    const found = signupProblems(values)
    setErrors(found)
    setFailure(null)
    if (!isClean(found) || otp.requesting || signup.isPending) return
    const mobile = normalizeMobile(values.mobile)
    if (verified?.mobile === mobile) {
      createAccount(verified.ticket)
      return
    }
    if (await otp.request(mobile)) setStep('otp')
  }

  const onVerified = (ticket: string) => {
    setVerified({ mobile: normalizeMobile(values.mobile), ticket })
    createAccount(ticket)
  }

  /** Start the session with the new account; the app then moves on to choosing a clinic. */
  const enter = async () => {
    if (!account) return
    setEntering(true)
    await signIn(account)
  }

  // On the form, the answer to the code request (already registered, wait, no SMS) comes first.
  const problem = otp.requestError
  const notice: SignupNotice | null = problem
    ? { message: problem.message, tone: problem.status === 409 || problem.status === 429 ? 'amber' : 'red', registered: problem.status === 409 }
    : failure

  return {
    step,
    values,
    errors,
    notice,
    otp,
    account,
    entering,
    submitting: otp.requesting || signup.isPending,
    creating: signup.isPending,
    change,
    submitForm,
    onVerified,
    enter,
    backToForm: () => {
      otp.clearRequestError()
      setStep('form')
    },
  }
}

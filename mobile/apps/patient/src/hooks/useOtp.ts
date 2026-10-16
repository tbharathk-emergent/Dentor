import { ApiError, api, errorMessage } from '@dentor/shared'
import { useCallback, useEffect, useState } from 'react'
import { PATIENT_API } from '@/endpoints'
import type { OtpPurpose, OtpRequestResult } from '@/types'

export interface OtpProblem {
  /** HTTP status of the failed request; 0 when the server could not be reached. */
  status: number
  message: string
}

function describeRequestError(err: unknown): OtpProblem {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 503) return { status, message: 'Verification codes are not available on this server yet. Please contact your clinic.' }
  return { status, message: errorMessage(err, 'Could not send the code. Please try again.') }
}

/**
 * One-time-code step of sign-up, password reset and code login: asks for a code, counts
 * down to when another may be requested, and exchanges the code for a verification ticket.
 */
export function useOtp(purpose: OtpPurpose) {
  const [mobile, setMobile] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [requesting, setRequesting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [requestError, setRequestError] = useState<OtpProblem | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Count down to `resendAt` from the clock, so a backgrounded app catches up when it returns.
  useEffect(() => {
    const remaining = () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))
    setSecondsLeft(remaining())
    if (remaining() === 0) return
    const timer = setInterval(() => {
      setSecondsLeft(remaining())
      if (remaining() === 0) clearInterval(timer)
    }, 500)
    return () => clearInterval(timer)
  }, [resendAt])

  const send = useCallback(
    async (toMobile: string): Promise<boolean> => {
      setRequesting(true)
      setRequestError(null)
      setCodeError(null)
      try {
        const res = await api.public.post<OtpRequestResult>(`${PATIENT_API}/auth/otp/request`, { mobile: toMobile, purpose })
        setMobile(toMobile)
        setDevOtp(res.dev_otp ?? null)
        setResendAt(Date.now() + (res.resend_in ?? 30) * 1000)
        return true
      } catch (err) {
        const problem = describeRequestError(err)
        // "Please wait 12 seconds…": keep the resend button in step with the server.
        const wait = problem.status === 429 ? Number(/(\d+) seconds?/.exec(problem.message)?.[1]) : NaN
        if (Number.isFinite(wait)) setResendAt(Date.now() + wait * 1000)
        setRequestError(problem)
        return false
      } finally {
        setRequesting(false)
      }
    },
    [purpose],
  )

  /** Ask for a code. A code sent to the same number moments ago is reused instead of requested twice. */
  const request = useCallback(
    async (toMobile: string): Promise<boolean> => {
      if (toMobile === mobile && resendAt > Date.now()) {
        setRequestError(null)
        return true
      }
      return send(toMobile)
    },
    [mobile, resendAt, send],
  )

  const resend = useCallback(() => send(mobile), [mobile, send])

  /** Check the code. Resolves the verification ticket, or null with `codeError` set. */
  const verify = useCallback(
    async (code: string): Promise<string | null> => {
      setVerifying(true)
      setCodeError(null)
      try {
        const res = await api.public.post<{ ticket: string }>(`${PATIENT_API}/auth/otp/verify`, { mobile, purpose, code })
        return res.ticket
      } catch (err) {
        setCodeError(errorMessage(err, 'Could not check the code. Please try again.'))
        return null
      } finally {
        setVerifying(false)
      }
    },
    [mobile, purpose],
  )

  /** Forget the last "could not send" message, e.g. once the form shows a newer one. */
  const clearRequestError = useCallback(() => setRequestError(null), [])

  return { mobile, devOtp, secondsLeft, requesting, verifying, requestError, codeError, request, resend, verify, clearRequestError }
}

export type OtpFlow = ReturnType<typeof useOtp>

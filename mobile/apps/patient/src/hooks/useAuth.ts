import { api } from '@dentor/shared'
import { useMutation } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import type { AuthPayload } from '@/types'

/** Calls made before a session exists. Each resolves the response; the screen decides when to `signIn()`. */

export function useLogin() {
  return useMutation({
    mutationFn: (body: { identifier: string; password: string }) =>
      api.public.post<AuthPayload>(`${PATIENT_API}/auth/login`, body),
  })
}

export interface SignupRequest {
  ticket: string
  name: string
  password: string
  email?: string
  gender?: string
  age?: number
}

export function useSignup() {
  return useMutation({
    mutationFn: (body: SignupRequest) => api.public.post<AuthPayload>(`${PATIENT_API}/auth/signup`, body),
  })
}

export function useOtpLogin() {
  return useMutation({
    mutationFn: (ticket: string) => api.public.post<AuthPayload>(`${PATIENT_API}/auth/login-otp`, { ticket }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { ticket: string; new_password: string }) =>
      api.public.post<{ ok: boolean }>(`${PATIENT_API}/auth/reset-password`, body),
  })
}

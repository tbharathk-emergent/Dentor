import { api } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClinicLogin, ClinicLogins, ConsultantProfile, LoginChanges, NewLogin } from '@/types'

const loginsKey = ['clinic', 'users'] as const

/** Login accounts of the clinic and the roles a new login may be given. */
export function useLogins() {
  return useQuery<ClinicLogins>({
    queryKey: loginsKey,
    queryFn: () => api.get<ClinicLogins>('/api/clinic/users'),
  })
}

/** Consultant profiles, needed only while a Consultant login is being linked to one. */
export function useConsultantProfiles(enabled: boolean) {
  return useQuery<ConsultantProfile[]>({
    queryKey: ['clinic', 'consultants'],
    queryFn: async () => (await api.get<{ items: ConsultantProfile[] }>('/api/consultants')).items,
    enabled,
  })
}

export function useCreateLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (login: NewLogin) => api.post<ClinicLogin>('/api/clinic/users', login),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loginsKey }),
  })
}

export function useUpdateLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: LoginChanges }) => api.patch<ClinicLogin>(`/api/clinic/users/${id}`, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loginsKey }),
  })
}

/** Sets a new password for someone else's login; the API signs that person out everywhere. */
export function useResetLoginPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post<{ ok: boolean }>(`/api/clinic/users/${id}/reset-password`, { new_password: password }),
  })
}

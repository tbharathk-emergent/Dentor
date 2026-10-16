import { api } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ConsultantProfile, ProfileChanges, ProfileResponse } from '@/types'
import { keys } from './keys'

export function useProfile() {
  return useQuery<ProfileResponse>({ queryKey: keys.me, queryFn: () => api.get('/api/consultant/me') })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation<ConsultantProfile, Error, ProfileChanges>({
    mutationFn: (changes) => api.patch('/api/consultant/me', changes),
    onSuccess: (profile) => {
      qc.setQueryData<ProfileResponse>(keys.me, (old) => (old ? { ...old, profile } : old))
      void qc.invalidateQueries({ queryKey: keys.me })
      void qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

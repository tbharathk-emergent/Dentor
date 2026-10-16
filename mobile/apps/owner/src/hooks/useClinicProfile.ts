import { api } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Clinic, ClinicContact, ClinicProfile } from '@/types'

const clinicKey = ['owner', 'clinic'] as const

export function useClinicProfile() {
  return useQuery<ClinicProfile>({
    queryKey: clinicKey,
    queryFn: () => api.get<ClinicProfile>('/api/owner/clinic'),
  })
}

/** Saves the changed contact fields; the API answers with the whole clinic record. */
export function useUpdateClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Partial<ClinicContact>) => api.patch<Clinic>('/api/owner/clinic', changes),
    onSuccess: (clinic) => {
      queryClient.setQueryData<ClinicProfile>(clinicKey, (previous) => ({ ...previous, clinic }))
      return queryClient.invalidateQueries({ queryKey: clinicKey })
    },
  })
}

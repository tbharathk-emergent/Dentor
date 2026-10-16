import { api } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { Consent } from '@/types'

export function useConsents() {
  return usePatientQuery<{ items: Consent[] }>({ queryKey: keys.consents, queryFn: () => api.get(`${PATIENT_API}/consents`) })
}

export function useSignConsent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Consent>(`${PATIENT_API}/consents/${id}/sign`),
    onSuccess: () => {
      // The home screen counts pending consents.
      void qc.invalidateQueries({ queryKey: keys.home })
      return qc.invalidateQueries({ queryKey: keys.consents })
    },
  })
}

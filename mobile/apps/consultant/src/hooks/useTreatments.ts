import { api } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TreatmentPayload } from '@/lib/treatmentForm'
import type { ClinicalRecord } from '@/types'
import { keys } from './keys'

/** Adds a treatment-plan entry; the API answers 400 when the clinic needs a signed consent first. */
export function useAddTreatment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<ClinicalRecord, Error, TreatmentPayload>({
    mutationFn: (payload) => api.post(`/api/consultant/patients/${patientId}/treatments`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.patient(patientId) }),
  })
}

import { api } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { Prescription } from '@/types'

export function usePrescriptions() {
  return usePatientQuery<{ items: Prescription[] }>({
    queryKey: keys.prescriptions,
    queryFn: () => api.get(`${PATIENT_API}/prescriptions`),
  })
}

export function usePrescription(id: string) {
  return usePatientQuery<Prescription>({
    queryKey: keys.prescription(id),
    queryFn: () => api.get(`${PATIENT_API}/prescriptions/${id}`),
    enabled: !!id,
  })
}

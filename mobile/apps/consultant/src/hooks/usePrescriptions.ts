import { api, ApiError } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PatientDetail, Prescription } from '@/types'
import type { PrescriptionPayload } from '@/lib/prescriptionForm'
import { keys } from './keys'

const fetchMine = () => api.get<{ items: Prescription[] }>('/api/consultant/prescriptions')

/** Prescriptions written by me, newest first. */
export function useMyPrescriptions() {
  return useQuery<{ items: Prescription[] }>({ queryKey: keys.prescriptions, queryFn: fetchMine })
}

/**
 * One prescription. The API has no "get by id", so it is read from the list it belongs to:
 * the patient's record when `patientId` is known (which also covers prescriptions written by
 * a colleague), otherwise my own prescriptions.
 */
export function usePrescription(id: string | undefined, patientId?: string) {
  const qc = useQueryClient()
  return useQuery<Prescription>({
    queryKey: keys.prescription(id ?? '', patientId ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const list = patientId
        ? (await qc.fetchQuery<PatientDetail>({
            queryKey: keys.patient(patientId),
            queryFn: () => api.get(`/api/consultant/patients/${patientId}`),
          })).prescriptions
        : (await qc.fetchQuery({ queryKey: keys.prescriptions, queryFn: fetchMine })).items
      const found = list.find((p) => p.id === id)
      if (!found) throw new ApiError(404, 'Prescription not found.')
      return found
    },
  })
}

export function useWritePrescription(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Prescription, Error, PrescriptionPayload>({
    mutationFn: (payload) => api.post(`/api/consultant/patients/${patientId}/prescriptions`, payload),
    onSuccess: (created) => {
      qc.setQueryData(keys.prescription(created.id, patientId), created)
      void qc.invalidateQueries({ queryKey: keys.prescriptions })
      void qc.invalidateQueries({ queryKey: keys.patient(patientId) })
    },
  })
}

import { api, qs } from '@dentor/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PatientDetail, PatientFileContent, PatientSummary } from '@/types'
import { keys } from './keys'

/** My patients, optionally filtered by name, code or mobile. */
export function usePatients(q: string) {
  return useQuery<{ items: PatientSummary[]; total: number }>({
    queryKey: keys.patients(q),
    queryFn: () => api.get(`/api/consultant/patients${qs({ q })}`),
    // Keep the previous results on screen while the next search loads.
    placeholderData: keepPreviousData,
  })
}

export function usePatient(id: string | undefined) {
  return useQuery<PatientDetail>({
    queryKey: keys.patient(id ?? ''),
    queryFn: () => api.get(`/api/consultant/patients/${id}`),
    enabled: !!id,
  })
}

/** One file with its content (`dataUrl`); fetched only when the file is opened. */
export function usePatientFile(patientId: string | undefined, fileId: string | undefined) {
  return useQuery<PatientFileContent>({
    queryKey: keys.patientFile(patientId ?? '', fileId ?? ''),
    queryFn: () => api.get(`/api/consultant/patients/${patientId}/files/${fileId}`),
    enabled: !!patientId && !!fileId,
    staleTime: 5 * 60_000,
  })
}

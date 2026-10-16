import { api } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { RecordsData } from '@/types'

/** Treatments, procedures, the dental chart and lab work in one call. */
export function useRecords() {
  return usePatientQuery<RecordsData>({ queryKey: keys.records, queryFn: () => api.get(`${PATIENT_API}/records`) })
}

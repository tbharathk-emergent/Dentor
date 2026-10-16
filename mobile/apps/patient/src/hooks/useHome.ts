import { api } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { HomeData } from '@/types'

/** Everything the home screen shows, in one call. */
export function useHome() {
  return usePatientQuery<HomeData>({ queryKey: keys.home, queryFn: () => api.get(`${PATIENT_API}/home`) })
}

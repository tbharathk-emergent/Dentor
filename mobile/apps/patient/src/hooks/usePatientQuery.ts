import { useSession } from '@dentor/shared'
import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import type { PatientSession } from '@/types'

/**
 * `useQuery` for data that belongs to the signed-in patient profile.
 *
 * The active profile's id is added to the cache key and the hook follows the session, so
 * when the patient switches to a family member (or the session is renewed) every screen
 * that is still mounted loads that person's data instead of showing what it had cached.
 * Invalidate or update these queries by key prefix (`invalidateQueries`, `setQueriesData`).
 *
 * Clinic data changes behind the patient's back (the front desk books, bills, replies), so by
 * default a screen shows what is cached at once and reloads it every time it is opened.
 */
export function usePatientQuery<T>(options: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey'> & { queryKey: QueryKey }): UseQueryResult<T, Error> {
  const profileId = useSession<PatientSession>().data?.profile?.patient_id ?? ''
  return useQuery<T, Error, T, QueryKey>({ staleTime: 0, ...options, queryKey: [...options.queryKey, profileId] })
}

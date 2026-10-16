import { api, qs } from '@dentor/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange, Team } from '@/types'

/** Doctor performance for a period and the staff directory. */
export function useTeam(range: DateRange) {
  return useQuery<Team>({
    queryKey: ['owner', 'team', range.from, range.to],
    queryFn: () => api.get<Team>(`/api/owner/team${qs({ date_from: range.from, date_to: range.to })}`),
    placeholderData: keepPreviousData,
  })
}

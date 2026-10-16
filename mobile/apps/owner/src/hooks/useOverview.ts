import { api, qs } from '@dentor/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange, Overview } from '@/types'

/** Clinic KPIs for a period. The previous period's figures stay on screen while the next load. */
export function useOverview(range: DateRange) {
  return useQuery<Overview>({
    queryKey: ['owner', 'overview', range.from, range.to],
    queryFn: () => api.get<Overview>(`/api/owner/overview${qs({ date_from: range.from, date_to: range.to })}`),
    placeholderData: keepPreviousData,
  })
}

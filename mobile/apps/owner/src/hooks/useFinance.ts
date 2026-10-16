import { api, qs } from '@dentor/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange, Finance } from '@/types'

/** Billing and collections for a period, plus every invoice that still has a balance. */
export function useFinance(range: DateRange) {
  return useQuery<Finance>({
    queryKey: ['owner', 'finance', range.from, range.to],
    queryFn: () => api.get<Finance>(`/api/owner/finance${qs({ date_from: range.from, date_to: range.to })}`),
    placeholderData: keepPreviousData,
  })
}

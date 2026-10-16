import { api, qs } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import type { Earnings } from '@/types'
import { keys } from './keys'

/** Billed, collected and outstanding for invoices raised in my name between two dates (inclusive). */
export function useEarnings(from: string, to: string) {
  return useQuery<Earnings>({
    queryKey: keys.earnings(from, to),
    queryFn: () => api.get(`/api/consultant/earnings${qs({ date_from: from, date_to: to })}`),
  })
}

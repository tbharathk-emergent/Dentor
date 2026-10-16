import { api } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import type { Operations } from '@/types'

/** Today's schedule, lab orders, stock alerts, leads and reviews. Refreshed every minute while open. */
export function useOperations() {
  return useQuery<Operations>({
    queryKey: ['owner', 'operations'],
    queryFn: () => api.get<Operations>('/api/owner/operations'),
    refetchInterval: 60_000,
  })
}

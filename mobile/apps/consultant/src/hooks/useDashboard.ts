import { api } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import type { Dashboard } from '@/types'
import { keys } from './keys'

/** Today's list, counts, next patient and upcoming visits; refreshed every minute while open. */
export function useDashboard() {
  return useQuery<Dashboard>({
    queryKey: keys.dashboard,
    queryFn: () => api.get('/api/consultant/dashboard'),
    refetchInterval: 60_000,
  })
}

import { api } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import type { Catalog } from '@/types'
import { keys } from './keys'

/** Medicine and treatment names for the pickers; changes rarely, so it is cached for a while. */
export function useCatalog() {
  return useQuery<Catalog>({
    queryKey: keys.catalog,
    queryFn: () => api.get('/api/consultant/catalog'),
    staleTime: 10 * 60_000,
  })
}

import { useState } from 'react'

interface Refetchable {
  refetch: () => Promise<unknown>
}

/**
 * Pull-to-refresh state for a screen. The spinner tracks the pull itself, not background
 * refetches, so it does not flash when the period changes or a poll runs.
 */
export function useRefresh(...queries: Refetchable[]) {
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all(queries.map((query) => query.refetch()))
    } finally {
      setRefreshing(false)
    }
  }
  return { refreshing, refresh }
}

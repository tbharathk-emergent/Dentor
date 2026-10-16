import { useCallback, useRef, useState } from 'react'

/**
 * Props for `Screen`'s pull-to-refresh. The spinner shows only for a refresh the user asked
 * for, not for the background reloads (every minute, or on coming back to a screen).
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(refetch)
  latest.current = refetch
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void latest.current().finally(() => setRefreshing(false))
  }, [])
  return { refreshing, onRefresh }
}

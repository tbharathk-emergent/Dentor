import { useCallback, useRef, useState } from 'react'

/**
 * Pull-to-refresh state for one or more queries. The spinner follows the pull only, so a
 * background refetch (polling, invalidation) never makes the list jump.
 */
export function useRefresh(...refetchers: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(refetchers)
  latest.current = refetchers

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void Promise.allSettled(latest.current.map((refetch) => refetch())).then(() => setRefreshing(false))
  }, [])

  return { refreshing, onRefresh }
}

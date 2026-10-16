import { useCallback, useRef } from 'react'
import { useFocusEffect } from '@/nav'

/**
 * Refreshes a screen's data each time the user comes back to it (from another tab or a
 * detail screen), so a list never shows what it looked like before they left. The first
 * focus is skipped: the query has just loaded.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const first = useRef(true)
  const latest = useRef(refetch)
  latest.current = refetch
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false
      else void latest.current()
    }, []),
  )
}

import { useCallback, useRef } from 'react'
import { useFocusEffect } from '@/nav'

/**
 * Reloads a screen's data each time the patient comes back to it. Tab screens stay mounted,
 * so without this they would keep showing what they loaded the first time they were opened.
 * The first appearance is skipped: the query is already loading then.
 */
export function useRefreshOnFocus(...refetchers: Array<() => unknown>) {
  const latest = useRef(refetchers)
  latest.current = refetchers
  const shownBefore = useRef(false)

  useFocusEffect(
    useCallback(() => {
      if (shownBefore.current) latest.current.forEach((refetch) => void refetch())
      shownBefore.current = true
    }, []),
  )
}

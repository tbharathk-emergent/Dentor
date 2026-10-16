import { todayISO } from '@dentor/shared'
import { useMemo, useSyncExternalStore } from 'react'
import { describeRange, periodRange, type PeriodKey } from '@/lib/period'
import type { DateRange } from '@/types'

/**
 * The reporting period is one choice for the whole app: picking "Last month" on Overview
 * shows last month on Finance and Team too. It lives in a small store rather than a provider
 * so no navigator has to wrap the screens for it.
 */
let current: PeriodKey = 'month'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getKey = () => current

function setPeriod(key: PeriodKey) {
  if (key === current) return
  current = key
  listeners.forEach((listener) => listener())
}

export interface Period {
  key: PeriodKey
  setPeriod: (key: PeriodKey) => void
  /** Local dates to send as date_from / date_to. */
  range: DateRange
  /** The range in words, e.g. "1–13 Oct 2026". */
  label: string
}

export function usePeriod(): Period {
  const key = useSyncExternalStore(subscribe, getKey, getKey)
  // Read on every render so a session left open overnight moves on to the new day.
  const today = todayISO()
  return useMemo(() => {
    const range = periodRange(key, today)
    return { key, setPeriod, range, label: describeRange(range) }
  }, [key, today])
}

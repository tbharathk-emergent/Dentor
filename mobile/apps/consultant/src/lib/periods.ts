import { addDays, parseISODate, toISODate } from '@dentor/shared'

export type PeriodKey = 'this_month' | 'last_month' | 'last_7' | 'last_30'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_7', label: 'Last 7 days' },
  { key: 'last_30', label: 'Last 30 days' },
]

/** Inclusive date range for an earnings period, ending today where the period is open. */
export function periodRange(key: PeriodKey, today: string): { from: string; to: string } {
  const d = parseISODate(today)
  switch (key) {
    case 'this_month':
      return { from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), to: today }
    case 'last_month':
      return {
        from: toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        to: toISODate(new Date(d.getFullYear(), d.getMonth(), 0)),
      }
    case 'last_7':
      return { from: addDays(today, -6), to: today }
    case 'last_30':
      return { from: addDays(today, -29), to: today }
  }
}

import { addDays, fmtDayShort, parseISODate, todayISO } from '@dentor/shared'
import type { DateRange } from '@/types'

export type PeriodKey = 'today' | 'last7' | 'month' | 'lastMonth'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
]

/** The dates a period covers, counted on the device's local calendar. */
export function periodRange(key: PeriodKey, today: string = todayISO()): DateRange {
  const monthStart = `${today.slice(0, 8)}01`
  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'last7':
      return { from: addDays(today, -6), to: today }
    case 'month':
      return { from: monthStart, to: today }
    case 'lastMonth': {
      const lastDay = addDays(monthStart, -1)
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay }
    }
  }
}

/** A range in words: "13 Oct 2026", "1–13 Oct 2026", "28 Sep – 4 Oct 2026". */
export function describeRange({ from, to }: DateRange): string {
  const start = fmtDayShort(from)
  const end = fmtDayShort(to)
  const startYear = parseISODate(from).getFullYear()
  const endYear = parseISODate(to).getFullYear()
  if (from === to) return `${end.day} ${end.month} ${endYear}`
  if (startYear !== endYear) return `${start.day} ${start.month} ${startYear} – ${end.day} ${end.month} ${endYear}`
  if (start.month !== end.month) return `${start.day} ${start.month} – ${end.day} ${end.month} ${endYear}`
  return `${start.day}–${end.day} ${end.month} ${endYear}`
}

import { addDays, parseISODate, toISODate } from '@dentor/shared'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const isISODate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toISODate(parseISODate(value)) === value

/** "Tuesday, 13 Oct 2026" */
export function longDate(iso: string): string {
  const d = parseISODate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "Tue, 13 Oct" */
export function shortDate(iso: string): string {
  const d = parseISODate(iso)
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/** "13 – 26 Oct 2026" or "28 Sep – 11 Oct 2026" */
export function rangeLabel(from: string, to: string): string {
  const a = parseISODate(from)
  const b = parseISODate(to)
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const start = sameMonth ? String(a.getDate()) : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`
  return `${start} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
}

/** Monday of the week that contains `iso`. */
export function startOfWeek(iso: string): string {
  const day = parseISODate(iso).getDay()
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

/** Same day of the month `months` later, clamped to the end of a shorter month. */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return toISODate(target)
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

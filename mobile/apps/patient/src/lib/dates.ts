import { addDays, todayISO } from '@dentor/shared'

/** How far ahead the booking and reschedule date strips go. */
export const BOOKING_DAYS = 14

/** Today and the following days as yyyy-mm-dd. */
export function upcomingDays(count = BOOKING_DAYS): string[] {
  const today = todayISO()
  return Array.from({ length: count }, (_, i) => addDays(today, i))
}

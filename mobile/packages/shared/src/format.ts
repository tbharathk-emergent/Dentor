export const fmtINR = (n: number | string | null | undefined) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/** Compact rupees for dashboard tiles: ₹1.2L, ₹45K. */
export const fmtINRCompact = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return fmtINR(v)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Parse a yyyy-mm-dd string as a LOCAL date (never shifts across time zones). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const todayISO = () => toISODate(new Date())

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const s = String(iso)
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  const d = parseISODate(s)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDayShort(iso: string): { dow: string; day: string; month: string } {
  const d = parseISODate(iso)
  return { dow: DAYS[d.getDay()], day: String(d.getDate()), month: MONTHS[d.getMonth()] }
}

export function fmtTime(hhmm?: string | null): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${ap}`
}

/** "2026-10-13T04:20:00+00:00" → "13 Oct 2026, 9:50 AM" in the device's time zone (the date as `fmtDate` writes it). */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${fmtDate(toISODate(d))}, ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`
}

/** "Just now", "12 min ago", "3 h ago", "9 d ago": the same steps as the web app's notification list. */
/** "Today", "Yesterday", or the day and month ("15 April") of a timestamp, for list headings. */
export function dayLabel(iso?: string | null, now: Date = new Date()): string {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return 'Earlier'
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  const label = `${date.getDate()} ${date.toLocaleString('en-IN', { month: 'long' })}`
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (Number.isNaN(min)) return ''
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.round(min / 60)} h ago`
  return `${Math.round(min / 1440)} d ago`
}

export function initials(name?: string | null): string {
  return (name || '?')
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

/** "2.4 MB", "310 KB"; anything under a kilobyte reads "1 KB", as in the web app's file list. */
export const fmtFileSize = (bytes?: number) => {
  const b = Number(bytes ?? 0)
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

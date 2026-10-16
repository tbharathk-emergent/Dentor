/**
 * Which colour family ("tone") a status, a lead stage, a login role or a risk level is shown
 * in. These are the reception web app's choices, so the same word has the same colour in all
 * four apps; the tones' actual colours are in theme.ts.
 *
 * This file has no imports, so `npm test` can load it and compare it with the web app
 * (tests/consistency.test.mjs).
 */
export type Tone = 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

/** The web app's statusTone (frontend/src/components/ui/Badge.tsx), word for word. */
export const WEB_STATUS_TONES: [Tone, string[]][] = [
  ['green', ['completed', 'paid', 'active', 'in stock', 'delivered', 'confirmed', 'converted', 'done', 'approved', 'present', 'received']],
  ['blue', ['scheduled', 'new', 'sent', 'dispatched', 'in progress', 'in-progress', 'ordered', 'open']],
  ['amber', ['waiting', 'pending', 'partial', 'low stock', 'due', 'follow-up', 'followup', 'on hold', 'trial']],
  ['red', ['cancelled', 'canceled', 'no-show', 'no show', 'overdue', 'out of stock', 'inactive', 'failed', 'rejected', 'lost', 'absent']],
  ['violet', ['checked-in', 'checked in', 'arrived', 'qualified', 'contacted']],
]

/**
 * Words the web app colours on the page that shows them instead of in statusTone:
 * "Signed" (pages/Prescriptions.tsx), "Available" (pages/Pharmacy.tsx), "Flagged" (pages/Reviews.tsx).
 */
export const PAGE_STATUS_TONES: [Tone, string[]][] = [
  ['green', ['signed', 'available']],
  ['violet', ['flagged']],
]

const STATUS_TONES = [...WEB_STATUS_TONES, ...PAGE_STATUS_TONES]

/**
 * One mapping of domain statuses to colours, shared by every app and the same as the web
 * app's: a status the web app shows in grey (Planned, Ready, Delayed, Declined, Draft, …) is
 * grey here too. Add a word in both places or in neither.
 */
export function statusTone(status?: string | null): Tone {
  const s = (status || '').toLowerCase()
  return STATUS_TONES.find(([, words]) => words.includes(s))?.[0] ?? 'slate'
}

/** The web app's STAGE_TONES in pages/Leads.tsx. */
export const LEAD_STAGE_TONES: Record<string, Tone> = {
  New: 'blue', Contacted: 'amber', Qualified: 'violet', Consultation: 'brand', Converted: 'green', Lost: 'red',
}

/** Colour of a lead's stage. */
export const leadStageTone = (stage?: string | null): Tone => LEAD_STAGE_TONES[stage || ''] ?? 'slate'

/** Colour of a login's role: the web app's Logins list (components/staff/LoginsPanel.tsx). */
export const roleTone = (role?: string | null): Tone => (role === 'Clinic Owner' ? 'violet' : role === 'Consultant' ? 'blue' : 'slate')

/** Colour of a patient's risk level: the web app's patient header (pages/PatientProfile.tsx). */
export const riskTone = (risk?: string | null): Tone => (risk === 'High' ? 'red' : risk === 'Medium' ? 'amber' : 'green')

import { isISODate } from './dates'

export const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS'] as const
export const INSTRUCTIONS = ['After food', 'Before food', 'With food', 'As directed'] as const

/** What the abbreviations mean, shown under the chips and on the review step. */
export const FREQUENCY_MEANING: Record<string, string> = {
  OD: 'once a day',
  BD: 'twice a day',
  TDS: 'three times a day',
  QID: 'four times a day',
  SOS: 'only when needed',
  HS: 'at bedtime',
}

export interface MedicineDraft {
  /** Stable key for the list while rows are added and removed. */
  key: string
  drug: string
  dose: string
  freq: string
  days: string
  instruction: string
}

export interface PrescriptionDraft {
  diagnosis: string
  complaint: string
  note: string
  meds: MedicineDraft[]
  advice: string
  /** yyyy-mm-dd, or '' for no follow-up. */
  followUp: string
}

export interface PrescriptionPayload {
  diagnosis: string
  complaint: string
  note: string
  meds: { drug: string; dose: string; freq: string; days: string; unit: string; instruction: string }[]
  advice: string
  followUp: string
}

export interface PrescriptionErrors {
  diagnosis?: string
  followUp?: string
  /** Shown above the medicine list (e.g. no medicine at all). */
  meds?: string
  /** Per row, by `MedicineDraft.key`. */
  rows: Record<string, { drug?: string; days?: string }>
}

let nextKey = 0
export const emptyMedicine = (): MedicineDraft => ({
  key: `med-${++nextKey}`,
  drug: '',
  dose: '',
  freq: 'TDS',
  days: '5',
  instruction: 'After food',
})

export const emptyPrescription = (): PrescriptionDraft => ({
  diagnosis: '',
  complaint: '',
  note: '',
  meds: [emptyMedicine()],
  advice: '',
  followUp: '',
})

/** Field-level problems; `count` is 0 when the prescription can be issued. */
export function validatePrescription(draft: PrescriptionDraft, today: string): { errors: PrescriptionErrors; count: number } {
  const errors: PrescriptionErrors = { rows: {} }
  let count = 0

  if (draft.diagnosis.trim().length < 2) {
    errors.diagnosis = draft.diagnosis.trim() ? 'Write at least 2 characters.' : 'Enter the diagnosis.'
    count += 1
  }
  if (draft.meds.length === 0) {
    errors.meds = 'Add at least one medicine.'
    count += 1
  }
  for (const med of draft.meds) {
    const row: { drug?: string; days?: string } = {}
    if (!med.drug.trim()) row.drug = 'Enter the medicine name, or remove this row.'
    if (!/^[1-9]\d{0,2}$/.test(med.days.trim())) row.days = 'Enter the number of days (1–999).'
    if (row.drug || row.days) {
      errors.rows[med.key] = row
      count += 1
    }
  }
  if (draft.followUp) {
    if (!isISODate(draft.followUp)) {
      errors.followUp = 'Choose a valid follow-up date.'
      count += 1
    } else if (draft.followUp < today) {
      errors.followUp = 'The follow-up date cannot be in the past.'
      count += 1
    }
  }
  return { errors, count }
}

/**
 * One line for a toast: the first problem from the top of the form, and how many other
 * places need fixing (they may be scrolled out of view).
 */
export function describeProblems(draft: PrescriptionDraft, errors: PrescriptionErrors, count: number): string {
  let first = 'Some fields need your attention.'
  const row = draft.meds.findIndex((m) => errors.rows[m.key])
  if (errors.diagnosis) first = `Diagnosis: ${errors.diagnosis}`
  else if (errors.meds) first = errors.meds
  else if (row >= 0) first = `Medicine ${row + 1}: ${errors.rows[draft.meds[row].key].drug ?? errors.rows[draft.meds[row].key].days}`
  else if (errors.followUp) first = `Follow-up: ${errors.followUp}`
  return count > 1 ? `${first} ${count - 1} more marked in red.` : first
}

export function toPayload(draft: PrescriptionDraft): PrescriptionPayload {
  return {
    diagnosis: draft.diagnosis.trim(),
    complaint: draft.complaint.trim(),
    note: draft.note.trim(),
    meds: draft.meds.map((m) => ({
      drug: m.drug.trim(),
      dose: m.dose.trim(),
      freq: m.freq,
      days: m.days.trim(),
      unit: 'Days',
      instruction: m.instruction,
    })),
    advice: draft.advice.trim(),
    followUp: draft.followUp,
  }
}

/** "1 tablet · TDS · 5 days · After food" */
export function medicineLine(m: { dose?: string; freq?: string; days?: string; unit?: string; instruction?: string }): string {
  const duration = m.days ? `${m.days} ${(m.unit || 'Days').toLowerCase()}` : ''
  return [m.dose, m.freq, duration, m.instruction].filter(Boolean).join(' · ')
}

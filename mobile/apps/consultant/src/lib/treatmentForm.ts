import { isISODate } from './dates'

export const TREATMENT_STATUSES = ['Planned', 'In Progress', 'Completed'] as const
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number]

export interface TreatmentDraft {
  name: string
  tooth: string
  /** yyyy-mm-dd */
  date: string
  status: TreatmentStatus
  /** Rupees as typed; empty means no charge recorded. */
  cost: string
  notes: string
}

export interface TreatmentPayload {
  name: string
  tooth: string
  date: string
  status: TreatmentStatus
  cost: number
  notes: string
}

export type TreatmentErrors = Partial<Record<'name' | 'date' | 'cost', string>>

export const emptyTreatment = (today: string): TreatmentDraft => ({
  name: '',
  tooth: '',
  date: today,
  status: 'Planned',
  cost: '',
  notes: '',
})

export function validateTreatment(draft: TreatmentDraft): TreatmentErrors {
  const errors: TreatmentErrors = {}
  if (draft.name.trim().length < 2) errors.name = draft.name.trim() ? 'Write at least 2 characters.' : 'Enter the treatment name.'
  if (!isISODate(draft.date)) errors.date = 'Choose the treatment date.'
  if (draft.cost.trim() && !/^\d{1,8}(\.\d{1,2})?$/.test(draft.cost.trim())) errors.cost = 'Enter the cost in rupees, digits only (for example 6500).'
  return errors
}

export const toTreatmentPayload = (draft: TreatmentDraft): TreatmentPayload => ({
  name: draft.name.trim(),
  tooth: draft.tooth.trim(),
  date: draft.date,
  status: draft.status,
  cost: draft.cost.trim() ? Number(draft.cost.trim()) : 0,
  notes: draft.notes.trim(),
})

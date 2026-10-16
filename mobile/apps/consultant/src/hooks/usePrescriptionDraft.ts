import { useCallback, useMemo, useState } from 'react'
import {
  describeProblems,
  emptyMedicine,
  emptyPrescription,
  validatePrescription,
  type MedicineDraft,
  type PrescriptionDraft,
  type PrescriptionErrors,
} from '@/lib/prescriptionForm'

export const MAX_MEDICINES = 20
const NO_ERRORS: PrescriptionErrors = { rows: {} }

/**
 * State of the prescription being written. Field messages appear after the first attempt
 * to continue, and then update as the consultant fixes each field.
 */
export function usePrescriptionDraft(today: string) {
  const [draft, setDraft] = useState<PrescriptionDraft>(emptyPrescription)
  const [checked, setChecked] = useState(false)

  const set = useCallback((patch: Partial<PrescriptionDraft>) => setDraft((d) => ({ ...d, ...patch })), [])
  const setMedicine = useCallback(
    (key: string, patch: Partial<MedicineDraft>) => setDraft((d) => ({ ...d, meds: d.meds.map((m) => (m.key === key ? { ...m, ...patch } : m)) })),
    [],
  )
  const addMedicine = useCallback(() => setDraft((d) => (d.meds.length >= MAX_MEDICINES ? d : { ...d, meds: [...d.meds, emptyMedicine()] })), [])
  const removeMedicine = useCallback((key: string) => setDraft((d) => ({ ...d, meds: d.meds.filter((m) => m.key !== key) })), [])

  const result = useMemo(() => validatePrescription(draft, today), [draft, today])
  /** Makes the field messages visible; returns what to tell the user, or null when all is well. */
  const validate = useCallback(() => {
    setChecked(true)
    return result.count === 0 ? null : describeProblems(draft, result.errors, result.count)
  }, [draft, result])

  const dirty =
    !!(draft.diagnosis || draft.complaint || draft.note || draft.advice || draft.followUp) ||
    draft.meds.length !== 1 ||
    !!(draft.meds[0].drug || draft.meds[0].dose)

  return { draft, errors: checked ? result.errors : NO_ERRORS, dirty, set, setMedicine, addMedicine, removeMedicine, validate }
}

export type PrescriptionDraftState = ReturnType<typeof usePrescriptionDraft>

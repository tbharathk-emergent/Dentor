import type { IconName } from '@dentor/shared'
import type { AppointmentStatus } from '@/types'

export interface StatusAction {
  to: AppointmentStatus
  label: string
  icon: IconName
  /** Past-tense message for the toast once the API has accepted the change. */
  done: string
}

const CHECK_IN: StatusAction = { to: 'Waiting', label: 'Check in', icon: 'log-in', done: 'Patient checked in' }
const COMPLETE: StatusAction = { to: 'Completed', label: 'Complete', icon: 'check', done: 'Visit completed' }
const UNDO_CHECK_IN: StatusAction = { to: 'Scheduled', label: 'Undo check-in', icon: 'rotate-ccw', done: 'Moved back to scheduled' }
export const CANCEL: StatusAction = { to: 'Cancelled', label: 'Cancel', icon: 'x', done: 'Appointment cancelled' }

/**
 * What a consultant may do next (same table as the API: Scheduled → Waiting / Completed /
 * Cancelled; Waiting → Completed / Scheduled / Cancelled; nothing after that).
 */
export function statusActions(status: string): { forward: StatusAction[]; undo: StatusAction | null; canCancel: boolean } {
  if (status === 'Scheduled') return { forward: [CHECK_IN, COMPLETE], undo: null, canCancel: true }
  if (status === 'Waiting') return { forward: [COMPLETE], undo: UNDO_CHECK_IN, canCancel: true }
  return { forward: [], undo: null, canCancel: false }
}

export const isOpen = (status: string) => status === 'Scheduled' || status === 'Waiting'

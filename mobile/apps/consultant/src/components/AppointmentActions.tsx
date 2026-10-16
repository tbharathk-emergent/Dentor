import { Button, ConfirmSheet, space, useToast } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSetAppointmentStatus } from '@/hooks/useAppointments'
import { CANCEL, statusActions, type StatusAction } from '@/lib/appointments'
import type { Appointment } from '@/types'

/**
 * The status changes allowed for an appointment right now. Renders nothing once the
 * appointment is completed or cancelled. Cancelling asks first.
 */
export function AppointmentActions({
  appointment,
  notes,
  full,
  testID,
}: {
  appointment: Pick<Appointment, 'id' | 'status' | 'patient' | 'time_label' | 'date_label'>
  /** Visit notes to store with the change (appointment screen); omit to leave them alone. */
  notes?: string
  /** Appointment screen: full-size buttons, and "Undo check-in" is offered too. */
  full?: boolean
  testID: string
}) {
  const toast = useToast()
  const change = useSetAppointmentStatus(appointment.id)
  const [confirming, setConfirming] = useState(false)
  const { forward, undo, canCancel } = statusActions(appointment.status)
  if (forward.length === 0 && !canCancel) return null

  const pendingTo = change.isPending ? change.variables?.status : null
  const run = (action: StatusAction) =>
    change.mutate(
      { status: action.to, ...(notes !== undefined ? { notes } : {}) },
      {
        onSuccess: () => toast.success(action.done),
        onError: (err) => toast.error(err),
        onSettled: () => setConfirming(false),
      },
    )

  const size = full ? 'md' : 'sm'
  const id = (action: StatusAction) => `${testID}-${action.to.toLowerCase()}`
  const main = forward[forward.length - 1]
  return (
    <View style={styles.row}>
      {forward.map((action) => (
        <Button
          key={action.to}
          testID={id(action)}
          label={action.label}
          icon={action.icon}
          size={size}
          variant={action === main ? 'primary' : 'secondary'}
          loading={pendingTo === action.to}
          disabled={change.isPending}
          onPress={() => run(action)}
          style={styles.grow}
        />
      ))}
      {full && undo && (
        <Button
          testID={id(undo)}
          label={undo.label}
          icon={undo.icon}
          size={size}
          variant="secondary"
          loading={pendingTo === undo.to}
          disabled={change.isPending}
          onPress={() => run(undo)}
          style={styles.grow}
        />
      )}
      {canCancel && (
        <Button
          testID={id(CANCEL)}
          label={CANCEL.label}
          size={size}
          variant="outline"
          disabled={change.isPending}
          onPress={() => setConfirming(true)}
          style={styles.grow}
        />
      )}
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => run(CANCEL)}
        title="Cancel this appointment?"
        message={`${appointment.patient} · ${appointment.date_label} at ${appointment.time_label}. The patient is told it was cancelled, and it cannot be reopened from the app.`}
        confirmLabel="Cancel appointment"
        danger
        loading={pendingTo === CANCEL.to}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grow: { flexGrow: 1 },
})

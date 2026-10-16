import { Button, Sheet, T, TextField, colors, useToast } from '@dentor/shared'
import { useState } from 'react'
import { useCancelAppointment } from '@/hooks/useAppointments'
import type { Appointment } from '@/types'

/** Confirms a cancellation and lets the patient tell the clinic why (optional). */
export function CancelSheet({ appointment, visible, onClose }: { appointment: Appointment; visible: boolean; onClose: () => void }) {
  const toast = useToast()
  const cancel = useCancelAppointment(appointment.id)
  const [reason, setReason] = useState('')

  const confirm = () =>
    cancel.mutate(reason.trim(), {
      onSuccess: () => {
        toast.success('Appointment cancelled')
        setReason('')
        onClose()
      },
      onError: (error) => toast.error(error),
    })

  return (
    <Sheet
      testID="cancel-sheet"
      visible={visible}
      onClose={onClose}
      title="Cancel this appointment?"
      subtitle={`${appointment.date_label} at ${appointment.time_label} with ${appointment.doctor}`}
      footer={
        <>
          <Button testID="confirm-yes" label="Cancel appointment" variant="danger" onPress={confirm} loading={cancel.isPending} full />
          <Button testID="confirm-no" label="Keep appointment" variant="ghost" onPress={onClose} disabled={cancel.isPending} full />
        </>
      }
    >
      <T color={colors.textMuted}>The time will be released for other patients. You can book a new visit at any time.</T>
      <TextField
        testID="cancel-reason"
        label="Reason (optional)"
        value={reason}
        onChangeText={setReason}
        placeholder="Let the clinic know why"
        maxLength={200}
        multiline
      />
    </Sheet>
  )
}

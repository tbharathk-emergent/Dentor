import { Banner, Button, Chip, Row, Sheet, TextField, space, useToast } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { useCancel } from '@/clinic/hooks'
import type { ClinicAppointment } from '@/clinic/types'

const REASONS = ['Patient: Personal Conflict', 'Patient unwell', 'Doctor unavailable', 'Clinic closed']

/**
 * Cancel with a reason (dentor.fig 7970:3935, 7970:4221 pop-up). The design's refund pop-up says a refund
 * "has initiated"; online payments are excluded, so an advance to return is only noted for the front desk.
 */
export function CancelSheet({ appointment, onClose, onDone }: { appointment: ClinicAppointment | null; onClose: () => void; onDone?: () => void }) {
  const toast = useToast()
  const cancel = useCancel()
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState('')
  const [error, setError] = useState<string | undefined>()
  useEffect(() => {
    setReason('')
    setRefund('')
    setError(undefined)
  }, [appointment?.id])

  const submit = () => {
    if (!appointment) return
    if (reason.trim().length < 3) return setError('Give a reason for cancelling.')
    cancel.mutate(
      { id: appointment.id, reason: reason.trim(), refund_note: refund.trim() },
      {
        onSuccess: () => {
          toast.success(`${appointment.patient}'s appointment is cancelled.${refund.trim() ? ' The refund note is saved for the front desk.' : ''}`)
          onClose()
          onDone?.()
        },
        onError: (e) => toast.error(e),
      },
    )
  }

  return (
    <Sheet
      testID="cancel-sheet"
      visible={!!appointment}
      onClose={onClose}
      title="Cancel appointment"
      subtitle={appointment ? `${appointment.patient} · ${appointment.date_label} ${appointment.time_label}` : undefined}
      footer={<Button testID="cancel-confirm" label="Cancel appointment" variant="danger" size="lg" full loading={cancel.isPending} onPress={submit} />}
    >
      <Row wrap gap={space.sm}>
        {REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </Row>
      <TextField testID="cancel-reason" label="Reason" required value={reason} onChangeText={setReason} error={error} maxLength={200} />
      <TextField testID="cancel-refund" label="Refund note (optional)" value={refund} onChangeText={setRefund} maxLength={200} placeholder="e.g. Advance of ₹500 to return at the desk" />
      <Banner tone="amber" icon="info" text="Dentor does not take online payments, so no refund is sent from the app. Return any advance at the clinic." />
    </Sheet>
  )
}

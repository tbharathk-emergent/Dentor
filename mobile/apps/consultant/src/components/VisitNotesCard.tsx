import { Button, Card, space, TextField, useToast } from '@dentor/shared'
import { useSetAppointmentStatus } from '@/hooks/useAppointments'
import type { Appointment } from '@/types'

/** Limit enforced by the API. */
const NOTES_MAX = 1000

/**
 * Visit notes for an appointment. They are stored by the status call, so "Save notes"
 * re-sends the current status with the new text; a status change saves them as well.
 */
export function VisitNotesCard({
  appointment,
  value,
  dirty,
  onChange,
  onSaved,
}: {
  appointment: Pick<Appointment, 'id' | 'status'>
  value: string
  /** True when `value` differs from what is saved. */
  dirty: boolean
  onChange: (text: string) => void
  /** Called with the text that was saved, which is not `value` if the doctor kept typing. */
  onSaved: (saved: string) => void
}) {
  const toast = useToast()
  const save = useSetAppointmentStatus(appointment.id)
  return (
    <Card style={{ gap: space.md }}>
      <TextField
        testID="visit-notes"
        label="Visit notes"
        value={value}
        onChangeText={onChange}
        placeholder="Findings, what was done, what to do next"
        multiline
        maxLength={NOTES_MAX}
        hint={dirty ? 'Not saved yet. Save the notes, or change the status below to save them with it.' : `${value.length}/${NOTES_MAX}`}
      />
      <Button
        testID="save-notes"
        label="Save notes"
        icon="save"
        variant="secondary"
        full
        disabled={!dirty}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { status: appointment.status, notes: value },
            {
              onSuccess: (_result, sent) => {
                onSaved(sent.notes ?? '')
                toast.success('Notes saved')
              },
              onError: (err) => toast.error(err),
            },
          )
        }
      />
    </Card>
  )
}

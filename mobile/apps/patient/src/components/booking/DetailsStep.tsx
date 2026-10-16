import { TextField } from '@dentor/shared'
import { ChoiceChips } from '@/components/ChoiceChips'
import { VISIT_REASONS } from '@/lib/options'

/** Step 3: why the patient is coming, and anything the dentist should know beforehand. */
export function DetailsStep({
  reason,
  notes,
  onReason,
  onNotes,
}: {
  reason: string
  notes: string
  onReason: (reason: string) => void
  onNotes: (notes: string) => void
}) {
  return (
    <>
      <ChoiceChips testID="reason" label="What is the visit for?" options={VISIT_REASONS} value={reason} onChange={onReason} clearable />
      <TextField
        testID="booking-reason"
        label="Or say it in your own words"
        value={reason}
        onChangeText={onReason}
        placeholder="e.g. Chipped front tooth"
        maxLength={120}
        hint="Left empty, the visit is booked as a consultation."
      />
      <TextField
        testID="booking-notes"
        label="Notes for the clinic (optional)"
        value={notes}
        onChangeText={onNotes}
        placeholder="Anything the dentist should know before you arrive"
        maxLength={500}
        multiline
      />
    </>
  )
}

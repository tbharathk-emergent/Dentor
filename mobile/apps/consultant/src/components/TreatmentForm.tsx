import { Card, fmtINR, space, TextField } from '@dentor/shared'
import { TREATMENT_STATUSES, type TreatmentDraft, type TreatmentErrors } from '@/lib/treatmentForm'
import type { CatalogTreatment } from '@/types'
import { ChipGroup } from './ChipGroup'
import { DateField } from './DateField'
import { SuggestField, type Suggestion } from './SuggestField'

interface TreatmentSuggestion extends Suggestion {
  price: number
}

/** The fields of "Add treatment". The screen owns the state and the submit button. */
export function TreatmentForm({
  draft,
  onChange,
  errors,
  treatments,
  today,
}: {
  draft: TreatmentDraft
  onChange: (patch: Partial<TreatmentDraft>) => void
  errors: TreatmentErrors
  treatments: CatalogTreatment[]
  today: string
}) {
  const suggestions: TreatmentSuggestion[] = treatments.map((t) => ({
    name: t.name,
    detail: [t.category, t.price ? fmtINR(t.price) : ''].filter(Boolean).join(' · '),
    price: t.price,
  }))
  return (
    <Card style={{ gap: space.lg }}>
      <SuggestField<TreatmentSuggestion>
        testID="treatment-name"
        label="Treatment"
        required
        value={draft.name}
        onChangeText={(name) => onChange({ name })}
        // Picking a treatment from the clinic's list fills in its list price.
        onPick={(s) => onChange({ cost: s.price ? String(s.price) : draft.cost })}
        suggestions={suggestions}
        placeholder="e.g. Root Canal Treatment"
        error={errors.name}
        maxLength={120}
      />
      <TextField
        testID="treatment-tooth"
        label="Tooth"
        value={draft.tooth}
        onChangeText={(tooth) => onChange({ tooth })}
        placeholder="e.g. 46, or Full mouth"
        hint="FDI tooth number or the area treated."
        maxLength={30}
      />
      <DateField testID="treatment-date" label="Date" required value={draft.date} onChange={(date) => onChange({ date })} today={today} error={errors.date} />
      <ChipGroup testID="treatment-status" label="Status" options={TREATMENT_STATUSES} value={draft.status} onChange={(status) => onChange({ status })} />
      <TextField
        testID="treatment-cost"
        label="Cost (₹)"
        value={draft.cost}
        onChangeText={(cost) => onChange({ cost: cost.replace(/[^\d.]/g, '') })}
        keyboardType="decimal-pad"
        placeholder="0"
        error={errors.cost}
        hint="Leave empty if there is no charge."
        maxLength={11}
      />
      <TextField
        testID="treatment-notes"
        label="Notes"
        value={draft.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="Anything the clinic should know"
        multiline
        maxLength={1000}
      />
    </Card>
  )
}

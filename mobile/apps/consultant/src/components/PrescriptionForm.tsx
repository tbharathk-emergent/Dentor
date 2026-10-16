import { Banner, Button, Card, Section, space, TextField } from '@dentor/shared'
import { MAX_MEDICINES, type PrescriptionDraftState } from '@/hooks/usePrescriptionDraft'
import type { CatalogMedicine } from '@/types'
import { AllergyBanner } from './AllergyBanner'
import { FollowUpPicker } from './FollowUpPicker'
import { MedicineRowEditor } from './MedicineRowEditor'

/** The editable part of "Write prescription". The screen owns the state and the buttons. */
export function PrescriptionForm({
  form,
  allergy,
  medicines,
  today,
}: {
  form: PrescriptionDraftState
  allergy: string
  medicines: CatalogMedicine[]
  today: string
}) {
  const { draft, errors } = form
  return (
    <>
      {allergy.trim() ? (
        <AllergyBanner allergy={allergy} />
      ) : (
        <Banner tone="slate" icon="info" text="No allergy is recorded for this patient. Ask before prescribing." />
      )}

      <Card style={{ gap: space.lg }}>
        <TextField
          testID="rx-diagnosis-input"
          label="Diagnosis"
          required
          value={draft.diagnosis}
          onChangeText={(diagnosis) => form.set({ diagnosis })}
          placeholder="e.g. Irreversible pulpitis · 46"
          error={errors.diagnosis}
          maxLength={200}
        />
        <TextField
          testID="rx-complaint"
          label="Complaint"
          value={draft.complaint}
          onChangeText={(complaint) => form.set({ complaint })}
          placeholder="What the patient reported"
          maxLength={200}
        />
        <TextField
          testID="rx-note"
          label="Clinical note"
          value={draft.note}
          onChangeText={(note) => form.set({ note })}
          placeholder="Findings and what was done"
          multiline
          maxLength={1000}
        />
      </Card>

      <Section title="Medicines">
        {!!errors.meds && <Banner tone="red" icon="alert-circle" text={errors.meds} />}
        {draft.meds.map((m, i) => (
          <MedicineRowEditor
            key={m.key}
            index={i}
            medicine={m}
            catalog={medicines}
            errors={errors.rows[m.key]}
            onChange={(patch) => form.setMedicine(m.key, patch)}
            onRemove={draft.meds.length > 1 ? () => form.removeMedicine(m.key) : undefined}
          />
        ))}
        <Button
          testID="rx-add-medicine"
          label={draft.meds.length >= MAX_MEDICINES ? `Limit of ${MAX_MEDICINES} medicines reached` : 'Add another medicine'}
          icon="plus"
          variant="secondary"
          full
          disabled={draft.meds.length >= MAX_MEDICINES}
          onPress={form.addMedicine}
        />
      </Section>

      <Card style={{ gap: space.lg }}>
        <TextField
          testID="rx-advice"
          label="Advice"
          value={draft.advice}
          onChangeText={(advice) => form.set({ advice })}
          placeholder="Home care and precautions"
          multiline
          maxLength={1000}
        />
        <FollowUpPicker value={draft.followUp} onChange={(followUp) => form.set({ followUp })} today={today} error={errors.followUp} />
      </Card>
    </>
  )
}

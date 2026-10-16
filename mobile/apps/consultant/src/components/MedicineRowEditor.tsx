import { Card, IconButton, space, statusTone, T, TextField } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { FREQUENCIES, FREQUENCY_MEANING, INSTRUCTIONS, type MedicineDraft } from '@/lib/prescriptionForm'
import type { CatalogMedicine } from '@/types'
import { ChipGroup } from './ChipGroup'
import { SuggestField, type Suggestion } from './SuggestField'

/** The stock status as the reception app's Pharmacy page names it. */
const OUT_OF_STOCK = 'Out of Stock'

const toSuggestion = (m: CatalogMedicine): Suggestion => ({
  name: m.name,
  detail: m.form,
  flag: m.in_stock ? undefined : { label: OUT_OF_STOCK, tone: statusTone(OUT_OF_STOCK) },
})

/** One medicine on a prescription being written. */
export function MedicineRowEditor({
  index,
  medicine,
  onChange,
  onRemove,
  catalog,
  errors,
}: {
  index: number
  medicine: MedicineDraft
  onChange: (patch: Partial<MedicineDraft>) => void
  /** Omit when this is the only row: a prescription needs at least one medicine. */
  onRemove?: () => void
  catalog: CatalogMedicine[]
  errors?: { drug?: string; days?: string }
}) {
  const id = `med-${index}`
  return (
    <Card testID={id} style={{ gap: space.lg }}>
      <View style={styles.header}>
        <T variant="h3" style={{ flex: 1 }}>{`Medicine ${index + 1}`}</T>
        {onRemove && <IconButton testID={`${id}-remove`} icon="trash-2" label={`Remove medicine ${index + 1}`} onPress={onRemove} />}
      </View>
      <SuggestField
        testID={`${id}-drug`}
        label="Medicine"
        required
        value={medicine.drug}
        onChangeText={(drug) => onChange({ drug })}
        suggestions={catalog.map(toSuggestion)}
        placeholder="Name and strength, e.g. Amoxicillin 500mg"
        error={errors?.drug}
        maxLength={120}
      />
      <View style={styles.pair}>
        <View style={styles.dose}>
          <TextField testID={`${id}-dose`} label="Dose" value={medicine.dose} onChangeText={(dose) => onChange({ dose })} placeholder="1 tablet" maxLength={60} autoCapitalize="none" />
        </View>
        <View style={styles.days}>
          <TextField testID={`${id}-days`} label="Days" value={medicine.days} onChangeText={(days) => onChange({ days: days.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} error={errors?.days} />
        </View>
      </View>
      <ChipGroup
        testID={`${id}-freq`}
        label="Frequency"
        options={FREQUENCIES}
        value={medicine.freq as (typeof FREQUENCIES)[number]}
        onChange={(freq) => onChange({ freq })}
        hint={FREQUENCY_MEANING[medicine.freq] ? `${medicine.freq}: ${FREQUENCY_MEANING[medicine.freq]}` : undefined}
      />
      <ChipGroup
        testID={`${id}-instruction`}
        label="Instruction"
        options={INSTRUCTIONS}
        value={medicine.instruction as (typeof INSTRUCTIONS)[number]}
        onChange={(instruction) => onChange({ instruction })}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  // Wraps to two rows when the pair cannot sit side by side (narrow phone showing an error).
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  dose: { flexGrow: 2, flexBasis: 150, minWidth: 0 },
  days: { flexGrow: 1, flexBasis: 90, minWidth: 0 },
})

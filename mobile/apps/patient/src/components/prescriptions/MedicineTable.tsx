import { Divider, T, colors, space } from '@dentor/shared'
import { Fragment } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Medicine } from '@/types'

const duration = (med: Medicine) => [med.days, med.unit].filter(Boolean).join(' ')

/** Medicines as a compact table: what to take, how much, how often and for how long. */
export function MedicineTable({ meds }: { meds: Medicine[] }) {
  return (
    <View testID="medicine-table">
      <View style={styles.row}>
        <T variant="tiny" color={colors.textMuted} style={styles.drug}>MEDICINE</T>
        <T variant="tiny" color={colors.textMuted} style={styles.dose}>DOSE</T>
        <T variant="tiny" color={colors.textMuted} style={styles.freq}>WHEN</T>
        <T variant="tiny" color={colors.textMuted} style={styles.days}>FOR</T>
      </View>
      {meds.map((med, index) => (
        <Fragment key={`${med.drug}-${index}`}>
          <Divider />
          <View testID="medicine-row" style={styles.row}>
            <View style={styles.drug}>
              <T variant="smallStrong">{med.drug}</T>
              {!!med.instruction && <T variant="small" color={colors.textMuted}>{med.instruction}</T>}
            </View>
            <T variant="small" style={styles.dose}>{med.dose || '—'}</T>
            <T variant="small" style={styles.freq}>{med.freq || '—'}</T>
            <T variant="small" style={styles.days}>{duration(med) || '—'}</T>
          </View>
        </Fragment>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  drug: { flex: 2.4, minWidth: 0 },
  dose: { flex: 1.3 },
  freq: { flex: 1 },
  days: { flex: 1.2, textAlign: 'right' },
})

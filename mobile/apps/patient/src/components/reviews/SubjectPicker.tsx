import { Chip, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { useDoctors } from '@/hooks/useAppointments'

/** What the review is about: the clinic as a whole, or one of its doctors. */
export const CLINIC_SUBJECT = 'clinic'

export function SubjectPicker({ value, onChange }: { value: string; onChange: (subject: string) => void }) {
  const doctors = useDoctors()
  return (
    <View style={styles.wrap}>
      <T variant="smallStrong">Who is your review about?</T>
      <View style={styles.chips}>
        <Chip testID="subject-clinic" label="The clinic" selected={value === CLINIC_SUBJECT} onPress={() => onChange(CLINIC_SUBJECT)} />
        {doctors.data?.items.map((doctor) => (
          <Chip key={doctor.id} testID={`subject-${doctor.id}`} label={doctor.name} selected={value === doctor.name} onPress={() => onChange(doctor.name)} />
        ))}
      </View>
      {doctors.isLoading && <T variant="small" color={colors.textMuted}>Loading the clinic's doctors…</T>}
      {doctors.isError && (
        <T variant="small" color={colors.textMuted}>The doctors could not be loaded. You can still review the clinic.</T>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})

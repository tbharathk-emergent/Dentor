import { Card, Divider, KeyValue, T, colors, fmtDate, fmtDayShort, fmtTime, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { Clinic } from '@/types'

/** The visit as it will be (or was) booked — shown on the review step and on the success screen. */
export function BookingSummary({
  doctor,
  date,
  time,
  reason,
  notes,
  clinic,
}: {
  doctor: string
  date: string
  time: string
  reason: string
  notes?: string
  clinic?: Clinic
}) {
  return (
    <Card testID="booking-summary" style={styles.card}>
      <View>
        <KeyValue label="Doctor" value={doctor} strong />
        <KeyValue label="Date" value={`${fmtDayShort(date).dow}, ${fmtDate(date)}`} strong />
        <KeyValue label="Time" value={fmtTime(time)} strong />
        <KeyValue label="Visit for" value={reason} />
        {!!notes && <KeyValue label="Notes" value={notes} />}
      </View>
      {clinic && (
        <>
          <Divider />
          <View style={styles.clinic}>
            <T variant="smallStrong">{clinic.name}</T>
            {!!clinic.address && <T variant="small" color={colors.textMuted}>{clinic.address}</T>}
          </View>
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  clinic: { gap: 2 },
})

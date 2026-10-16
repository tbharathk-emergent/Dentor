import { Banner, Card, Icon, KeyValue, StatusBadge, T, colors, fmtDayShort, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { ClinicContact } from '@/components/ClinicContact'
import type { Appointment, Clinic } from '@/types'

/** Everything about one visit: when, with whom, where, and whether it can still be changed in the app. */
export function AppointmentDetails({ appointment, clinic }: { appointment: Appointment; clinic?: Clinic }) {
  const locked = appointment.upcoming && !appointment.can_cancel && !appointment.can_reschedule
  return (
    <>
      <Card style={styles.hero}>
        <View style={styles.head}>
          <T variant="tiny" color={colors.brand100} testID="appointment-code">{appointment.code}</T>
          <View testID="appointment-status">
            <StatusBadge status={appointment.status} />
          </View>
        </View>
        <T variant="h1" color={colors.onBrand}>{appointment.treatment || 'Appointment'}</T>
        <T color={colors.brand100}>{appointment.doctor}</T>
        <View style={styles.when}>
          <Fact icon="calendar" text={`${fmtDayShort(appointment.date).dow}, ${appointment.date_label}`} testID="appointment-date" />
          <Fact icon="clock" text={appointment.time_label} testID="appointment-time" />
        </View>
      </Card>

      {locked && (
        <Banner tone="amber" icon="info" text="This visit can no longer be changed in the app. To reschedule or cancel, please call the clinic." />
      )}
      {appointment.status === 'Cancelled' && !!appointment.cancelReason && (
        <Banner tone="slate" icon="x-circle" text={`Cancelled: ${appointment.cancelReason}`} />
      )}

      <Card>
        <KeyValue label="Doctor" value={appointment.doctor} />
        <KeyValue label="Duration" value={appointment.duration} />
        <KeyValue label="Chair" value={appointment.chair} />
        <KeyValue label="Notes" value={appointment.notes} />
      </Card>

      {clinic && (
        <Card style={styles.clinic}>
          <View style={styles.clinicText}>
            <T variant="bodyStrong">{clinic.name}</T>
            {!!clinic.address && <T variant="small" color={colors.textMuted}>{clinic.address}</T>}
          </View>
          <ClinicContact phone={clinic.phone} testID="appointment-clinic" />
        </Card>
      )}
    </>
  )
}

function Fact({ icon, text, testID }: { icon: 'calendar' | 'clock'; text: string; testID: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={colors.brand100} />
      <T variant="bodyStrong" color={colors.onBrand} testID={testID}>{text}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { gap: space.xs, backgroundColor: colors.brand800, borderColor: colors.brand800 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  when: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.xs, marginTop: space.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  clinic: { gap: space.md },
  clinicText: { gap: 2 },
})

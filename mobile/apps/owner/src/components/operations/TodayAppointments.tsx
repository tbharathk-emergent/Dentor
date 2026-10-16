import { Badge, Card, EmptyState, Section, StatusBadge, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { ExpandableList } from '@/components/ExpandableList'
import type { TodayAppointment } from '@/types'

/** The value the API puts in `source` when the patient booked the appointment themselves. */
const PATIENT_APP = 'Patient App'

/** Time and status on the first line so the patient's name and the details get the full width. */
function AppointmentRow({ appointment }: { appointment: TodayAppointment }) {
  return (
    <View testID="today-appointment" style={styles.row}>
      <View style={styles.heading}>
        <T variant="smallStrong" color={colors.brand800} numberOfLines={1} style={{ flexShrink: 1 }}>
          {appointment.time_label || appointment.time || 'No time set'}
        </T>
        <View style={styles.badges}>
          {appointment.source === PATIENT_APP && <Badge testID="booked-in-app" label="App booking" tone="violet" />}
          <StatusBadge status={appointment.status} />
        </View>
      </View>
      <T variant="bodyStrong" numberOfLines={1}>
        {appointment.patient || 'Unnamed patient'}
      </T>
      <T variant="small" color={colors.textMuted} numberOfLines={2}>
        {[appointment.treatment, appointment.doctor, appointment.chair].filter(Boolean).join(' · ')}
      </T>
    </View>
  )
}

export function TodayAppointments({ appointments }: { appointments: TodayAppointment[] }) {
  return (
    <Section title={appointments.length ? `Today's appointments · ${appointments.length}` : "Today's appointments"}>
      <Card padded={false} testID="today-appointments">
        {appointments.length === 0 ? (
          <EmptyState testID="today-appointments-empty" icon="calendar" title="No appointments today" message="Bookings made at the front desk or in the patient app appear here." />
        ) : (
          <ExpandableList
            testID="today-appointments-list"
            initial={8}
            items={appointments}
            keyOf={(appointment) => appointment.id}
            render={(appointment) => <AppointmentRow appointment={appointment} />}
          />
        )}
      </Card>
    </Section>
  )
}

const styles = StyleSheet.create({
  row: { gap: 2, paddingVertical: space.md, paddingHorizontal: space.lg },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 24 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 },
})

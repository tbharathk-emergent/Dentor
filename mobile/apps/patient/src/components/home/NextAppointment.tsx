import { Button, Card, Icon, StatusBadge, T, ToothMark, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { useRouter } from '@/nav'
import type { Appointment } from '@/types'

/** The patient's next visit, or an invitation to book the first one. */
export function NextAppointment({ appointment, upcomingCount }: { appointment: Appointment | null; upcomingCount: number }) {
  const router = useRouter()

  if (!appointment) {
    return (
      <Card testID="home-no-appointment" style={styles.empty}>
        <ToothMark size={56} />
        <View style={styles.emptyText}>
          <T variant="h3">Book your first visit</T>
          <T variant="small" color={colors.textMuted}>Choose a doctor and a time that suits you.</T>
        </View>
        <Button testID="home-book" label="Book an appointment" icon="calendar" onPress={() => router.push('/book')} full />
      </Card>
    )
  }

  const more = upcomingCount - 1
  return (
    <Card
      testID="home-next-appointment"
      onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: appointment.id } })}
      style={styles.card}
    >
      <View style={styles.head}>
        <T variant="tiny" color={colors.brand100} style={styles.caps}>NEXT APPOINTMENT</T>
        <StatusBadge status={appointment.status} />
      </View>
      <T variant="h2" color={colors.onBrand} numberOfLines={2} testID="home-next-treatment">{appointment.treatment || 'Appointment'}</T>
      <T color={colors.brand100} numberOfLines={1}>{appointment.doctor}</T>
      <View style={styles.when}>
        <Fact icon="calendar" text={appointment.date_label} testID="home-next-date" />
        <Fact icon="clock" text={appointment.time_label} testID="home-next-time" />
      </View>
      {more > 0 && (
        <T variant="small" color={colors.brand100}>
          and {more} more upcoming {more === 1 ? 'visit' : 'visits'}
        </T>
      )}
    </Card>
  )
}

function Fact({ icon, text, testID }: { icon: 'calendar' | 'clock'; text: string; testID: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={15} color={colors.brand100} />
      <T variant="bodyStrong" color={colors.onBrand} testID={testID}>{text}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.xs, backgroundColor: colors.brand800, borderColor: colors.brand800 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  caps: { letterSpacing: 0.6 },
  when: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.xs, marginTop: space.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  empty: { alignItems: 'center', gap: space.md },
  emptyText: { alignItems: 'center', gap: 2 },
})

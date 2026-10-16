import { Icon, StatusBadge, colors, fmtDate, space } from '@dentor/shared'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Appointment } from '@/types'

/**
 * One visit as the design lists it (frame "upcoming" 76:2423): a white card, radius 10, with a
 * hairline outline and the drop shadow; the treatment and the doctor in bold 16, the status on
 * the right, and "📅 date | ⏰ time" in 14, #666666. Dates keep the app's "05 Mar 2026" form,
 * which all four apps share (the design writes "5 March 2026").
 */
export function AppointmentCard({ appointment, onPress, testID }: { appointment: Appointment; onPress?: () => void; testID?: string }) {
  const body = (
    <>
      <View style={styles.top}>
        <Text numberOfLines={1} style={styles.title}>{appointment.treatment || 'Appointment'}</Text>
        <StatusBadge status={appointment.status} />
      </View>
      <View style={styles.bottom}>
        <Text numberOfLines={2} style={styles.doctor}>{appointment.doctor}</Text>
        <Text style={styles.when} testID={testID ? `${testID}-time` : undefined}>
          {`📅 ${fmtDate(appointment.date)} | ⏰ ${appointment.time_label}`}
        </Text>
      </View>
    </>
  )
  if (!onPress) return <View testID={testID} style={styles.card}>{body}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      {body}
      <View style={styles.chevron}>
        <Icon name="chevron-right" size={16} color={colors.textFaint} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 6, paddingVertical: 10, paddingLeft: 12, paddingRight: 26, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#000000',
    backgroundColor: '#ffffff', shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, minWidth: 0, fontFamily: 'NotoSans-Bold', fontSize: 16, lineHeight: 21, color: '#000000' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  doctor: { flexShrink: 1, fontFamily: 'NotoSans-Bold', fontSize: 15, lineHeight: 20, color: '#000000' },
  when: { marginLeft: 'auto', fontFamily: 'NotoSans-Regular', fontSize: 13, lineHeight: 18, color: '#666666' },
  chevron: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' },
})

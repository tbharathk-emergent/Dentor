import { Badge, StatusBadge, T, colors, face, radius, space } from '@dentor/shared'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ClinicAppointment } from '@/clinic/types'

/**
 * An appointment as the design's lists draw it (dentor.fig 7970:3530, 7970:3817, 7970:3935): the
 * patient, "Treatment:", the doctor and time, the IN-HOUSE / DENTOR tag, the status, the original and
 * new dates once rescheduled, the reason once cancelled, and Reschedule / Cancel while it can change.
 */
export function AppointmentCard({ appointment: a, onPress, onReschedule, onCancel, showDate }: {
  appointment: ClinicAppointment
  onPress?: () => void
  onReschedule?: () => void
  onCancel?: () => void
  showDate?: boolean
}) {
  const actions = a.changeable && (onReschedule || onCancel)
  return (
    <View style={styles.card}>
      <Pressable testID={`appointment-${a.id}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [{ gap: space.sm }, pressed && { opacity: 0.85 }]}>
      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.name}>{a.patient}</Text>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>Treatment: {a.treatment}</T>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>{a.doctor}{a.chair ? ` · ${a.chair}` : ''}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.time}>{a.status === 'Draft' && !a.time ? 'No time yet' : a.time_label}</Text>
          {(showDate || a.status === 'Draft') && !!a.date && <T variant="tiny" color={colors.textMuted}>{a.date_label}</T>}
          <Badge label={a.kind === 'consultant' ? 'DENTOR' : 'IN-HOUSE'} tone={a.kind === 'consultant' ? 'violet' : 'slate'} />
        </View>
      </View>
      {!!a.rescheduled_from && (
        <View testID="rescheduled-dates" style={styles.dates}>
          <View style={{ flex: 1 }}>
            <T variant="tiny" color={colors.textMuted}>ORIGINAL DATE</T>
            <T variant="smallStrong" style={styles.struck}>{a.rescheduled_from.date_label} · {a.rescheduled_from.time_label}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="tiny" color={colors.textMuted}>NEW DATE</T>
            <T variant="smallStrong">{a.date_label} · {a.time_label}</T>
          </View>
        </View>
      )}
      {a.status === 'Cancelled' && !!a.cancel_reason && (
        <T variant="small" color={colors.red}>Reason: {a.cancel_reason}</T>
      )}
      </Pressable>
      <View style={styles.bottom}>
        <StatusBadge status={a.rescheduled_from && a.status === 'Scheduled' ? 'Rescheduled' : a.status} />
        {actions ? (
          <View style={styles.actions}>
            {onReschedule && (
              <Pressable testID={`reschedule-${a.id}`} accessibilityRole="button" hitSlop={6} onPress={onReschedule} style={[styles.pill, styles.pillFill]}>
                <Text style={[styles.pillText, { color: '#ffffff' }]}>{a.status === 'Draft' ? 'Book' : 'Reschedule'}</Text>
              </Pressable>
            )}
            {onCancel && (
              <Pressable testID={`cancel-${a.id}`} accessibilityRole="button" hitSlop={6} onPress={onCancel} style={styles.pill}>
                <Text style={styles.pillText}>{a.status === 'Draft' ? 'Delete' : 'Cancel'}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: 'row', gap: space.md },
  name: { ...face('semibold'), fontSize: 16, lineHeight: 22, color: colors.textStrong },
  time: { ...face('semibold'), fontSize: 14, lineHeight: 20, color: colors.title },
  dates: { flexDirection: 'row', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.slateBg },
  struck: { textDecorationLine: 'line-through' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: space.sm },
  pill: { minHeight: 32, paddingHorizontal: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  pillFill: { backgroundColor: colors.header },
  pillText: { ...face('semibold'), fontSize: 13, color: colors.header },
})

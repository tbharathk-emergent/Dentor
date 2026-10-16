import { Card, colors, Divider, font, radius, space, StatusBadge, T, face } from '@dentor/shared'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { shortDate } from '@/lib/dates'
import { dotJoin } from '@/lib/people'
import type { Appointment } from '@/types'

/**
 * One appointment: time, patient, treatment, chair and status. Tapping the summary opens
 * the appointment; `children` (quick actions) sit below it and are not part of the tap area.
 */
export function AppointmentCard({
  appointment: a,
  onPress,
  showDate,
  highlight,
  testID,
  children,
}: {
  appointment: Appointment
  onPress?: () => void
  /** Adds the day to the details line (for lists that span several days). */
  showDate?: boolean
  /** Brand-tinted card for the "Next up" slot. */
  highlight?: boolean
  testID?: string
  children?: ReactNode
}) {
  const [clock, meridiem] = a.time_label.split(' ')
  return (
    <Card padded={false} testID={testID} style={[styles.card, highlight && styles.highlight]}>
      <Pressable
        testID={testID ? `${testID}-open` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${a.time_label}, ${a.patient}, ${a.treatment || 'Appointment'}, ${a.status}`}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.summary, !children && styles.summaryAlone, pressed && { backgroundColor: colors.slateBg }]}
      >
        <View style={[styles.time, highlight && { backgroundColor: colors.surface }]}>
          <Text numberOfLines={1} style={[font.bodyStrong, { color: colors.brand800 }]}>{clock}</Text>
          {!!meridiem && <Text style={[font.tiny, { color: colors.brand700 }]}>{meridiem}</Text>}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <T variant="bodyStrong" numberOfLines={1} style={styles.name} testID={testID ? `${testID}-patient` : undefined}>{a.patient}</T>
            <View testID={testID ? `${testID}-status` : undefined}>
              <StatusBadge status={a.status} />
            </View>
          </View>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>{a.treatment || 'Appointment'}</T>
          <T variant="tiny" color={colors.textFaint} numberOfLines={1} style={styles.meta}>
            {dotJoin(showDate && shortDate(a.date), a.chair, a.duration) || a.date_label}
          </T>
        </View>
      </Pressable>
      {children ? (
        <>
          <Divider />
          <View style={styles.extra}>{children}</View>
        </>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  // design ("MY APPOINTMENT" 3973:52803): a gold stripe down the left edge of each appointment
  card: { borderLeftWidth: 6, borderLeftColor: colors.accent },
  highlight: { backgroundColor: colors.brand50, borderColor: colors.brand200, borderLeftColor: colors.accent },
  // The tap area follows the card's rounded corners itself: clipping the card would cut off its shadow on iOS.
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
    borderTopLeftRadius: radius.lg - 1, borderTopRightRadius: radius.lg - 1,
  },
  summaryAlone: { borderBottomLeftRadius: radius.lg - 1, borderBottomRightRadius: radius.lg - 1 },
  time: { width: 58, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, minWidth: 0 },
  meta: { ...face('medium') },
  extra: { padding: space.md, gap: space.sm },
})

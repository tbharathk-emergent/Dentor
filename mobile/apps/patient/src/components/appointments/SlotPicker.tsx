import { Banner, EmptyState, QueryState, Skeleton, T, colors, fmtDate, space } from '@dentor/shared'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { DateStrip } from '@/components/appointments/DateStrip'
import { SlotGrid } from '@/components/appointments/SlotGrid'
import { useSlots } from '@/hooks/useAppointments'
import { upcomingDays } from '@/lib/dates'

/**
 * Date strip plus that day's slots for one doctor. Used to book and to reschedule.
 * `notice` carries a message such as "that slot was just taken" above the grid.
 */
export function SlotPicker({
  doctor,
  date,
  time,
  onDate,
  onTime,
  notice,
}: {
  doctor: string
  date: string
  time: string
  onDate: (date: string) => void
  onTime: (time: string) => void
  notice?: string | null
}) {
  const dates = useMemo(() => upcomingDays(), [])
  const slots = useSlots(doctor, date)

  return (
    <View style={styles.wrap}>
      <DateStrip dates={dates} value={date} onChange={onDate} />
      <T variant="smallStrong" color={colors.textMuted}>Times on {fmtDate(date)}</T>
      {!!notice && <Banner tone="amber" icon="alert-circle" text={notice} />}
      <QueryState query={slots} skeleton={<SlotSkeleton />}>
        {(data) =>
          data.slots.some((slot) => slot.available) ? (
            <SlotGrid slots={data.slots} value={time} onChange={onTime} />
          ) : (
            <EmptyState testID="slots-empty" icon="calendar" title="No free times on this day" message="Pick another date from the row above." />
          )
        }
      </QueryState>
    </View>
  )
}

function SlotSkeleton() {
  return (
    <View testID="loading" style={styles.skeleton}>
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} height={44} width="30%" style={styles.skeletonSlot} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  skeletonSlot: { flexGrow: 1 },
})

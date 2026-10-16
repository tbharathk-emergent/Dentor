import { EmptyState, ListRow, QueryState, Screen, StatusBadge, T, colors, space, todayISO } from '@dentor/shared'
import { View } from 'react-native'
import { useConsultRequests } from '@/clinic/consult'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

/**
 * "TRACKING" (dentor.fig 274–275): today's consultant visits and where each consultant is — booked, on the way,
 * running late, arrived, started, completed. A live map needs a maps service and the consultant's location
 * (not part of this version); the statuses come from the Consultant app.
 */
export default function Tracking() {
  const router = useRouter()
  const list = useConsultRequests('active')
  const { refreshing, refresh } = useRefresh(list)
  const today = todayISO()
  return (
    <Screen testID="tracking-screen" title="Tracking" back refreshing={refreshing} onRefresh={refresh}>
      <T variant="smallStrong">Today's Schedule</T>
      <QueryState query={list}>
        {(data) => {
          const items = data.items.filter((b) => b.date === today)
          return items.length ? (
            <View style={{ gap: space.xs }}>
              {items.map((b) => (
                <ListRow key={b.id} testID={`track-${b.id}`} title={`${b.consultant} · ${b.treatment}`} subtitle={`${b.patient} · ${b.time_label}`}
                  meta={b.timeline.length ? `${b.timeline[b.timeline.length - 1].status}${b.late_minutes && b.status === 'Running late' ? ` · ${b.late_minutes} min` : ''}` : ''}
                  right={<StatusBadge status={b.status} />} chevron onPress={() => router.push({ pathname: '/consult/[id]', params: { id: b.id } })} />
              ))}
            </View>
          ) : <EmptyState icon="navigation" title="No consultant visits today" message="Confirmed visits for today appear here with the consultant's status." />
        }}
      </QueryState>
      <T variant="tiny" color={colors.textMuted}>Live map tracking is not part of this version.</T>
    </Screen>
  )
}

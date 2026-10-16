import { Card, colors, EmptyState, QueryState, Screen, Section, space, StaffHeader, T, useNotifications, useSession } from '@dentor/shared'
import { Pressable, View } from 'react-native'
import { AppointmentActions } from '@/components/AppointmentActions'
import { AppointmentCard } from '@/components/AppointmentCard'
import { NextUpCard } from '@/components/NextUpCard'
import { ScheduleTiles } from '@/components/ScheduleTiles'
import { useDashboard } from '@/hooks/useDashboard'
import { useRequests } from '@/hooks/useRequests'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { isOpen } from '@/lib/appointments'
import { longDate } from '@/lib/dates'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

export default function Today() {
  const router = useRouter()
  const { data: session } = useSession<StaffSession>()
  const dashboard = useDashboard()
  const notifications = useNotifications('/api')
  // dentor.fig "Home" 6933:11981: "5 Pending Appointments" from clinics, to confirm
  const pending = useRequests('pending')
  const waiting = pending.data?.counts.pending ?? 0
  const reload = () => Promise.all([dashboard.refetch(), notifications.refetch(), pending.refetch()])
  useRefetchOnFocus(reload)
  const pull = usePullToRefresh(reload)

  const d = dashboard.data
  const name = d?.profile.name ?? session?.user?.name ?? ''
  const open = (id: string) => router.push({ pathname: '/appointments/[id]', params: { id } })

  return (
    <Screen
      testID="screen-today"
      header={
        <StaffHeader
          name={name}
          code={d?.profile.code}
          unread={notifications.data?.unread}
          onBell={() => router.push('/notifications')}
          onSettings={() => router.push('/profile')}
        />
      }
      {...pull}
    >
      <QueryState query={dashboard}>
        {(data) => (
          <>
            <T variant="small" color={colors.textMuted} testID="today-date">{longDate(data.date)}</T>
            {waiting > 0 && (
              <Card testID="pending-requests">
                <Pressable accessibilityRole="button" onPress={() => router.push('/requests')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <T variant="bodyStrong" style={{ flex: 1 }}>{waiting} Pending Appointment{waiting === 1 ? '' : 's'}</T>
                  <T variant="smallStrong" color={colors.title}>Review</T>
                </Pressable>
              </Card>
            )}
            <ScheduleTiles
              big={[
                { key: 'total', label: "Today's Schedule", value: data.total },
                { key: 'waiting', label: 'Waiting now', value: data.by_status.Waiting ?? 0 },
              ]}
              small={[
                { key: 'completed', label: 'Completed', value: data.by_status.Completed ?? 0, dot: '#088f47' },
                { key: 'cancelled', label: 'Cancelled', value: data.by_status.Cancelled ?? 0, dot: '#ff8f05' },
              ]}
            />
            <Section title="Next up">
              {data.next ? (
                <NextUpCard appointment={data.next} onOpen={() => open(data.next!.id)} />
              ) : (
                <Card testID="next-up-none">
                  <T variant="small" color={colors.textMuted}>
                    {data.total === 0 ? 'Nothing is booked with you today.' : 'No one is left to see today. Every appointment is completed or cancelled.'}
                  </T>
                </Card>
              )}
            </Section>

            <Section title="Today's appointments">
              {data.today.length === 0 ? (
                <EmptyState testID="today-empty" icon="calendar" title="No appointments today" message="Appointments booked with you for today appear here, in time order." />
              ) : (
                <View testID="today-list" style={{ gap: space.md }}>
                  {data.today.map((a) => (
                    <AppointmentCard key={a.id} testID={`appt-${a.id}`} appointment={a} onPress={() => open(a.id)}>
                      {isOpen(a.status) && <AppointmentActions appointment={a} testID={`appt-${a.id}`} />}
                    </AppointmentCard>
                  ))}
                </View>
              )}
            </Section>

            <Section title="Upcoming">
              {data.upcoming.length === 0 ? (
                <Card testID="upcoming-empty">
                  <T variant="small" color={colors.textMuted}>No appointments are booked with you after today.</T>
                </Card>
              ) : (
                <View testID="upcoming-list" style={{ gap: space.md }}>
                  {data.upcoming.map((a) => (
                    <AppointmentCard key={a.id} testID={`upcoming-${a.id}`} appointment={a} showDate onPress={() => open(a.id)} />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}
      </QueryState>
    </Screen>
  )
}

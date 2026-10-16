import { Card, Divider, IconTile, ListRow, QueryState, Screen, Section, fmtINR, space, useNotifications, useSession } from '@dentor/shared'
import { View } from 'react-native'
import { CountBreakdown } from '@/components/CountBreakdown'
import { PeriodControl } from '@/components/PeriodControl'
import { DailyChart } from '@/components/overview/DailyChart'
import { OverviewKpis } from '@/components/overview/OverviewKpis'
import { TodayStrip } from '@/components/overview/TodayStrip'
import { useOverview } from '@/hooks/useOverview'
import { usePeriod } from '@/hooks/usePeriod'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

const APPOINTMENT_STATUS_ORDER = ['Scheduled', 'Waiting', 'Completed', 'Cancelled']
const TILE = 44
const ROW_INSET = space.lg + TILE + space.md

export default function OverviewScreen() {
  const router = useRouter()
  const { data: session } = useSession<StaffSession>()
  const period = usePeriod()
  const overview = useOverview(period.range)
  const notifications = useNotifications('/api')
  const { refreshing, refresh } = useRefresh(overview, notifications)
  const openFinance = () => router.push('/finance')

  return (
    <Screen
      testID="overview-screen"
      title="Clinic Overview"
      subtitle={session?.user?.clinic?.name}
      back
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <TodayStrip date={overview.data?.today} summary={overview.data?.today_summary} />
      <PeriodControl scope="overview" updating={overview.isPlaceholderData} />

      <QueryState query={overview}>
        {(data) => (
          <View style={{ gap: space.lg, opacity: overview.isPlaceholderData ? 0.5 : 1 }}>
            {data.money ? (
              <OverviewKpis data={data} onOpenFinance={openFinance} />
            ) : (
              <Card testID="kpi-activity">
                <CountBreakdown testID="activity-figures" counts={{ Appointments: data.appointments, 'New patients': data.patients_new, 'Patients in all': data.patients_total }} order={['Appointments', 'New patients', 'Patients in all']} emptyText="" />
              </Card>
            )}
            {data.money && <DailyChart
              testID="chart-collections"
              title="Collections by day"
              days={data.series.map((day) => ({ label: day.label, value: day.collected }))}
              format={fmtINR}
              emptyText="No payments were received in this period."
            />}
            <DailyChart
              testID="chart-appointments"
              title="Appointments by day"
              days={data.series.map((day) => ({ label: day.label, value: day.appointments }))}
              emptyText="No appointments were booked in this period."
            />
            <Section title="Appointments by status">
              <Card>
                <CountBreakdown
                  testID="appointments-by-status"
                  counts={data.appointments_by_status}
                  order={APPOINTMENT_STATUS_ORDER}
                  emptyText="No appointments were booked in this period."
                />
              </Card>
            </Section>
          </View>
        )}
      </QueryState>

      <Section title="Look closer">
        <Card padded={false}>
          {overview.data?.money !== false && <ListRow
            testID="link-finance"
            left={<IconTile icon="trending-up" tone="green" size={TILE} />}
            title="Finance"
            subtitle="Revenue by doctor and treatment, outstanding invoices, payments"
            chevron
            onPress={openFinance}
          />}
          {overview.data?.money !== false && <Divider inset={ROW_INSET} />}
          <ListRow
            testID="link-operations"
            left={<IconTile icon="activity" tone="blue" size={TILE} />}
            title="Operations"
            subtitle="Today's appointments, lab orders, low stock, leads, reviews"
            chevron
            onPress={() => router.push('/operations')}
          />
        </Card>
      </Section>
    </Screen>
  )
}

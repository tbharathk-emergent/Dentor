import { QueryState, Screen, fmtDate, space } from '@dentor/shared'
import { View } from 'react-native'
import { LabOrders } from '@/components/operations/LabOrders'
import { LeadsCard } from '@/components/operations/LeadsCard'
import { LowStock } from '@/components/operations/LowStock'
import { ReviewsCard } from '@/components/operations/ReviewsCard'
import { TodayAppointments } from '@/components/operations/TodayAppointments'
import { useOperations } from '@/hooks/useOperations'
import { useRefresh } from '@/hooks/useRefresh'

export default function OperationsScreen() {
  const operations = useOperations()
  const { refreshing, refresh } = useRefresh(operations)

  return (
    <Screen
      testID="operations-screen"
      title="Operations"
      subtitle={operations.data ? `Today · ${fmtDate(operations.data.today)}` : 'Today'}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <QueryState query={operations}>
        {(data) => (
          <View style={{ gap: space.lg }}>
            <TodayAppointments appointments={data.appointments} />
            <LabOrders lab={data.lab} />
            <LowStock pharmacy={data.pharmacy_low} inventory={data.inventory_low} />
            <LeadsCard leads={data.leads} />
            <ReviewsCard reviews={data.reviews} />
          </View>
        )}
      </QueryState>
    </Screen>
  )
}

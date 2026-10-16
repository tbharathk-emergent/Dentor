import { EmptyState, ListRow, QueryState, Screen, Segmented, StatusBadge, space, stripeColors } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useLabOrders } from '@/clinic/clinical'
import { useRefresh } from '@/hooks/useRefresh'

/** "Ongoing Cases": lab orders in progress and delivered, with their stage and due date. */
export default function LabOrders() {
  const [scope, setScope] = useState<'ongoing' | 'completed'>('ongoing')
  const orders = useLabOrders(scope)
  const { refreshing, refresh } = useRefresh(orders)
  return (
    <Screen pattern testID="lab-orders-screen" title="Lab Cases" back refreshing={refreshing} onRefresh={refresh}>
      <Segmented options={[{ key: 'ongoing', label: 'Ongoing' }, { key: 'completed', label: 'Completed' }]} value={scope} onChange={setScope} />
      <QueryState query={orders}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((o) => (
              <ListRow key={o.id} stripe={['Ready', 'Delivered', 'Completed'].includes(o.status) ? stripeColors.done : o.status === 'Delayed' ? stripeColors.attention : stripeColors.progress} testID={`lab-order-${o.code}`} title={`${o.patient} · ${o.caseType}`} subtitle={`${o.code} · ${o.lab} · due ${o.due_label}`} meta={o.stage}
                right={<StatusBadge status={o.status} />} />
            ))}
          </View>
        ) : <EmptyState icon="inbox" title={scope === 'ongoing' ? 'No ongoing cases' : 'Nothing delivered yet'} />}
      </QueryState>
    </Screen>
  )
}

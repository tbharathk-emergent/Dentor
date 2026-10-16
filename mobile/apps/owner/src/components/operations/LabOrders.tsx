import { Card, Divider, ListRow, Section, StatusBadge, T, colors, space } from '@dentor/shared'
import { View } from 'react-native'
import { CountBreakdown } from '@/components/CountBreakdown'
import type { Operations } from '@/types'

const LAB_STATUS_ORDER = ['Delayed', 'Ready', 'In Progress', 'Delivered']

/** Lab orders by status, then the ones that need someone to act: late, or ready to collect. */
export function LabOrders({ lab }: { lab: Operations['lab'] }) {
  return (
    <Section title="Lab orders">
      <Card padded={false} testID="lab-card">
        <View style={{ padding: space.lg }}>
          <CountBreakdown testID="lab-by-status" counts={lab.by_status} order={LAB_STATUS_ORDER} emptyText="No lab orders have been raised yet." />
        </View>
        <Divider />
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <T variant="smallStrong" color={colors.textMuted}>
            Needs attention
          </T>
        </View>
        {lab.attention.length === 0 ? (
          <View style={{ padding: space.lg, paddingTop: space.sm }}>
            <T variant="small" color={colors.textMuted} testID="lab-attention-empty">
              No lab orders are delayed or waiting to be collected.
            </T>
          </View>
        ) : (
          lab.attention.map((order, index) => (
            <View key={order.id}>
              {index > 0 && <Divider inset={space.lg} />}
              <ListRow
                testID="lab-attention"
                title={[order.caseType, order.patient].filter(Boolean).join(' · ') || order.code}
                subtitle={[order.code, order.lab, order.stage].filter(Boolean).join(' · ')}
                meta={order.due ? `Due ${order.due_label}` : undefined}
                right={<StatusBadge status={order.status} />}
              />
            </View>
          ))
        )}
      </Card>
    </Section>
  )
}
